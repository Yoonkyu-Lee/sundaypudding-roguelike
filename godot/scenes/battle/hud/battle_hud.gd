extends CanvasLayer
## 전투 하단 HUD — 스케치 레이아웃: 좌=현재 유닛 패널(unit_panel) · 우=툴팁 공간+턴 넘기기+큰 스킬 슬롯.
## 2단계 수동 전투(스킬→타겟, legalActions·명중%) 유지 — 선택 시 action_chosen 시그널 → battle.gd가 battle_step.
## 호버/클릭 상세(스킬·상태·장비)는 전부 툴팁 공간(Label) 한 곳에 표시.
signal action_chosen(action: Dictionary)
signal skill_selected(skill_name: String)   # 스킬 선택 → battle.gd가 보드 칸 타겟팅 시작
signal targeting_cancelled()

const TURN_CHIP := preload("res://scenes/battle/hud/turn_chip.tscn")
const Tips := preload("res://scenes/battle/hud/tips.gd")
const TIP_IDLE := "아이콘·스킬·장비에 마우스를 올리면 자세한 정보가 표시됩니다."

var _obs: Dictionary = {}

@onready var _unit_panel := $Bar/Cols/UnitPanel
@onready var _tooltip: Label = $Bar/Cols/Center/TopRow/Tooltip
@onready var _skip_btn: Button = $Bar/Cols/Center/TopRow/SkipBtn
@onready var _skills: HBoxContainer = $Bar/Cols/Center/Skills

func _ready() -> void:
	$BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
	$AutoBtn.pressed.connect(func() -> void: GameDirector.auto_battle())
	_skip_btn.pressed.connect(_emit.bind({"type": "skip"}))
	_skip_btn.add_theme_stylebox_override("normal", _slot_box(Color(0.1137, 0.1254, 0.1568, 1), Color(0.2, 0.2274, 0.2823, 1)))
	_skip_btn.add_theme_stylebox_override("hover", _slot_box(Color(0.18, 0.205, 0.255, 1), Color(1, 0.8196, 0.4, 1)))
	_skip_btn.add_theme_stylebox_override("pressed", _slot_box(Color(0.1, 0.115, 0.15, 1), Color(1, 0.8196, 0.4, 1)))
	_unit_panel.tip.connect(_tip)

func populate(obs: Dictionary) -> void:
	_obs = obs
	_tip(TIP_IDLE)
	_render_unit_panel()
	_render_order()
	_render_skills()

## 라운드 시작 SPD 주사위 연출 위임 — rs=roundStart 이벤트, obs로 이름/진영 매핑. 끝나면 on_done.
func play_dice(rs: Dictionary, obs: Dictionary, on_done: Callable) -> void:
	var names := {}
	var sides := {}
	for u in obs.get("allies", []):
		names[str(u.get("uid", ""))] = str(u.get("name", "?")); sides[str(u.get("uid", ""))] = "ally"
	for u in obs.get("enemies", []):
		names[str(u.get("uid", ""))] = str(u.get("name", "?")); sides[str(u.get("uid", ""))] = "enemy"
	var order_uids := []
	for o in rs.get("order", []): order_uids.append(str(o.get("uid", "")))
	$DiceRoll.play(int(rs.get("round", 1)), rs.get("rolls", []), order_uids, names, sides, on_done)

func _tip(text: String) -> void:
	_tooltip.text = text

# ── 현재 유닛 패널(좌측) ──
func _render_unit_panel() -> void:
	var cur := _current_unit()
	if cur.is_empty(): return
	var uid := str(cur.get("uid", ""))
	var sheet_unit := {}
	for su in GameDirector.sheet_data().get("battleUnits", []):
		if su is Dictionary and str(su.get("uid", "")) == uid:
			sheet_unit = su
			break
	_unit_panel.populate(cur, sheet_unit)

## obs.current.uid → allies/enemies에서 UnitView 검색.
func _current_unit() -> Dictionary:
	var c: Variant = _obs.get("current")
	if not (c is Dictionary): return {}
	var uid := str(c.get("uid", ""))
	for u in _obs.get("allies", []) + _obs.get("enemies", []):
		if u is Dictionary and str(u.get("uid", "")) == uid: return u
	return {}

