extends Control
## 런 결과(won/lost) — 현 web 승패 화면. view.phase로 승/패 표시, 허브로 복귀.

func _ready() -> void:
	var phase := str(GameDirector.view.get("phase", "won"))
	var won := phase == "won"
	$Center/VBox/Title.text = "🏆 승리!" if won else "💀 패배"
	$Center/VBox/Msg.text = "런 종료 — 층 %d 도달. (스캐폴드)" % (int(GameDirector.view.get("floor", 0)) + 1)
	$Center/VBox/HubBtn.pressed.connect(func() -> void:
		GameDirector.view = {}  # 런 종료 — 다음 진입 시 새로
		GameDirector.goto(GameDirector.HUB))
