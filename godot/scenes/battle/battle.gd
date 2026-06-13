extends Node3D
## 전투 씬 (2.5D 탑다운). **정적 보드(바닥·그리드 셀·카메라)는 battle.tscn에 노드로 박혀 에디터에서 보임/편집.**
## 코드는 데이터로 생기는 것만: 유닛 카드(아군=RunView.party, 적=데모) + 빌보드 이름표 → $Units 밑에 add_child.
## 셀 좌표는 .tscn 셀과 같은 식(_slot_pos) — 상수 일치 필수.

const CELL := 1.15
const GAP := 0.12
const SIDE_GAP := 1.1
const ROWS := 4
const COLS := 4
const CELL_DEPTH := 1.15   # 칸 깊이(타일 크기) — 발을 칸 안에서 깊이-분수로 배치하는 기준
const C_TXT := Color(0.902, 0.9137, 0.9373)
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const BoardTargeting := preload("res://scenes/battle/board_targeting.gd")
const UNIT_TOKEN := preload("res://scenes/battle/unit_token.gd")
const OVERHEAD := preload("res://scenes/battle/overhead_label.gd")

var director: BattleDirector
var _obs: Dictionary = {}        # 최신 관측(타겟팅이 legalActions/유닛 위치 조회)
var _board: Node3D               # 보드 칸 타겟팅 오버레이
var _target_skill: String = ""   # 타겟팅 중인 스킬명("" = 비타겟팅)
var _overhead_layer: CanvasLayer # 머리위 2D UI 레이어(해법 B)
var _overheads: Array = []       # [{anchor: 토큰, ui: overhead_label}] — _process가 투영 갱신

func _ready() -> void:
	director = BattleDirector.new(self)
	if str(GameDirector.view.get("phase", "")) != "battle":
		GameDirector.bootstrap_battle()  # 단독 실행/캡처용
	_overhead_layer = CanvasLayer.new()  # HUD(layer 1) 아래
	add_child(_overhead_layer)
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
	if _target_skill == "": return
	if key == "":  # 타겟 칸 밖으로 나감 → 밝은 호버 프리뷰 제거(타겟가능 칸·명중%는 유지)
		_board.clear_preview()
		return
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
	_clear_overheads()
	_place_units(obs)
	var hud := get_node_or_null("BattleHUD")
	if hud: hud.populate(obs)

## 깊이-분수 배치(실험): 칸 깊이 8등분, 카메라 최근접 줄(row3)=1/8 앞, 최원거리(row0)=7/8 뒤.
## 가까운 칸 스프라이트는 칸 앞쪽, 먼 칸은 칸 뒤쪽 → 깊이 간격 벌려 가림 최소화. 카메라 지면방향(basis.z) 기준.
func _depth_shift(row: int) -> Vector3:
	var rank := (ROWS - 1) - row              # row3=카메라 최근접=rank0
	var f := (2.0 * rank + 1.0) / 8.0         # 1/8, 3/8, 5/8, 7/8 (앞 가장자리에서의 비율)
	var toward := (0.5 - f) * CELL_DEPTH      # +면 카메라 쪽(앞), -면 뒤
	var cam: Camera3D = $Camera3D
	var g := Vector3(cam.global_transform.basis.z.x, 0, cam.global_transform.basis.z.z)
	if g.length() < 0.01: return Vector3.ZERO
	return g.normalized() * toward

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
		_spawn_token(1, 1, 0, C_ALLY, "아군 A")
		_spawn_token(1, 2, 0, C_ALLY, "아군 B")
		_spawn_token(-1, 1, 0, C_ENEMY, "적 A")
		_spawn_token(-1, 2, 1, C_ENEMY, "적 B")

func _place_obs_unit(side: int, u: Dictionary, color: Color) -> void:
	if not bool(u.get("alive", true)): return  # 죽은 유닛은 전장에서 제거(사망 페이드 연출은 H3)
	var p: Dictionary = u.get("pos", {})
	_spawn_token(side, int(p.get("row", 1)), int(p.get("col", 0)), color, str(u.get("name", "?")),
		int(u.get("hp", 0)), int(u.get("hpMax", 0)), int(u.get("shield", 0)), u.get("statuses", []))

## 칸 중앙에 유닛 토큰(3D 카드) + 머리위 2D 오버레이(이름·HP·상태) 1쌍 배치. _process가 오버레이를 투영 갱신(해법 B).
func _spawn_token(side: int, row: int, col: int, color: Color, unit_name: String,
		hp: int = 0, hp_max: int = 0, shield: int = 0, statuses: Variant = []) -> void:
	var t = UNIT_TOKEN.new()
	t.position = _slot_pos(side, row, col) + _depth_shift(row)
	$Units.add_child(t)
	t.setup(color)
	var ui = OVERHEAD.new()
	_overhead_layer.add_child(ui)
	ui.setup(unit_name, "ally" if side == 1 else "enemy", hp, hp_max, shield, statuses)
	_overheads.append({"anchor": t, "ui": ui})

## 매 프레임 — 각 유닛 머리 월드좌표를 화면으로 투영해 2D 오버레이를 카드 위 중심에 배치.
func _process(_dt: float) -> void:
	if _overheads.is_empty(): return
	var cam: Camera3D = $Camera3D
	for o in _overheads:
		var anchor = o["anchor"]
		var ui = o["ui"]
		if not is_instance_valid(anchor) or not is_instance_valid(ui): continue
		var wp: Vector3 = anchor.head_world_pos(cam)
		if cam.is_position_behind(wp):
			ui.visible = false
			continue
		ui.visible = true
		var sp := cam.unproject_position(wp)
		ui.position = sp - Vector2(ui.size.x * 0.5, ui.size.y)  # 하단 중앙=머리 위

func _clear_overheads() -> void:
	for o in _overheads:
		if is_instance_valid(o["ui"]): o["ui"].queue_free()
	_overheads.clear()
