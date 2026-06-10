extends Control
## 캐릭터 도감 — 현 web charDex. 스캐폴드: RunView.party를 캐릭 카드로(이름·HP·스킬).
## (전체 해금 도감은 char_list 명령 + meta 필요 — 후속. 지금은 파티 데이터로 구조 시연.)

func _ready() -> void:
	$Center/VBox/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.HUB))
	if GameDirector.view.is_empty(): GameDirector.bootstrap_demo()
	_render()

func _render() -> void:
	var box: VBoxContainer = $Center/VBox/Chars
	for c in box.get_children(): c.queue_free()
	for m in GameDirector.view.get("party", []):
		var panel := PanelContainer.new()
		var vb := VBoxContainer.new()
		var nm := Label.new()
		nm.text = "%s    %d/%d HP" % [str(m.get("name", "?")), int(m.get("hp", 0)), int(m.get("maxHp", 0))]
		vb.add_child(nm)
		var skill_names := ""
		for s in m.get("skills", []):
			skill_names += (" · " if skill_names != "" else "") + str(s.get("name", ""))
		var sl := Label.new()
		sl.text = "스킬: " + skill_names
		vb.add_child(sl)
		panel.add_child(vb)
		box.add_child(panel)
