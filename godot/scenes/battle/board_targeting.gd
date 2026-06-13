extends Node3D
## 보드 칸 타겟팅 오버레이(순수 뷰 + 레이캐스트) — battle.gd가 좌표·legalAction 로직을 소유하고,
## 이 노드는 (1) 주어진 월드 좌표에 하이라이트/명중%/예고 라벨을 그리고 (2) 마우스→칸 레이캐스트로 hover/click 시그널만 올린다.
## web 전투 어포던스 패리티: 타겟가능 칸(2.4)·머리위 명중%(2.7)·호버 HP 예고(빨강)·AoE 풋프린트.
signal cell_hovered(key: String)   # 타겟가능 칸 위로 마우스(벗어나면 "")
signal cell_clicked(key: String)

const C_TARGET := Color(1.0, 0.82, 0.4, 0.45)    # 타겟가능(accent 반투명)
const C_HOVER := Color(1.0, 0.9, 0.55, 0.78)     # 호버 앵커(밝게)
const C_FOOT := Color(0.902, 0.408, 0.353, 0.5)  # AoE 풋프린트(적색)
const C_TXT := Color(0.902, 0.9137, 0.9373)
const PICK_RADIUS := 0.7   # 레이 교차점이 칸 중심에서 이 거리 안이면 그 칸

var _camera: Camera3D
var _active := false
var _targets: Dictionary = {}     # key "row,col,side" → {pos:Vector3, hit:int}
var _hover_key := ""

func setup(camera: Camera3D) -> void:
	_camera = camera

## 타겟팅 시작 — targets = [{key, pos:Vector3, hit:int(또는 -1)}]. 하이라이트 + 명중% 그림.
func show_targets(targets: Array) -> void:
	_active = true
	_targets.clear()
	_hover_key = ""
	_clear_overlays()
	for t in targets:
		var key := str(t.get("key", ""))
		_targets[key] = {"pos": t.get("pos", Vector3.ZERO), "hit": int(t.get("hit", -1))}
		_add_tile(t.get("pos", Vector3.ZERO), C_TARGET, "target_" + key)
		var hit := int(t.get("hit", -1))
		if hit >= 0:
			_add_label("🎯%d%%" % hit, t.get("pos", Vector3.ZERO) + Vector3(0, 2.35, 0), C_TXT, "hit_" + key)

## 호버 미리보기 — footprint = [Vector3](영향 칸), losses = [{pos:Vector3, text:String}](유닛 머리 위 빨강 예고).
func show_preview(anchor_pos: Vector3, footprint: Array, losses: Array) -> void:
	_clear_preview()
	_add_tile(anchor_pos, C_HOVER, "prev_hover")
	for i in footprint.size():
		_add_tile(footprint[i], C_FOOT, "prev_foot_%d" % i)
	for i in losses.size():
		var l: Dictionary = losses[i]
		_add_label(str(l.get("text", "")), l.get("pos", Vector3.ZERO) + Vector3(0.4, 1.95, 0), C_FOOT, "prev_loss_%d" % i)

## 호버 프리뷰만 제거(타겟가능 칸·명중% 하이라이트는 유지). 마우스가 칸 밖으로 나갈 때.
func clear_preview() -> void:
	_clear_preview()

func stop() -> void:
	_active = false
	_targets.clear()
	_hover_key = ""
	_clear_overlays()

## _unhandled_input — HUD(Control/CanvasLayer)가 먼저 소비하므로 버튼 클릭은 보드로 새지 않음.
func _unhandled_input(event: InputEvent) -> void:
	if not _active or _camera == null: return
	if event is InputEventMouseMotion:
		var key := _ray_to_target(event.position)
		if key != _hover_key:
			_hover_key = key
			cell_hovered.emit(key)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var key := _ray_to_target(event.position)
		if key != "": cell_clicked.emit(key)

## 마우스 → y평면 교차 → 타겟가능 칸 중 가장 가까운 것(반경 내). 없으면 "".
func _ray_to_target(mouse: Vector2) -> String:
	var origin := _camera.project_ray_origin(mouse)
	var dir := _camera.project_ray_normal(mouse)
	var hit: Variant = Plane(Vector3.UP, 0.01).intersects_ray(origin, dir)
	if not (hit is Vector3): return ""
	var hit_pos: Vector3 = hit
	var best := ""
	var best_d := PICK_RADIUS
	for key in _targets:
		var cell_pos: Vector3 = _targets[key]["pos"]
		var d: float = (hit_pos - cell_pos).length()
		if d < best_d:
			best_d = d
			best = key
	return best

# ── 오버레이 프리미티브 ──
func _add_tile(pos: Vector3, color: Color, node_name: String) -> void:
	var m := MeshInstance3D.new()
	m.name = node_name
	var q := QuadMesh.new()
	q.size = Vector2(1.12, 1.12)
	q.orientation = PlaneMesh.FACE_Y
	m.mesh = q
	m.material_override = _flat(color)
	m.position = pos + Vector3(0, 0.03, 0)
	add_child(m)

func _add_label(text: String, pos: Vector3, col: Color, node_name: String) -> void:
	var lbl := Label3D.new()
	lbl.name = node_name
	lbl.text = text
	lbl.font_size = 30
	lbl.pixel_size = 0.0055
	lbl.modulate = col
	lbl.outline_size = 10
	lbl.outline_modulate = Color(0, 0, 0, 1)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.position = pos
	add_child(lbl)

func _flat(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return mat

func _clear_overlays() -> void:
	for c in get_children(): c.queue_free()

func _clear_preview() -> void:
	for c in get_children():
		if str(c.name).begins_with("prev_"): c.queue_free()
