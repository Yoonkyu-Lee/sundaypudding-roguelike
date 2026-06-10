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
