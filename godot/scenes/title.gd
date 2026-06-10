extends Control
## 타이틀 — 현 web shell.ts renderTitle. (런 에디터 버튼은 웹 전용이라 없음)

func _ready() -> void:
	$Center/VBox/StartBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
