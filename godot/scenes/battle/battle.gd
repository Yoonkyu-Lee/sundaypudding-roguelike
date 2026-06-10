extends Node3D
## 전투 씬 루트 (2.5D · 탑다운 보드) — 웹 4×4 보드를 3D 바닥 그리드로 모방.
## 바닥 평면 위에 셀 그리드를 깔고, 유닛 카드를 셀에 "눕혀"(수평 평면) 탑다운으로 내려다본다.
## 아군 = 실제 런 데이터(GameDirector.create_run → RunView.party: 이름·위치). 적군 = 데모(전투 관측 연동은 R2).
## 카드마다 빌보드 이름표(Label3D). 머티리얼 unshaded(평면색, 복잡 3D 라이팅 없음 — 2.5D 방침).

const COLS := 4          # 백드롭 그리드 열(col 0=전열, 중앙쪽)
const ROWS := 3          # 백드롭 그리드 행(좌우)
const CELL := 1.15
const GAP := 0.12
const SIDE_GAP := 1.1    # 아군/적군 그리드 사이 중앙 간격

const C_BG := Color(0.0784, 0.0863, 0.1098)
const C_CELL := Color(0.145, 0.165, 0.212)
const C_TXT := Color(0.902, 0.9137, 0.9373)
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)

var director: BattleDirector

func _ready() -> void:
	director = BattleDirector.new(self)
	_setup_camera()
	add_child(_flat_quad(16.0, 16.0, C_BG, 0.0))   # 바닥
	_build_grid(1)                                  # 아군(가까운 쪽)
	_build_grid(-1)                                 # 적군(먼 쪽)
	_place_units()
	$HUD/Root/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))

## 틸트 탑다운 카메라 — 보드 중앙을 높이 위에서 내려다봄.
func _setup_camera() -> void:
	var cam: Camera3D = $Camera3D
	cam.position = Vector3(0, 12, 5)
	cam.look_at(Vector3.ZERO)
	cam.fov = 50.0

## 슬롯 월드 좌표 — 행은 좌우(X), 열은 진영 깊이(Z). col 0 = 전열(중앙=적과 마주봄).
func _slot_pos(side: int, row: int, col: int) -> Vector3:
	var step := CELL + GAP
	return Vector3((row - 1.0) * step, 0.0, side * (SIDE_GAP + col * step))

## 수평 평면(바닥/셀/카드 공용) — PlaneMesh는 XZ 평면에 누워 +Y를 향함.
func _flat_quad(size_x: float, size_z: float, color: Color, y: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(size_x, size_z)
	mi.mesh = pm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = mat
	mi.position.y = y
	return mi

func _build_grid(side: int) -> void:
	for row in ROWS:
		for col in COLS:
			var cell := _flat_quad(CELL, CELL, C_CELL, 0.01)
			cell.position = _slot_pos(side, row, col)
			add_child(cell)

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
	# 적군 = 데모(전투 관측 연동 전)
	_add_unit(-1, 1, 0, C_ENEMY, "적 A")
	_add_unit(-1, 2, 1, C_ENEMY, "적 B")

## 유닛 = 바닥에 눕힌 카드(평면) + 그 위에 떠 있는 빌보드 이름표.
func _add_unit(side: int, row: int, col: int, color: Color, unit_name: String) -> void:
	var pos := _slot_pos(side, row, col)
	var card := _flat_quad(CELL * 0.78, CELL * 0.78, color, 0.03)
	card.position = pos
	add_child(card)
	var lbl := Label3D.new()
	lbl.text = unit_name
	lbl.font_size = 48
	lbl.pixel_size = 0.006
	lbl.modulate = C_TXT
	lbl.outline_size = 8
	lbl.outline_modulate = Color(0, 0, 0, 0.9)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.position = pos + Vector3(0, 0.5, 0)
	add_child(lbl)
