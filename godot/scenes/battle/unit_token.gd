extends Node3D
## 보드 위 유닛 토큰(모듈) — 3D **카드(스프라이트 플레이스홀더)만** 담당.
## 머리위 정보(이름·HP바·상태)는 2D 오버레이(overhead_label)가 별도로 그림 — 해법 B(월드→화면 투영).
## battle.gd가 칸 중앙(pos)에 배치 후 setup(color). 머리 월드좌표는 head_world_pos()로 노출.

const CARD_SIZE := Vector2(1.0, 1.3)
const FEET_Y := 0.01   # 발이 칸 타일 표면에 닿는 높이

var _head_local := Vector3(0, FEET_Y + CARD_SIZE.y, 0)   # 머리(카드 위) 로컬 오프셋 — 오버레이 앵커

func setup(color: Color) -> void:
	_build_card(color)

## 오버레이가 투영할 머리 월드좌표(카드 위). 토큰은 회전/스케일 없으니 global_position + 로컬.
func head_world_pos() -> Vector3:
	return global_position + _head_local

## 카드 = 발(아래중앙)을 칸 중앙에 정확히 두고 풀 빌보드(카메라 평행). center_offset로 피벗=발. 위치 보정 없음.
func _build_card(color: Color) -> void:
	var card := MeshInstance3D.new()
	card.name = "Card"
	var q := QuadMesh.new()
	q.size = CARD_SIZE
	q.center_offset = Vector3(0, CARD_SIZE.y / 2.0, 0)  # 원점=발(아래 중앙)
	card.mesh = q
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED   # 카메라 평행
	mat.billboard_keep_scale = false   # 깊이감(멀수록 작게)
	card.material_override = mat
	card.position = Vector3(0, FEET_Y, 0)   # 발=칸 중앙(보정 없음)
	add_child(card)
