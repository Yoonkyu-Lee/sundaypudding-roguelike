extends Control
## 상점 — 현 web runRender 상점 phase. GameDirector.view.shop → 버튼(가격) → buy. 나가기 → leave_shop.

func _ready() -> void:
	$Center/VBox/LeaveBtn.pressed.connect(func() -> void: GameDirector.leave_shop())
	$Center/VBox/Gold.text = "골드: %d" % int(GameDirector.view.get("gold", 0))
	var box: VBoxContainer = $Center/VBox/Offers
	for c in box.get_children(): c.queue_free()
	var offers: Variant = GameDirector.view.get("shop")
	if not (offers is Array): offers = []
	for o in offers:
		var btn := Button.new()
		btn.text = "%s  (%d골드)" % [str(o.get("label", "")), int(o.get("cost", 0))]
		btn.pressed.connect(_buy.bind(str(o.get("id", ""))))
		box.add_child(btn)

func _buy(offer_id: String) -> void:
	GameDirector.buy(offer_id)
