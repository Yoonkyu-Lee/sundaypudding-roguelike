extends Node3D
## 전투 씬 (2.5D 탑다운). **정적 보드(바닥·그리드 셀·카메라)는 battle.tscn에 노드로 박혀 에디터에서 보임/편집.**
## 코드는 데이터로 생기는 것만: 유닛 카드(아군=RunView.party, 적=데모) + 빌보드 이름표 → $Units 밑에 add_child.
## 셀 좌표는 .tscn 셀과 같은 식(_slot_pos) — 상수 일치 필수.

const CELL := 1.15
const GAP := 0.12
const SIDE_GAP := 1.1
const C_TXT := Color(0.902, 0.9137, 0.9373)
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)

var director: BattleDirector

func _ready() -> void:
	director = BattleDirector.new(self)
	if str(GameDirector.view.get("phase", "")) != "battle":
		GameDirector.bootstrap_battle()  # 단독 실행/캡처용
	var hud := get_node_or_null("BattleHUD")
	if hud: hud.action_chosen.connect(_act)
	var obs := _advance_enemy_turns(GameDirector.battle_obs())
	if _ended(obs): GameDirector.battle_finish(); return
	_refresh(obs)

## 플레이어 행동(legalAction.action) → battle_step → 적 턴 자동 진행 → 갱신/종료.
func _act(action: Dictionary) -> void:
	if GameDirector.session == null: return
	GameDirector.session.battle_step(JSON.stringify(action))
	var obs := _advance_enemy_turns(GameDirector.battle_obs())
	if _ended(obs): GameDirector.battle_finish()
	else: _refresh(obs)

## 적 턴 자동(AI) — 아군 턴/종료까지 ai_step. 최종 obs.
func _advance_enemy_turns(obs: Dictionary) -> Dictionary:
	var guard := 0
	while guard < 100 and not _ended(obs) and _cur_side(obs) == "enemy":
		GameDirector.session.battle_ai_step()
		obs = GameDirector.battle_obs()
		guard += 1
	return obs

func _ended(obs: Dictionary) -> bool:
	return str(obs.get("phase", "")) != "inProgress"

func _cur_side(obs: Dictionary) -> String:
	var c: Variant = obs.get("current")
	return str(c.get("side", "")) if c is Dictionary else ""

func _refresh(obs: Dictionary) -> void:
	for c in $Units.get_children(): c.queue_free()
	_place_units(obs)
	var hud := get_node_or_null("BattleHUD")
	if hud: hud.populate(obs)

## 슬롯 월드 좌표 — .tscn 셀과 동일 식. 행(0~3)=좌우(X, 4행 중앙정렬), 열(0~3)=진영 깊이(Z), col 0=전열(중앙).
func _slot_pos(side: int, row: int, col: int) -> Vector3:
	var step := CELL + GAP
	return Vector3((row - 1.5) * step, 0.0, side * (SIDE_GAP + col * step))

func _place_units(obs: Dictionary) -> void:
	var allies: Variant = obs.get("allies")
	if allies is Array and not allies.is_empty():
		# 실 전투 관측 — 아군/적 실 배치·이름·HP
		for u in allies: _place_obs_unit(1, u, C_ALLY)
		for u in obs.get("enemies", []): _place_obs_unit(-1, u, C_ENEMY)
	else:
		# 폴백 데모(전투 phase 진입 실패 시)
		_add_unit(1, 1, 0, C_ALLY, "아군 A")
		_add_unit(1, 2, 0, C_ALLY, "아군 B")
		_add_unit(-1, 1, 0, C_ENEMY, "적 A")
		_add_unit(-1, 2, 1, C_ENEMY, "적 B")

func _place_obs_unit(side: int, u: Dictionary, color: Color) -> void:
	var p: Dictionary = u.get("pos", {})
	var label := "%s\n%d/%d" % [str(u.get("name", "?")), int(u.get("hp", 0)), int(u.get("hpMax", 0))]
	_add_unit(side, int(p.get("row", 1)), int(p.get("col", 0)), color, label)

## 유닛 = 셀 위에 서 있는 빌보드 카드(항상 카메라 향함) + 이름·HP 라벨. $Units 밑에.
func _add_unit(side: int, row: int, col: int, color: Color, unit_name: String) -> void:
	var pos := _slot_pos(side, row, col)
	# 서 있는 카드(빌보드 쿼드) — 바닥에서 세움
	var card := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(1.0, 1.3)
	card.mesh = qm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	card.material_override = mat
	card.position = pos + Vector3(0, 0.75, 0)
	$Units.add_child(card)
	# 이름·HP 라벨(카드 위, 깊이무시로 항상 보임)
	var lbl := Label3D.new()
	lbl.text = unit_name
	lbl.font_size = 38
	lbl.pixel_size = 0.0055
	lbl.modulate = C_TXT
	lbl.outline_size = 12
	lbl.outline_modulate = Color(0, 0, 0, 1)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = pos + Vector3(0, 0.85, 0)
	$Units.add_child(lbl)
