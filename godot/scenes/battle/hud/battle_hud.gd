extends CanvasLayer
## 전투 HUD — 현 web renderBattle(timelinePanel + actions/skillsel) 대응.
## populate(obs) = battle observation으로 서열(order)·스킬(legalActions) 채움. 빈 obs면 데모 폴백.
## 반복 원자(turn_chip·skill_button)는 별도 씬 인스턴스. 자동전투 버튼=스캐폴드(양측 AI로 완주).
const TURN_CHIP := preload("res://scenes/battle/hud/turn_chip.tscn")
const SKILL_BUTTON := preload("res://scenes/battle/hud/skill_button.tscn")

func _ready() -> void:
	$BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
	$AutoBtn.pressed.connect(func() -> void: GameDirector.auto_battle())

## battle observation으로 HUD 채움. 빈 obs면 데모.
func populate(obs: Dictionary) -> void:
	_clear()
	if obs.is_empty():
		_demo_fill(); return
	# 행동 서열 (order: [{uid, speed}]) + 현재 유닛 표식
	var name_by_uid := {}
	for u in obs.get("allies", []): name_by_uid[str(u.get("uid", ""))] = str(u.get("name", "?"))
	for u in obs.get("enemies", []): name_by_uid[str(u.get("uid", ""))] = str(u.get("name", "?"))
	var cur: Variant = obs.get("current")
	var cur_uid: String = str(cur.get("uid", "")) if cur is Dictionary else ""
	for o in obs.get("order", []):
		var uid := str(o.get("uid", ""))
		var chip := TURN_CHIP.instantiate()
		chip.get_node("Label").text = "%s%s · SPD %d" % ["▶ " if uid == cur_uid else "", name_by_uid.get(uid, "?"), int(o.get("speed", 0))]
		$TurnOrder/V/Entries.add_child(chip)
	# 스킬 (현재 유닛 legalActions의 고유 skillName)
	var seen := {}
	for a in obs.get("legalActions", []):
		var sn := str(a.get("skillName", ""))
		if sn == "" or seen.has(sn): continue
		seen[sn] = true
		var btn := SKILL_BUTTON.instantiate()
		btn.text = sn
		$SkillBar/V/Skills.add_child(btn)

func _clear() -> void:
	for c in $TurnOrder/V/Entries.get_children(): c.queue_free()
	for c in $SkillBar/V/Skills.get_children(): c.queue_free()

func _demo_fill() -> void:
	for nm in ["김두한", "상하이 조", "신영균", "조병옥", "깡패"]:
		var chip := TURN_CHIP.instantiate(); chip.get_node("Label").text = nm
		$TurnOrder/V/Entries.add_child(chip)
	for sk in ["종로의 주먹", "이단 발차기", "오야붕의 위엄", "4달러"]:
		var btn := SKILL_BUTTON.instantiate(); btn.text = sk
		$SkillBar/V/Skills.add_child(btn)
