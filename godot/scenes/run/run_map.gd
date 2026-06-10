extends Control
## 런 맵 — RunView.nodes(q,r)+edges 벌집 렌더 (web mapScreen 모방).
## 노드=육각 타일(어두운 몸체 + status 색 테두리), 막힌 길=벽(Line2D #b0413b), 도달가능=발광 테두리·클릭→enter_node.
## 연결선은 그리지 않음(web와 동일 — reachable 발광으로 길 표시). pointy-top axial.

const SIZE := 46.0
const W := 1.7320508 * SIZE   # sqrt(3)*SIZE — 헥스 폭(평행변)
const INNER := 0.85           # 안쪽(몸체) 헥스 축소 → 테두리 링 두께

const TYPE_ICON := {"start": "📍", "battle": "⚔️", "elite": "💀", "shop": "🛒", "encounter": "❓", "rest": "🏕️", "boss": "👑", "clear": "🚩"}
const TYPE_NAME := {"start": "시작", "battle": "전투", "elite": "정예", "shop": "상점", "encounter": "조우", "rest": "휴식", "boss": "보스", "clear": "클리어"}

# 테마 팔레트
const LINE := Color(0.2, 0.227, 0.282)
const ACCENT := Color(1.0, 0.82, 0.4)
const GREEN := Color(0.314, 0.784, 0.471)
const ENEMY := Color(0.902, 0.408, 0.353)
const WHITE := Color(1, 1, 1)
const PANEL2 := Color(0.145, 0.165, 0.212)
const WALL := Color(0.69, 0.255, 0.231)   # #b0413b
const DIM := Color(0.545, 0.576, 0.655)
const TXT := Color(0.902, 0.914, 0.937)

# .mhex 몸체 색(status/type별)
const BODY_REACH := Color(0.169, 0.184, 0.239)
const BODY_CURRENT := Color(0.184, 0.212, 0.278)
const BODY_VISITED := Color(0.118, 0.169, 0.133)
const BODY_BOSS := Color(0.227, 0.141, 0.141)
const BODY_CLEAR := Color(0.137, 0.227, 0.169)

# 변 i(꼭짓점 i→i+1)가 접한 이웃 방향. _hexagon 순서(top→ur→lr→bottom→ll→ul)와 일치.
const EDGE_DIRS := [Vector2i(1, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 1), Vector2i(-1, 0), Vector2i(0, -1)]

func _ready() -> void:
	$Header/HubBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
	if GameDirector.view.is_empty(): GameDirector.bootstrap_demo()  # 단독 실행/캡처용
	_render()

## 셀 중심(필드 로컬). pointy-top axial: x=W*(q+r/2), y=1.5*SIZE*r.
func _hex_to_px(q: int, r: int) -> Vector2:
	return Vector2(W * (q + r / 2.0), SIZE * 1.5 * r)

## 중심 기준 6 꼭짓점(top→ur→lr→bottom→ll→ul). web cornerOffsets와 동일.
func _hexagon(size: float) -> PackedVector2Array:
	var w := 1.7320508 * size
	var s2 := size / 2.0
	return PackedVector2Array([
		Vector2(0, -size), Vector2(w / 2, -s2), Vector2(w / 2, s2),
		Vector2(0, size), Vector2(-w / 2, s2), Vector2(-w / 2, -s2),
	])

func _render() -> void:
	var v := GameDirector.view
	$Header/Floor.text = "층 %d / %d" % [int(v.get("floor", 0)) + 1, int(v.get("totalFloors", 1))]
	var graph: Control = $Graph
	for c in graph.get_children(): c.queue_free()
	var nodes: Variant = v.get("nodes")
	if not (nodes is Array) or nodes.is_empty(): return

	# 중심좌표 + 바운드
	var ctr := {}
	var mn := Vector2(INF, INF)
	var mx := Vector2(-INF, -INF)
	for n in nodes:
		var p := _hex_to_px(int(n.get("q", 0)), int(n.get("r", 0)))
		ctr[str(n.get("id", ""))] = p
		mn = mn.min(p); mx = mx.max(p)
	graph.position = get_viewport_rect().size / 2.0 - (mn + mx) / 2.0  # 콘텐츠 중앙 정렬

	# 노드 타일(테두리 + 몸체 + 아이콘/라벨 + 도달가능 클릭버튼)
	for n in nodes:
		_draw_node(graph, n, ctr[str(n.get("id", ""))])

	# 벽(막힌 길) — 인접하지만 변 없는 노드쌍. 노드 위에.
	_draw_walls(graph, nodes, ctr)

