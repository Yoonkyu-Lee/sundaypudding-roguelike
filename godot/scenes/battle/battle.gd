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
	# 전투 진입 델타 수집(roundStart 주사위 포함). 보드 먼저 → 주사위 연출 → 진행.
	var init: Dictionary = GameDirector.battle_init()
	var obs := GameDirector.battle_obs()
	_place_units(obs)
	var rs := _find_round_start(init.get("eventDelta", []))
	if not rs.is_empty() and hud:
		hud.play_dice(rs, obs, _after_dice)
	else:
		_after_dice()

## 주사위 연출 후(또는 없을 때) — 적 턴 자동 진행 → 갱신/종료.
func _after_dice() -> void:
	var obs := _advance_enemy_turns(GameDirector.battle_obs())
	if _ended(obs): GameDirector.battle_finish()
	else: _refresh(obs)

func _find_round_start(delta: Variant) -> Dictionary:
	if not (delta is Array): return {}
	for e in delta:
		if e is Dictionary and str(e.get("t", "")) == "roundStart": return e
	return {}

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
	_add_unit(side, int(p.get("row", 1)), int(p.get("col", 0)), color, str(u.get("name", "?")),
		int(u.get("hp", 0)), int(u.get("hpMax", 0)), int(u.get("shield", 0)), u.get("statuses", []))

## 유닛 = 셀 위에 서 있는 빌보드 카드 + 이름 · HP바(쉴드) · 상태칩 라벨. $Units 밑에.
## hpMax<=0이면 데모(바·상태 생략).
func _add_unit(side: int, row: int, col: int, color: Color, unit_name: String,
		hp: int = 0, hp_max: int = 0, shield: int = 0, statuses: Variant = []) -> void:
	var pos := _slot_pos(side, row, col)
	# 서 있는 카드(빌보드 쿼드)
	var card := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(1.0, 1.3)
	card.mesh = qm
	card.material_override = _unshaded_billboard(color)
	card.position = pos + Vector3(0, 0.75, 0)
	$Units.add_child(card)
	# 이름표(카드 위)
	_label3d(unit_name, pos + Vector3(0, 1.62, 0), C_TXT, 34)
	# 상태칩(이름 위) — icon+stacks, 쉴드 먼저
	var chips := ""
	if shield > 0: chips += "🛡%d " % shield
	if statuses is Array:
		for s in statuses:
			var ic := str(s.get("icon", ""))
			if ic == "": continue
			var st := int(s.get("stacks", 0))
			chips += "%s%s " % [ic, str(st) if st > 1 else ""]
	if chips != "":
		_label3d(chips.strip_edges(), pos + Vector3(0, 1.86, 0), Color(1, 0.82, 0.4), 26)
	# HP바(이름 아래) — hpMax 있을 때만
	if hp_max > 0:
		var pct := clampf(float(hp) / float(hp_max), 0.0, 1.0)
		var left := pos + Vector3(-0.45, 1.42, 0.0)  # 바 좌측 끝(빌보드 원점)
		_bar(left, 0.9, 0.12, Color(0.1, 0.11, 0.14), 1.0)         # 배경
		_bar(left, 0.9, 0.12, _hp_color(pct), pct)                  # 채움
		_label3d("%d/%d" % [hp, hp_max], pos + Vector3(0, 1.28, 0), C_TXT, 22)

## 좌측 끝 앵커 빌보드 바(QuadMesh center_offset로 fill이 좌→우로 자람).
func _bar(left_pos: Vector3, width: float, height: float, color: Color, pct: float) -> void:
	var m := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(maxf(0.001, width * pct), height)
	q.center_offset = Vector3(q.size.x / 2.0, 0, 0)  # 원점=좌측 끝
	m.mesh = q
	m.material_override = _unshaded_billboard(color)
	m.position = left_pos
	$Units.add_child(m)

func _label3d(text: String, pos: Vector3, col: Color, size: int) -> void:
	var lbl := Label3D.new()
	lbl.text = text
	lbl.font_size = size
	lbl.pixel_size = 0.0055
	lbl.modulate = col
	lbl.outline_size = 10
	lbl.outline_modulate = Color(0, 0, 0, 1)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = pos
	$Units.add_child(lbl)

func _unshaded_billboard(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	return mat

func _hp_color(pct: float) -> Color:
	if pct > 0.5: return Color(0.314, 0.784, 0.471)   # 초록
	if pct > 0.25: return Color(1.0, 0.82, 0.4)        # 노랑
	return Color(0.902, 0.408, 0.353)                  # 빨강
