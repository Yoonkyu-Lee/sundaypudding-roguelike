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
	_place_units()
	$HUD/Root/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))

## 슬롯 월드 좌표 — .tscn 셀과 동일 식. 행=좌우(X), 열=진영 깊이(Z), col 0=전열(중앙).
func _slot_pos(side: int, row: int, col: int) -> Vector3:
	var step := CELL + GAP
	return Vector3((row - 1.0) * step, 0.0, side * (SIDE_GAP + col * step))

## 바닥에 눕힌 정사각 평면(유닛 카드용). unshaded 평면색.
func _flat_quad(size: float, color: Color, y: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(size, size)
	mi.mesh = pm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = mat
	mi.position.y = y
	return mi

func _place_units() -> void:
	# 아군 = 실제 런 데이터(없으면 폴백 데모)
	var view: Variant = GameDirector.create_run(12345) if GameDirector.session != null else null
	if view is Dictionary and view.has("party"):
		for m in view["party"]:
			var p: Dictionary = m.get("pos", {})
			_add_unit(1, int(p.get("row", 1)), int(p.get("col", 0)), C_ALLY, str(m.get("name", "?")))
	else:
		_add_unit(1, 1, 0, C_ALLY, "아군 A")
		_add_unit(1, 2, 0, C_ALLY, "아군 B")
	# 적군 = 데모(전투 관측 연동 = R2)
	_add_unit(-1, 1, 0, C_ENEMY, "적 A")
	_add_unit(-1, 2, 1, C_ENEMY, "적 B")

## 유닛 = 바닥에 눕힌 카드 + 위에 떠 있는 빌보드 이름표. $Units 밑에 둠.
func _add_unit(side: int, row: int, col: int, color: Color, unit_name: String) -> void:
	var pos := _slot_pos(side, row, col)
	var card := _flat_quad(CELL * 0.78, color, 0.03)
	card.position = pos
	$Units.add_child(card)
	var lbl := Label3D.new()
	lbl.text = unit_name
	lbl.font_size = 48
	lbl.pixel_size = 0.006
	lbl.modulate = C_TXT
	lbl.outline_size = 8
	lbl.outline_modulate = Color(0, 0, 0, 0.9)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.position = pos + Vector3(0, 0.5, 0)
	$Units.add_child(lbl)
