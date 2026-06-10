extends Control
## 캠페인 런 선택 — 현 web shell.ts renderHub(campaign). 엔진의 run_list로 실제 런 목록.

func _ready() -> void:
	$Center/VBox/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
	var box: VBoxContainer = $Center/VBox/Runs
	for c in box.get_children(): c.queue_free()
	for r in GameDirector.run_list():
		var btn := Button.new()
		btn.text = str(r.get("name", r.get("id", "런")))
		btn.pressed.connect(_start.bind(str(r.get("id", ""))))
		box.add_child(btn)

func _start(run_id: String) -> void:
	GameDirector.start_run(run_id)  # 세션 생성 + phase 라우팅
