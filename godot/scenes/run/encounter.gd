extends Control
## 인카운터 — 현 web runRender 인카운터 phase. view.encounter{title,text,choices} → 제목/본문 + 선택지 버튼.

func _ready() -> void:
	var enc: Variant = GameDirector.view.get("encounter")
	if not (enc is Dictionary): enc = {}
	$Center/VBox/Title.text = str(enc.get("title", "인카운터"))
	$Center/VBox/Text.text = str(enc.get("text", ""))
	var box: VBoxContainer = $Center/VBox/Choices
	for c in box.get_children(): c.queue_free()
	var choices: Variant = enc.get("choices")
	if not (choices is Array): choices = []
	for ch in choices:
		var btn := Button.new()
		btn.text = str(ch.get("label", "선택"))
		btn.disabled = not bool(ch.get("available", true))
		btn.pressed.connect(_choose.bind(str(ch.get("id", ""))))
		box.add_child(btn)

func _choose(choice_id: String) -> void:
	GameDirector.encounter(choice_id)
