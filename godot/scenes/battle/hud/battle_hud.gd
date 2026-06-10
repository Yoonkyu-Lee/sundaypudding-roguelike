extends CanvasLayer
## 전투 HUD — 현 web renderBattle(timelinePanel + actions/skillsel) 대응.
## 행동 서열(order)·2단계 수동 전투(스킬→타겟, legalActions·명중%). 선택 시 action_chosen 시그널 → battle.gd가 battle_step.
## 빈 obs면 데모. 자동전투 버튼=스캐폴드(양측 AI 완주).
signal action_chosen(action: Dictionary)

const TURN_CHIP := preload("res://scenes/battle/hud/turn_chip.tscn")
const SKILL_BUTTON := preload("res://scenes/battle/hud/skill_button.tscn")

var _obs: Dictionary = {}

func _ready() -> void:
	$BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
	$AutoBtn.pressed.connect(func() -> void: GameDirector.auto_battle())

func populate(obs: Dictionary) -> void:
	_obs = obs
	_render_order()
	_render_skills()

# ── 행동 서열 ──
func _render_order() -> void:
	for c in $TurnOrder/V/Entries.get_children(): c.queue_free()
	if _obs.is_empty():
		for nm in ["김두한", "상하이 조", "신영균", "조병옥", "깡패"]:
			var ch := TURN_CHIP.instantiate(); ch.get_node("Label").text = nm
			$TurnOrder/V/Entries.add_child(ch)
		return
	var names := _names()
	var cur: Variant = _obs.get("current")
	var cur_uid: String = str(cur.get("uid", "")) if cur is Dictionary else ""
	for o in _obs.get("order", []):
		var uid := str(o.get("uid", ""))
		var chip := TURN_CHIP.instantiate()
		chip.get_node("Label").text = "%s%s · SPD %d" % ["▶ " if uid == cur_uid else "", names.get(uid, "?"), int(o.get("speed", 0))]
		$TurnOrder/V/Entries.add_child(chip)

# ── 스킬(1단계) ──
func _render_skills() -> void:
	_clear_skills()
	if _obs.is_empty():
		$SkillBar/V/Title.text = "스킬 선택"
		for sk in ["종로의 주먹", "이단 발차기", "오야붕의 위엄", "4달러"]:
			var b := SKILL_BUTTON.instantiate(); b.text = sk
			$SkillBar/V/Skills.add_child(b)
		return
	var cur: Variant = _obs.get("current")
	if not (cur is Dictionary) or str(cur.get("side", "")) != "ally":
		$SkillBar/V/Title.text = "적 턴 — 자동 진행"
		var l := Label.new(); l.text = "(상단 ⚔ 자동 전투로 진행)"
		$SkillBar/V/Skills.add_child(l)
		return
	$SkillBar/V/Title.text = "스킬 선택 — %s의 턴" % str(cur.get("name", "?"))
	var seen := {}
	for a in _obs.get("legalActions", []):
		var sn := str(a.get("skillName", ""))
		if sn == "" or seen.has(sn): continue
		seen[sn] = true
		var btn := SKILL_BUTTON.instantiate(); btn.text = sn
		btn.pressed.connect(_choose_skill.bind(sn))
		$SkillBar/V/Skills.add_child(btn)
	var skip := SKILL_BUTTON.instantiate(); skip.text = "⏭ 대기"
	skip.pressed.connect(_emit.bind({"type": "skip"}))
	$SkillBar/V/Skills.add_child(skip)

# ── 타겟(2단계) ──
func _choose_skill(skill_name: String) -> void:
	_clear_skills()
	$SkillBar/V/Title.text = "타겟 선택 — %s" % skill_name
	var names := _names()
	for a in _obs.get("legalActions", []):
		if str(a.get("skillName", "")) != skill_name: continue
		var tuid := str(a.get("targetUid", ""))
		var tlabel: String = names.get(tuid, "") if tuid != "" else str(a.get("label", "대상"))
		if tlabel == "": tlabel = str(a.get("label", "대상"))
		var btn := SKILL_BUTTON.instantiate()
		btn.text = "%s (%d%%)" % [tlabel, int(a.get("hitChance", 0))]
		btn.pressed.connect(_emit.bind(a.get("action", {})))
		$SkillBar/V/Skills.add_child(btn)
	var cancel := SKILL_BUTTON.instantiate(); cancel.text = "← 취소"
	cancel.pressed.connect(_render_skills)
	$SkillBar/V/Skills.add_child(cancel)

func _emit(action: Dictionary) -> void:
	action_chosen.emit(action)

func _clear_skills() -> void:
	for c in $SkillBar/V/Skills.get_children(): c.queue_free()

func _names() -> Dictionary:
	var m := {}
	for u in _obs.get("allies", []): m[str(u.get("uid", ""))] = str(u.get("name", "?"))
	for u in _obs.get("enemies", []): m[str(u.get("uid", ""))] = str(u.get("name", "?"))
	return m
