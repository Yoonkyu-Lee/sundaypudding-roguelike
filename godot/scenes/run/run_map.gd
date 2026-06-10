extends Control
## 런 맵 — RunView.nodes(q,r 헥스)+edges를 2D 그래프로 렌더 (web runRender 모방).
## 노드=버튼(type 아이콘+라벨, status 색, 도달가능만 클릭→enter_node), 엣지=Line2D. pointy-top axial.

const HEX := 60.0
const NODE_W := 104.0
const NODE_H := 60.0
const TYPE_ICON := {"start": "📍", "battle": "⚔️", "elite": "💀", "shop": "🛒", "encounter": "❓", "rest": "🏕️", "boss": "👑", "clear": "🚩"}
const STATUS_COL := {
	"current": Color(1, 0.82, 0.4), "active": Color(1, 0.82, 0.4),
	"reachable": Color(0.9, 0.91, 0.94), "visited": Color(0.5, 0.55, 0.6), "locked": Color(0.3, 0.33, 0.4),
}

func _ready() -> void:
	$Header/HubBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
	if GameDirector.view.is_empty(): GameDirector.bootstrap_demo()  # 단독 실행/캡처용
	_render()

func _hex_to_px(q: int, r: int) -> Vector2:
	return Vector2(sqrt(3.0) * HEX * (q + r / 2.0), HEX * 1.5 * r)

func _render() -> void:
	var v := GameDirector.view
	$Header/Floor.text = "층 %d / %d" % [int(v.get("floor", 0)) + 1, int(v.get("totalFloors", 1))]
	var graph: Control = $Graph
	for c in graph.get_children(): c.queue_free()
	var nodes: Variant = v.get("nodes")
	if not (nodes is Array) or nodes.is_empty(): return
	# 좌표 + 바운드
	var pos := {}
	var mn := Vector2(INF, INF)
	var mx := Vector2(-INF, -INF)
	for n in nodes:
		var p := _hex_to_px(int(n.get("q", 0)), int(n.get("r", 0)))
		pos[str(n.get("id", ""))] = p
		mn = mn.min(p); mx = mx.max(p)
	graph.position = get_viewport_rect().size / 2.0 - (mn + mx) / 2.0  # 중앙 정렬
	# 엣지(뒤)
	var edges: Variant = v.get("edges")
	if edges is Array:
		for e in edges:
			var a = pos.get(str(e.get("from", "")))
			var b = pos.get(str(e.get("to", "")))
			if a == null or b == null: continue
			var line := Line2D.new()
			line.points = PackedVector2Array([a, b])
			line.width = 3.0
			line.default_color = Color(0.2, 0.227, 0.282)
			graph.add_child(line)
	# 노드 버튼(앞)
	for n in nodes:
		var id := str(n.get("id", ""))
		var status := str(n.get("status", ""))
		var ntype := str(n.get("type", ""))
		var btn := Button.new()
		btn.custom_minimum_size = Vector2(NODE_W, NODE_H)
		btn.size = Vector2(NODE_W, NODE_H)
		btn.text = "%s\n%s" % [TYPE_ICON.get(ntype, "•"), str(n.get("label", ntype))]
		btn.modulate = STATUS_COL.get(status, Color(0.6, 0.6, 0.6))
		btn.disabled = status != "reachable"
		btn.position = pos[id] - Vector2(NODE_W, NODE_H) / 2.0
		btn.pressed.connect(_enter.bind(id))
		graph.add_child(btn)

func _enter(node_id: String) -> void:
	GameDirector.enter_node(node_id)  # 변이 + phase 라우팅
