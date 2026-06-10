extends Node3D
## 전투 씬 루트 (2.5D · 탑다운 보드) — 웹 4×4 보드를 3D 바닥 그리드로 모방.
## 바닥 평면(PlaneMesh) 위에 셀 그리드를 깔고, 유닛 카드를 셀에 "눕혀"(수평 평면) 탑다운으로 내려다본다.
## 모든 머티리얼 unshaded(평면색 — 복잡 3D 라이팅 없음, 우리 2.5D 방침). 실제 유닛/HP/상태칩 연동은 R2.
## BattleDirector가 spr-core 이벤트 로그를 받아 애니메이션 연주(스텁).

const COLS := 4          # 한 진영 열 수
const ROWS := 2          # 한 진영 행 수(데모)
const CELL := 1.15       # 셀 한 변(월드 단위)
const GAP := 0.12        # 셀 간격
const SIDE_GAP := 1.1    # 아군/적군 그리드 사이 중앙 간격

# 팔레트(웹 style.css 이식)
const C_BG := Color(0.0784, 0.0863, 0.1098)
const C_CELL := Color(0.145, 0.165, 0.212)
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)

var director: BattleDirector

func _ready() -> void:
	director = BattleDirector.new(self)
	_setup_camera()
	_build_board()
	_place_demo_units()
	$HUD/Root/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))

## 틸트 탑다운 카메라 — 높이 위에서 보드 중앙을 내려다봄(3D 바닥이 드러나는 탑다운).
func _setup_camera() -> void:
	var cam: Camera3D = $Camera3D
	cam.position = Vector3(0, 11, 4.5)
	cam.look_at(Vector3.ZERO)
	cam.fov = 50.0

## 수평 평면 1장(바닥/셀/카드 공용) — PlaneMesh는 XZ 평면에 누워 위(+Y)를 향함.
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

func _build_board() -> void:
	add_child(_flat_quad(14.0, 14.0, C_BG, 0.0))                      # 바닥
	for side in [-1, 1]:                                              # -1=먼쪽(적), +1=가까운쪽(아군)
		for r in ROWS:
			for c in COLS:
				var cell := _flat_quad(CELL, CELL, C_CELL, 0.01)     # 셀(살짝 띄움)
				cell.position = _cell_pos(side, r, c)
				add_child(cell)

## 셀 월드 좌표 — 열은 X, 행은 Z. side로 아군/적군 그리드를 중앙에서 양쪽으로.
func _cell_pos(side: int, r: int, c: int) -> Vector3:
	var step := CELL + GAP
	var x := (c - (COLS - 1) / 2.0) * step
	var z := side * (SIDE_GAP + r * step + step / 2.0)
	return Vector3(x, 0.0, z)

## 데모 유닛 카드 — 셀보다 약간 작은 평면을 더 띄워 "바닥에 박힌 카드". (아군 가까이, 적 멀리)
func _place_demo_units() -> void:
	_add_card(1, 0, 0, C_ALLY)
	_add_card(1, 0, 1, C_ALLY)
	_add_card(1, 1, 2, C_ALLY)
	_add_card(-1, 0, 0, C_ENEMY)
	_add_card(-1, 0, 2, C_ENEMY)

func _add_card(side: int, r: int, c: int, color: Color) -> void:
	var card := _flat_quad(CELL * 0.78, CELL * 0.78, color, 0.03)
	card.position = _cell_pos(side, r, c)
	add_child(card)
