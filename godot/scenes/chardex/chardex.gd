extends Control
## 캐릭터 도감 — 현 web charDex.ts. 플레이어 표면이므로 Godot에 잔류(데이터 에디터와 다름).

func _ready() -> void:
	$Center/VBox/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
