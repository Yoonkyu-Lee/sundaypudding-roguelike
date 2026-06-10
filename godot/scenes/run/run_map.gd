extends Control
## 런 맵(노드 그래프) — 현 web runRender.ts. GameDirector.view.nodes를 버튼으로(도달가능=활성→enter_node).
## (헥스 좌표 q·r 시각배치는 후속 — 지금은 데이터 구동 노드 리스트.)

func _ready() -> void:
	$Center/VBox/HubBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
	_render()

func _render() -> void:
	var v := GameDirector.view
	$Center/VBox/Floor.text = "층 %d / %d" % [int(v.get("floor", 0)) + 1, int(v.get("totalFloors", 1))]
	var box: VBoxContainer = $Center/VBox/Nodes
	for c in box.get_children(): c.queue_free()
	var nodes: Variant = v.get("nodes")
	if not (nodes is Array): nodes = []
	for n in nodes:
		var status := str(n.get("status", ""))
		var btn := Button.new()
		btn.text = "%s  〈%s · %s〉" % [str(n.get("label", n.get("type", "?"))), str(n.get("type", "")), status]
		btn.disabled = status != "reachable"
		btn.pressed.connect(_enter.bind(str(n.get("id", ""))))
		box.add_child(btn)

func _enter(node_id: String) -> void:
	GameDirector.enter_node(node_id)  # 변이 + phase 라우팅(전투/보상/상점/인카운터/…)
