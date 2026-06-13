extends Node
## 게임 디렉터 (autoload 싱글톤) — 현 web `rustRun.ts`의 대응물.
## 책임: ① spr-core 세션 보유(SprSession) ② 현재 RunView 보유 ③ 명령 호출 후 phase로 화면 라우팅.
## Godot은 순수 뷰 — 게임 로직·상태·결정론은 전부 Rust. 데이터 에디터는 웹 잔류.

var session: Object = null     # SprSession (spr-godot GDExtension)
var view: Dictionary = {}      # 현재 RunView(파싱본). 화면들이 읽어 렌더.
var _seed: int = 1234
var _content: Dictionary = {}  # 콘텐츠 캐시(chars/items/skills/statuses) — 표시 전용, 1회 로드

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
const CLASS_CHANGE := "res://scenes/run/class_change.tscn"
const RESULT := "res://scenes/run/result.tscn"

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
func class_change(char_id: String, to_job_id: String) -> void:
	if session != null: _set_view(session.class_change(char_id, to_job_id))
func class_change_skip() -> void:
	if session != null: _set_view(session.class_change_skip())

## 개발용 — 화면을 단독 실행/캡처할 때 빈 view면 기본 런 생성(라우팅 없이 view만 채움).
func bootstrap_demo() -> void:
	if session == null or not view.is_empty(): return
	var v: Variant = JSON.parse_string(session.create_run(1234))
	if v is Dictionary: view = v

# ── 전투 ──
## 전투 진입 초기 델타 수집(createBattle + roundStart 주사위). {eventDelta,observation,view}. battle.gd가 1회 호출.
func battle_init() -> Dictionary:
	if session == null: return {}
	var r: Variant = JSON.parse_string(session.battle_init())
	return r if r is Dictionary else {}

## 콘텐츠 조회(표시 전용) — 번들 섹션명(characters|items|skills|statuses…) → id→def 딕셔너리. 1회 로드 후 캐시.
func content(section: String) -> Dictionary:
	if session == null: return {}
	if not _content.has(section):
		var v: Variant = JSON.parse_string(session.content_section(section))
		_content[section] = v if v is Dictionary else {}
	return _content[section]

## 시트 번들(파티 장착·전투유닛 charId/equipped). HUD 유닛 패널이 소비.
func sheet_data() -> Dictionary:
	if session == null: return {}
	var v: Variant = JSON.parse_string(session.sheet_data())
	return v if v is Dictionary else {}

## 현재 전투 관측(allies/enemies/order/legalActions/phase). 비전투면 {}.
func battle_obs() -> Dictionary:
	if session == null: return {}
	var o: Variant = JSON.parse_string(session.battle_obs())
	return o if o is Dictionary else {}

## 타겟팅 미리보기(앵커 칸) — {previewLoss:{uid:{hpLoss,shieldConsumed}}, ghosts:[name]}. 비전투면 {}.
func battle_targeting(skill_id: String, row: int, col: int) -> Dictionary:
	if session == null: return {}
	var v: Variant = JSON.parse_string(session.battle_targeting(skill_id, row, col))
	return v if v is Dictionary else {}

## 전투 종료 → run view 갱신 + phase 라우팅(수동 전투가 끝났을 때 호출).
func battle_finish() -> void:
	if session != null: _set_view(session.view())

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
	# battle_init은 battle.gd가 호출(roundStart 델타를 주사위 연출에 써야 하므로 여기서 소비하지 않음)

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
		"classChange": goto(CLASS_CHANGE)
		"won", "lost": goto(RESULT)
		_: goto(RUN_MAP)
