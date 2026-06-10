extends CanvasLayer
## 전투 HUD — 현 web renderBattle의 HUD(timelinePanel + actions/skillsel) 대응.
## 정적 레이아웃 = battle_hud.tscn(에디터·디자이너). 동적 내용(서열·스킬·명중%) = 코드가 battle observation에서 채움.
## 반복 원자(turn_chip·skill_button)는 별도 씬을 인스턴스(= 웹 컴포넌트 재사용). 지금은 데모 채움(추후 observation 교체).
const TURN_CHIP := preload("res://scenes/battle/hud/turn_chip.tscn")
const SKILL_BUTTON := preload("res://scenes/battle/hud/skill_button.tscn")

func _ready() -> void:
	$BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
	_demo_fill()

## 데모 채움 — 실데이터는 populate(obs)로 교체 예정.
func _demo_fill() -> void:
	for nm in ["김두한", "상하이 조", "신영균", "조병옥", "깡패"]:
		var chip := TURN_CHIP.instantiate()
		chip.get_node("Label").text = nm
		$TurnOrder/V/Entries.add_child(chip)
	for sk in ["종로의 주먹", "이단 발차기", "오야붕의 위엄", "4달러"]:
		var btn := SKILL_BUTTON.instantiate()
		btn.text = sk
		$SkillBar/V/Skills.add_child(btn)

## (스텁) 전투 관측에서 HUD 채우기 — web renderBattle 대응. R2에서 구현.
func populate(_obs: Dictionary) -> void:
	pass
