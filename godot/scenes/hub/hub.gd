extends Control
## 허브 — 모드 선택. 현 web shell.ts renderHub(menu). 데이터 에디터는 웹이므로 여기 없음.

func _ready() -> void:
	$Center/VBox/CampaignBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.CAMPAIGN))
	$Center/VBox/CharDexBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.CHARDEX))
	$Center/VBox/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.TITLE))
