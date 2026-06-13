extends Node3D
## 보드 위 유닛 토큰(모듈, 1유닛=1인스턴스) — battle.gd가 칸 중앙(pos, y=0)에 배치 후 setup().
## 책임: ① 카드(애셋 플레이스홀더, 칸 중앙 대칭·카메라 평행 빌보드) ② 머리위 정보(HP바·이름·상태)를 겹치지 않게 세로 스택.
## 카드=현재 단색 쿼드(추후 Sprite3D 초상화로 교체). HP바 z-fight는 no_depth_test+render_priority로 방지.

const C_TXT := Color(0.902, 0.9137, 0.9373)
const C_DIM := Color(0.1, 0.11, 0.14)
const C_ACCENT := Color(1.0, 0.82, 0.4)

# 로컬 높이(칸 중앙 기준) — 겹치지 않게 충분한 간격. 카드 위로 HP바→이름→상태 순.
const CARD_SIZE := Vector2(1.0, 1.3)
const Y_HP := 1.5
const Y_NAME := 1.82
const Y_STATUS := 2.12
const BAR_W := 0.92
const BAR_H := 0.2   # 분수 숫자가 바 안에 들어가도록 두껍게
const NUDGE_TOWARD := 0.35  # 발을 카메라 쪽(수평)으로 당김 — 비스듬한 카메라에서 칸 위에 서 보이게
const NUDGE_UP := 0.04

var _camera: Camera3D

## unit_name·진영색·hp/hpMax/shield/statuses + 카메라(발 너지·평행용). hpMax<=0이면 데모(HP바·상태 생략).
func setup(unit_name: String, color: Color, hp: int = 0, hp_max: int = 0, shield: int = 0, statuses: Variant = [], camera: Camera3D = null) -> void:
	_camera = camera
	_build_card(color)
	if hp_max > 0:
		_build_hp(hp, hp_max)
	_label3d(unit_name, Y_NAME, C_TXT, 32)
	if hp_max > 0:
		_build_status(shield, statuses)

## 카드 = 발(아래중앙)을 칸에 붙이고 카메라 쪽으로 살짝 당긴 뒤 풀 빌보드(카메라 평행). center_offset로 피벗=발.
func _build_card(color: Color) -> void:
	var card := MeshInstance3D.new()
	card.name = "Card"
	var q := QuadMesh.new()
	q.size = CARD_SIZE
	q.center_offset = Vector3(0, CARD_SIZE.y / 2.0, 0)  # 원점=발(아래 중앙) → 빌보드가 발 기준 회전
	card.mesh = q
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED   # 카메라 평행(풀 빌보드)
	mat.billboard_keep_scale = false   # 깊이감(멀수록 작게)
	card.material_override = mat
	card.position = Vector3(0, 0.02, 0) + _toward_camera_nudge()
	add_child(card)

## 발을 카메라 쪽(수평)으로 당기고 살짝 들어올리는 오프셋 — 비스듬한 카메라에서 칸 위에 서 보이게.
func _toward_camera_nudge() -> Vector3:
	if _camera == null: return Vector3(0, NUDGE_UP, 0)
	var to_cam := _camera.global_position - global_position
	var horiz := Vector3(to_cam.x, 0, to_cam.z)
	if horiz.length() < 0.01: return Vector3(0, NUDGE_UP, 0)
	return horiz.normalized() * NUDGE_TOWARD + Vector3(0, NUDGE_UP, 0)

## HP바(머리 위) — 스프라이트 중심 정렬. 배경+채움(좌→우) + 숫자. 채움이 항상 배경 앞(render_priority).
func _build_hp(hp: int, hp_max: int) -> void:
	var pct := clampf(float(hp) / float(hp_max), 0.0, 1.0)
	_bar(Y_HP, BAR_W, BAR_H, C_DIM, 1.0, 0)            # 배경(뒤, 중앙)
	_bar(Y_HP, BAR_W, BAR_H, _hp_color(pct), pct, 1)   # 채움(앞, 좌→우)
	_label3d("%d / %d" % [hp, hp_max], Y_HP, C_TXT, 22, 2)     # 숫자(바 안 중앙 — render_priority로 채움 위)

## 상태이상 칩(이름 위) — 쉴드 먼저 + icon+stacks. 없으면 생략.
func _build_status(shield: int, statuses: Variant) -> void:
	var chips := ""
	if shield > 0: chips += "🛡%d " % shield
	if statuses is Array:
		for s in statuses:
			var ic := str(s.get("icon", ""))
			if ic == "": continue
			var st := int(s.get("stacks", 0))
			chips += "%s%s " % [ic, str(st) if st > 1 else ""]
	if chips != "":
		_label3d(chips.strip_edges(), Y_STATUS, C_ACCENT, 26)

## 스프라이트 중심(x=0) 피벗 빌보드 바 — bg·fill이 같은 피벗에서 빌보드 → 바가 항상 스프라이트 중심 정렬(카메라 yaw 무관).
## center_offset으로 채움 메쉬를 바 왼쪽에 앵커(좌→우 자람). no_depth_test+render_priority로 코플래너 z-fight 방지.
func _bar(y: float, width: float, height: float, color: Color, pct: float, priority: int) -> void:
	var fw := maxf(0.001, width * pct)
	var m := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(fw, height)
	q.center_offset = Vector3(-width / 2.0 + fw / 2.0, 0, 0)  # 메쉬 왼쪽 끝=바 왼쪽(-width/2), 노드 피벗=중심
	m.mesh = q
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.billboard_keep_scale = true
	mat.no_depth_test = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.render_priority = priority
	m.material_override = mat
	m.position = Vector3(0, y, 0)  # 스프라이트 중심 기준
	add_child(m)

func _label3d(text: String, y: float, col: Color, size: int, priority: int = 0) -> void:
	var lbl := Label3D.new()
	lbl.text = text
	lbl.font_size = size
	lbl.pixel_size = 0.0055
	lbl.modulate = col
	lbl.outline_size = 10
	lbl.outline_modulate = Color(0, 0, 0, 1)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.render_priority = priority
	lbl.position = Vector3(0, y, 0)
	add_child(lbl)

func _hp_color(pct: float) -> Color:
	if pct > 0.5: return Color(0.314, 0.784, 0.471)
	if pct > 0.25: return Color(1.0, 0.82, 0.4)
	return Color(0.902, 0.408, 0.353)
