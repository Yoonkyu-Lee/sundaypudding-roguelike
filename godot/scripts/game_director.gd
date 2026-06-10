extends Node
## 게임 디렉터 (autoload 싱글톤) — 현 web `rustRun.ts`의 대응물.
## 책임: ① spr-core 세션 보유(SprSession) ② 현재 RunView 보유 ③ 명령 호출 후 phase로 화면 라우팅.
## Godot은 순수 뷰 — 게임 로직·상태·결정론은 전부 Rust. 데이터 에디터는 웹 잔류.

var session: Object = null     # SprSession (spr-godot GDExtension)
var view: Dictionary = {}      # 현재 RunView(파싱본). 화면들이 읽어 렌더.
var _seed: int = 1234

# 화면 경로 (셸 맵 — SHELL-DESIGN)
const TITLE := "res://scenes/title.tscn"
const HUB := "res://scenes/hub/hub.tscn"
const CAMPAIGN := "res://scenes/hub/campaign_select.tscn"
const RUN_MAP := "res://scenes/run/run_map.tscn"
const BATTLE := "res://scenes/battle/battle.tscn"
const CHARDEX := "res://scenes/chardex/chardex.tscn"
const REWARD := "res://scenes/run/reward.tscn"
const SHOP := "res://scenes/run/shop.tscn"
const ENCOUNTER := "res://scenes/run/encounter.tscn"

func _ready() -> void:
	if ClassDB.class_exists("SprSession"):
		session = ClassDB.instantiate("SprSession")
		print("[GameDirector] SprSession 준비됨 (Rust 코어 연결)")
	else:
		push_error("[GameDirector] SprSession 미등록 — spr.gdextension / cdylib 확인")

func goto(scene_path: String) -> void:
	get_tree().change_scene_to_file(scene_path)

# ── 캠페인 런 목록 (번들에서) ──
func run_list() -> Array:
	if session == null: return []
	var v: Variant = JSON.parse_string(session.run_list())
	return v if v is Array else []

# ── 런 시작/명령 — 모두 view 갱신 + phase 라우팅 ──
func start_run(run_id: String) -> void:
	if session == null: return
	_seed += 1
	_set_view(session.create_run_id(_seed, run_id))

func enter_node(node_id: String) -> void:
	if session != null: _set_view(session.enter_node(node_id))
func choose_reward(option_id: String) -> void:
	if session != null: _set_view(session.choose_reward(option_id))
func buy(offer_id: String) -> void:
	if session != null: _set_view(session.buy(offer_id))
func leave_shop() -> void:
	if session != null: _set_view(session.leave_shop())
func encounter(choice_id: String) -> void:
	if session != null: _set_view(session.encounter(choice_id))

## 개발용 — 화면을 단독 실행/캡처할 때 빈 view면 기본 런 생성(라우팅 없이 view만 채움).
func bootstrap_demo() -> void:
	if session == null or not view.is_empty(): return
	var v: Variant = JSON.parse_string(session.create_run(1234))
	if v is Dictionary: view = v

# ── 전투 ──
## 현재 전투 관측(allies/enemies/order/legalActions/phase). 비전투면 {}.
func battle_obs() -> Dictionary:
	if session == null: return {}
	var o: Variant = JSON.parse_string(session.battle_obs())
	return o if o is Dictionary else {}

## 자동 전투(스캐폴드) — 양측 AI로 종료까지 ai_step 루프. 끝나면 run view 갱신 + phase 라우팅.
func auto_battle() -> void:
	if session == null: return
	var guard := 0
	while guard < 300:
		session.battle_ai_step()
		guard += 1
		var obs: Variant = JSON.parse_string(session.battle_obs())
		if not (obs is Dictionary) or str(obs.get("phase", "")) != "inProgress": break
	_set_view(session.view())  # 전투 종료 → 다음 phase로

## 단독 실행/캡처용 — 런 생성 → 첫 도달가능 전투 노드 진입 + battle_init.
func bootstrap_battle() -> void:
	if session == null or str(view.get("phase", "")) == "battle": return
	var v: Variant = JSON.parse_string(session.create_run(1234))
	if not (v is Dictionary): return
	view = v
	for n in view.get("nodes", []):
		var t := str(n.get("type", ""))
		if str(n.get("status", "")) == "reachable" and t in ["battle", "elite", "boss"]:
			var nv: Variant = JSON.parse_string(session.enter_node(str(n.get("id", ""))))
			if nv is Dictionary: view = nv
			break
	if str(view.get("phase", "")) == "battle":
		session.battle_init()

func _set_view(json: String) -> void:
	var v: Variant = JSON.parse_string(json)
	if v is Dictionary:
		view = v
		_route()
	else:
		push_error("[GameDirector] RunView 파싱 실패: " + json.substr(0, 120))

## phase → 화면 (web rustRun: phase 분기). map/classChange=런맵, 결과=허브(placeholder).
func _route() -> void:
	match str(view.get("phase", "map")):
		"battle": goto(BATTLE)
		"reward": goto(REWARD)
		"shop": goto(SHOP)
		"encounter": goto(ENCOUNTER)
		"won", "lost": goto(HUB)
		_: goto(RUN_MAP)
