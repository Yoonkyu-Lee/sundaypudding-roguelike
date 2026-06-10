extends Control
## 보상 선택 — 현 web runRender 보상 phase. GameDirector.view.rewards → 버튼 → choose_reward.

func _ready() -> void:
	var box: VBoxContainer = $Center/VBox/Options
	for c in box.get_children(): c.queue_free()
	var rewards: Variant = GameDirector.view.get("rewards")
	if not (rewards is Array): rewards = []
	for opt in rewards:
		var btn := Button.new()
		btn.text = str(opt.get("label", "보상"))
		btn.pressed.connect(_pick.bind(str(opt.get("id", ""))))
		box.add_child(btn)

func _pick(option_id: String) -> void:
	GameDirector.choose_reward(option_id)