func _draw_node(graph: Control, n: Dictionary, c: Vector2) -> void:
	var id := str(n.get("id", ""))
	var status := str(n.get("status", ""))
	var ntype := str(n.get("type", ""))
	var dim_locked := status == "locked"

	# 테두리(바깥 헥스)
	var rim := Polygon2D.new()
	rim.polygon = _hexagon(SIZE)
	rim.position = c
	rim.color = _rim_color(status, ntype)
	if dim_locked: rim.modulate = Color(1, 1, 1, 0.4)
	graph.add_child(rim)
	# 몸체(안쪽 헥스)
	var body := Polygon2D.new()
	body.polygon = _hexagon(SIZE * INNER)
	body.position = c
	body.color = _body_color(status, ntype)
	if dim_locked: body.modulate = Color(1, 1, 1, 0.4)
	graph.add_child(body)
	# 아이콘 + 라벨(세로 스택, 중앙)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 1)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.size = Vector2(W, SIZE * 2)
	box.position = c - Vector2(W / 2, SIZE)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ico := Label.new()
	ico.text = str(TYPE_ICON.get(ntype, "•"))
	ico.add_theme_font_size_override("font_size", 22)
	ico.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(ico)
	var lbl := Label.new()
	lbl.text = str(n.get("label", TYPE_NAME.get(ntype, ntype)))
	lbl.add_theme_font_size_override("font_size", 11)
	lbl.add_theme_color_override("font_color", _txt_color(status))
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(lbl)
	if dim_locked: box.modulate = Color(1, 1, 1, 0.4)
	graph.add_child(box)
	# 상태 마커
	if status == "visited": _marker(graph, c, "✓", GREEN)
	elif status == "current": _marker(graph, c, "▾", WHITE)

	# 도달가능만 클릭(투명 버튼 — 몸체 영역)
	if status == "reachable":
		var btn := Button.new()
		btn.flat = true
		btn.size = Vector2(W, SIZE * 1.5)
		btn.position = c - Vector2(W / 2, SIZE * 0.75)
		btn.modulate = Color(1, 1, 1, 0)  # 투명(시각=헥스)
		btn.tooltip_text = ""
		btn.pressed.connect(_enter.bind(id))
		graph.add_child(btn)

func _marker(graph: Control, c: Vector2, glyph: String, col: Color) -> void:
	var m := Label.new()
	m.text = glyph
	m.add_theme_font_size_override("font_size", 13)
	m.add_theme_color_override("font_color", col)
	m.position = c - Vector2(6, SIZE - 4)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	graph.add_child(m)

func _draw_walls(graph: Control, nodes: Array, ctr: Dictionary) -> void:
	# 열린 길(edge) 집합 — 무방향 키
	var connected := {}
	for e in GameDirector.view.get("edges", []):
		var a := str(e.get("from", "")); var b := str(e.get("to", ""))
		connected[a + "|" + b] = true; connected[b + "|" + a] = true
	var corners := _hexagon(SIZE)
	for i in nodes.size():
		for j in range(i + 1, nodes.size()):
			var a: Dictionary = nodes[i]; var b: Dictionary = nodes[j]
			var dq := int(b.get("q", 0)) - int(a.get("q", 0))
			var dr := int(b.get("r", 0)) - int(a.get("r", 0))
			if not _adjacent(dq, dr): continue
			var ka := str(a.get("id", "")) + "|" + str(b.get("id", ""))
			if connected.has(ka): continue  # 열린 길 — 벽 아님
			var ei := _edge_dir_index(dq, dr)
			if ei < 0: continue
			var ca: Vector2 = ctr[str(a.get("id", ""))]
			var wall := Line2D.new()
			wall.points = PackedVector2Array([ca + corners[ei], ca + corners[(ei + 1) % 6]])
			wall.width = 4.0
			wall.default_color = WALL
			wall.begin_cap_mode = Line2D.LINE_CAP_ROUND
			wall.end_cap_mode = Line2D.LINE_CAP_ROUND
			graph.add_child(wall)

func _adjacent(dq: int, dr: int) -> bool:
	return (abs(dq) + abs(dr) + abs(dq + dr)) / 2 == 1

func _edge_dir_index(dq: int, dr: int) -> int:
	for i in EDGE_DIRS.size():
		if EDGE_DIRS[i].x == dq and EDGE_DIRS[i].y == dr: return i
	return -1

func _rim_color(status: String, ntype: String) -> Color:
	if status == "reachable" or status == "active":
		if ntype == "boss": return ENEMY
		if ntype == "clear": return GREEN
		return ACCENT
	if status == "current": return WHITE
	if status == "visited": return GREEN
	if ntype == "clear": return GREEN
	return LINE

func _body_color(status: String, ntype: String) -> Color:
	if ntype == "boss": return BODY_BOSS
	if ntype == "clear": return BODY_CLEAR
	if status == "current": return BODY_CURRENT
	if status == "reachable": return BODY_REACH
	if status == "visited": return BODY_VISITED
	return PANEL2

func _txt_color(status: String) -> Color:
	return TXT if (status == "reachable" or status == "current") else DIM

func _enter(node_id: String) -> void:
	GameDirector.enter_node(node_id)  # 변이 + phase 라우팅
