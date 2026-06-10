extends Control
## 캠페인 런 선택 + 로스터 미리보기 — 현 web shell.ts renderHub(campaign). 주인공 고정.

func _ready() -> void:
	$Center/VBox/StartRunBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
	$Center/VBox/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
