extends Node3D
## 전투 씬 (2.5D 탑다운). **정적 보드(바닥·그리드 셀·카메라)는 battle.tscn에 노드로 박혀 에디터에서 보임/편집.**
## 코드는 데이터로 생기는 것만: 유닛 카드(아군=RunView.party, 적=데모) + 빌보드 이름표 → $Units 밑에 add_child.
## 셀 좌표는 .tscn 셀과 같은 식(_slot_pos) — 상수 일치 필수.

const CELL := 1.15
const GAP := 0.12
const SIDE_GAP := 1.1
const ROWS := 4
const COLS := 4
const C_TXT := Color(0.902, 0.9137, 0.9373)
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const BoardTargeting := preload("res://scenes/battle/board_targeting.gd")

var director: BattleDirector
var _obs: Dictionary = {}        # 최신 관측(타겟팅이 legalActions/유닛 위치 조회)
var _board: Node3D               # 보드 칸 타겟팅 오버레이
var _target_skill: String = ""   # 타겟팅 중인 스킬명("" = 비타겟팅)

func _ready() -> void:
	director = BattleDirector.new(self)
	if str(GameDirector.view.get("phase", "")) != "battle":
		GameDirector.bootstrap_battle()  # 단독 실행/캡처용
	_board = BoardTargeting.new()
	add_child(_board)
	_board.setup($Camera3D)
	_board.cell_hovered.connect(_on_cell_hovered)
	_board.cell_clicked.connect(_on_cell_clicked)
	var hud := get_node_or_null("BattleHUD")
	if hud:
		hud.action_chosen.connect(_act)
		hud.skill_selected.connect(_begin_targeting)
		hud.targeting_cancelled.connect(_cancel_targeting)
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
	else:
		_refresh(obs)
		if _DEBUG_AUTOTARGET: _debug_autotarget()

# [임시 검증용] 첫 아군 스킬 자동선택 + 첫 칸 호버 — 스크린샷으로 타겟팅 오버레이 확인. 커밋 전 false.
const _DEBUG_AUTOTARGET := false
func _debug_autotarget() -> void:
	for a in _obs.get("legalActions", []):
		var sn := str(a.get("skillName", ""))
		if sn != "":
			_begin_targeting(sn)
			var cell := _action_cell(a)
			if not cell.is_empty(): _on_cell_hovered("%d,%d,%d" % [cell.row, cell.col, cell.side])
			return

func _find_round_start(delta: Variant) -> Dictionary:
	if not (delta is Array): return {}
	for e in delta:
		if e is Dictionary and str(e.get("t", "")) == "roundStart": return e
	return {}

## 플레이어 행동(legalAction.action) → battle_step → 적 턴 자동 진행 → 갱신/종료.
func _act(action: Dictionary) -> void:
	if GameDirector.session == null: return
	_cancel_targeting()
	GameDirector.session.battle_step(JSON.stringify(action))
	var obs := _advance_enemy_turns(GameDirector.battle_obs())
	if _ended(obs): GameDirector.battle_finish()
	else: _refresh(obs)

# ── 보드 칸 타겟팅 (HUD 스킬 선택 → 보드 클릭) ──
## 스킬 선택 시 — 그 스킬의 legalActions로 타겟가능 칸·명중%를 보드에 표시.
func _begin_targeting(skill_name: String) -> void:
	_target_skill = skill_name
	var targets := []
	var seen := {}
	for a in _obs.get("legalActions", []):
		if str(a.get("skillName", "")) != skill_name: continue
		var cell := _action_cell(a)
		if cell.is_empty(): continue
		var key := "%d,%d,%d" % [cell.row, cell.col, cell.side]
		if seen.has(key): continue
		seen[key] = true
		targets.append({"key": key, "pos": _slot_pos(cell.side, cell.row, cell.col), "hit": int(a.get("hitChance", -1))})
	_board.show_targets(targets)

## 호버 칸 — AoE 풋프린트 + battle_targeting로 HP 손실 예고(빨강).
func _on_cell_hovered(key: String) -> void:
	if key == "" or _target_skill == "": return
	var parts := key.split(",")
	if parts.size() < 3: return
	var row := int(parts[0]); var col := int(parts[1]); var side := int(parts[2])
	var skill_id := _skill_id_of(_target_skill)
	var area := _skill_area(skill_id)
	var anchor := _slot_pos(side, row, col)
	var footprint := []
	for c in _area_cells(row, col, area):
		footprint.append(_slot_pos(side, c.x, c.y))
	var tgt := GameDirector.battle_targeting(skill_id, row, col)
	var losses := []
	var loss_map: Variant = tgt.get("previewLoss", {})
	if loss_map is Dictionary:
		for uid in loss_map:
			var u := _unit_by_uid(str(uid))
			if u.is_empty(): continue
			var p: Dictionary = u.get("pos", {})
			var sd := 1 if str(u.get("side", "")) == "ally" else -1
			var hl := int(loss_map[uid].get("hpLoss", 0))
			losses.append({"pos": _slot_pos(sd, int(p.get("row", 0)), int(p.get("col", 0))), "text": "-%d" % hl})
	_board.show_preview(anchor, footprint, losses)

