extends Control
## 런 맵(노드 그래프, 비전투) — 현 web runRender.ts. 노드 진입 → 전투/보상/상점/인카운터.
## 보상·상점·인카운터는 같은 폴더의 하위 씬(reward/shop/encounter)을 오버레이로 띄울 예정.

func _ready() -> void:
	$Center/VBox/EnterBattleBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.BATTLE))
	$Center/VBox/HubBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