# ── 행동 서열(우상단) ──
func _render_order() -> void:
	for c in $TurnOrder/V/Entries.get_children(): c.queue_free()
	var names := _names()
	var cur: Variant = _obs.get("current")
	var cur_uid: String = str(cur.get("uid", "")) if cur is Dictionary else ""
	for o in _obs.get("order", []):
		var uid := str(o.get("uid", ""))
		var chip := TURN_CHIP.instantiate()
		chip.get_node("Label").text = "%s%s · SPD %d" % ["▶ " if uid == cur_uid else "", names.get(uid, "?"), int(o.get("speed", 0))]
		$TurnOrder/V/Entries.add_child(chip)

# ── 스킬 슬롯(1단계) — 큰 버튼, 호버=툴팁 공간에 스킬 상세 ──
func _render_skills() -> void:
	_clear_skills()
	var cur: Variant = _obs.get("current")
	var my_turn: bool = cur is Dictionary and str(cur.get("side", "")) == "ally"
	_skip_btn.disabled = not my_turn
	if not my_turn:
		_tip("적 턴 — 자동 진행 중…")
		return
	_tip("%s의 턴 — 스킬을 선택하세요." % str(cur.get("name", "?")))
	var skills: Dictionary = GameDirector.content("skills")
	var statuses: Dictionary = GameDirector.content("statuses")
	var seen := {}
	for a in _obs.get("legalActions", []):
		var sn := str(a.get("skillName", ""))
		if sn == "" or seen.has(sn): continue
		seen[sn] = true
		var sid := str(a.get("action", {}).get("skillId", ""))
		var btn := _slot_button(sn)
		var t: String = Tips.skill(skills.get(sid, {}), statuses)
		btn.mouse_entered.connect(_tip.bind(t if t != "" else sn))
		btn.pressed.connect(_choose_skill.bind(sn))
		_skills.add_child(btn)

# ── 타겟(2단계) — 보드 칸 클릭으로 선택. HUD는 안내 + 취소만. ──
func _choose_skill(skill_name: String) -> void:
	_clear_skills()
	_tip("🎯 「%s」 대상 선택 — 보드의 빛나는 칸을 클릭하세요." % skill_name)
	_skip_btn.disabled = true
	var cancel := _slot_button("← 취소")
	cancel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	cancel.custom_minimum_size = Vector2(160, 0)
	cancel.pressed.connect(func() -> void:
		targeting_cancelled.emit()
		_render_skills())
	_skills.add_child(cancel)
	skill_selected.emit(skill_name)

## 큰 스킬 슬롯 버튼(스케치: 하단을 채우는 4분할) — 가로 균등 확장.
## chamfer 바와 통일: 둥근 모서리 대신 각진 플랫 슬롯(테두리=구역 분리, 빈틈 0).
func _slot_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 22)
	b.add_theme_stylebox_override("normal", _slot_box(Color(0.1137, 0.1254, 0.1568, 1), Color(0.2, 0.2274, 0.2823, 1)))
	b.add_theme_stylebox_override("hover", _slot_box(Color(0.18, 0.205, 0.255, 1), Color(1, 0.8196, 0.4, 1)))
	b.add_theme_stylebox_override("pressed", _slot_box(Color(0.1, 0.115, 0.15, 1), Color(1, 0.8196, 0.4, 1)))
	return b

## 각진 플랫 슬롯 스타일(둥근 모서리 0, 1px 테두리) — chamfer 크롬과 결 맞춤.
func _slot_box(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_border_width_all(1)
	s.border_color = border
	s.set_corner_radius_all(0)
	s.content_margin_top = 10
	s.content_margin_bottom = 10
	return s

func _emit(action: Dictionary) -> void:
	action_chosen.emit(action)

func _clear_skills() -> void:
	for c in _skills.get_children(): c.queue_free()

func _names() -> Dictionary:
	var m := {}
	for u in _obs.get("allies", []): m[str(u.get("uid", ""))] = str(u.get("name", "?"))
	for u in _obs.get("enemies", []): m[str(u.get("uid", ""))] = str(u.get("name", "?"))
	return m