## 칸 클릭 — 그 칸의 legalAction을 찾아 실행.
func _on_cell_clicked(key: String) -> void:
	if _target_skill == "": return
	for a in _obs.get("legalActions", []):
		if str(a.get("skillName", "")) != _target_skill: continue
		var cell := _action_cell(a)
		if cell.is_empty(): continue
		if key == "%d,%d,%d" % [cell.row, cell.col, cell.side]:
			_act(a.get("action", {}))
			return

func _cancel_targeting() -> void:
	_target_skill = ""
	if _board: _board.stop()

## legalAction → 타겟 칸 {row,col,side(1아군/-1적)}. targetUid 우선, 없으면 action.targetCell.
func _action_cell(a: Dictionary) -> Dictionary:
	var tuid := str(a.get("targetUid", ""))
	if tuid != "":
		var u := _unit_by_uid(tuid)
		if not u.is_empty():
			var p: Dictionary = u.get("pos", {})
			return {"row": int(p.get("row", 0)), "col": int(p.get("col", 0)), "side": 1 if str(u.get("side", "")) == "ally" else -1}
	var act: Dictionary = a.get("action", {})
	var tc: Variant = act.get("targetCell")
	if tc is Dictionary:
		# 칸 타겟 스킬 — 진영은 현재 행동자 기준(self 대상이면 같은 편). MVP: 적 대상 가정 외엔 행동자 편.
		var side := _target_side_for(_skill_id_of(_target_skill))
		return {"row": int(tc.get("row", 0)), "col": int(tc.get("col", 0)), "side": side}
	return {}

# ── 조회 헬퍼 ──
func _unit_by_uid(uid: String) -> Dictionary:
	for u in _obs.get("allies", []) + _obs.get("enemies", []):
		if u is Dictionary and str(u.get("uid", "")) == uid: return u
	return {}

func _skill_id_of(skill_name: String) -> String:
	for a in _obs.get("legalActions", []):
		if str(a.get("skillName", "")) == skill_name:
			return str(a.get("action", {}).get("skillId", ""))
	return ""

func _skill_area(skill_id: String) -> Dictionary:
	var sk: Dictionary = GameDirector.content("skills").get(skill_id, {})
	var area: Variant = sk.get("area")
	return area if area is Dictionary else {"kind": "single"}

## 타겟팅 대상 진영(1아군/-1적) — 현재 행동자 + 스킬 target. enemy면 반대편.
func _target_side_for(skill_id: String) -> int:
	var sk: Dictionary = GameDirector.content("skills").get(skill_id, {})
	var cur: Variant = _obs.get("current")
	var actor_ally := cur is Dictionary and str(cur.get("side", "")) == "ally"
	if str(sk.get("target", "enemy")) == "enemy": return -1 if actor_ally else 1
	return 1 if actor_ally else -1

## AreaShape 풋프린트(앵커 row,col 기준) → [Vector2(row,col)]. web areaGeo.computeAreaCells 1:1.
func _area_cells(arow: int, acol: int, area: Dictionary) -> Array:
	var cells := []
	var push := func(r: int, c: int) -> void:
		if r >= 0 and r < ROWS and c >= 0 and c < COLS: cells.append(Vector2(r, c))
	match str(area.get("kind", "single")):
		"single": push.call(arow, acol)
		"row":
			for c in COLS: push.call(arow, c)
		"col":
			for r in ROWS: push.call(r, acol)
		"square":
			var rad := int(area.get("radius", 1))
			for dr in range(-rad, rad + 1):
				for dc in range(-rad, rad + 1): push.call(arow + dr, acol + dc)
		"cross":
			var rad := int(area.get("radius", 1))
			push.call(arow, acol)
			for d in range(1, rad + 1):
				push.call(arow + d, acol); push.call(arow - d, acol)
				push.call(arow, acol + d); push.call(arow, acol - d)
		"all":
			for r in ROWS:
				for c in COLS: push.call(r, c)
	return cells

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
	_obs = obs
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
	if not bool(u.get("alive", true)): return  # 죽은 유닛은 전장에서 제거(사망 페이드 연출은 H3)
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
		_bar(left, 0.9, 0.12, Color(0.1, 0.11, 0.14), 1.0, 0)      # 배경(뒤)
		_bar(left, 0.9, 0.12, _hp_color(pct), pct, 1)               # 채움(앞 — render_priority로 z-fight 방지)
		_label3d("%d/%d" % [hp, hp_max], pos + Vector3(0, 1.28, 0), C_TXT, 22)

## 좌측 끝 앵커 빌보드 바(QuadMesh center_offset로 fill이 좌→우로 자람).
## bg/fill이 코플래너 빌보드라 z-fight → no_depth_test + render_priority(채움>배경)로 채움을 항상 앞에.
func _bar(left_pos: Vector3, width: float, height: float, color: Color, pct: float, priority: int) -> void:
	var m := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(maxf(0.001, width * pct), height)
	q.center_offset = Vector3(q.size.x / 2.0, 0, 0)  # 원점=좌측 끝
	m.mesh = q
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.no_depth_test = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA  # render_priority가 먹도록(투명 패스)
	mat.render_priority = priority
	m.material_override = mat
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
