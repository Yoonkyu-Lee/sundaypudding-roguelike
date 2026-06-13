extends CanvasLayer
## 전투 HUD — Figma 디자인(1번) 이식. 좌상단 행동서열 토큰 스트립 · 좌하단 유닛패널 · 중앙 툴팁+스킬카드 · 우 턴넘김.
## 2단계 수동 전투(스킬 카드→보드 칸 타겟): 카드 선택 시 skill_selected → battle.gd가 보드 타겟팅. 호버 상세=툴팁 한 곳.
signal action_chosen(action: Dictionary)
signal skill_selected(skill_name: String)
signal targeting_cancelled()

const Tips := preload("res://scenes/battle/hud/tips.gd")
const TIP_IDLE := "아이콘·스킬에 마우스를 올리면 자세한 정보가 표시됩니다."
const C_PANEL := Color(0.1137, 0.1254, 0.1568, 1)
const C_PANEL2 := Color(0.145, 0.165, 0.212, 1)
const C_LINE := Color(0.2, 0.2274, 0.2823, 1)
const C_ACCENT := Color(1, 0.8196, 0.4, 1)
const C_MINT := Color(0.45, 0.92, 0.78, 1)         # 끼어들기 턴 하이라이트
const C_MINT_FAINT := Color(0.45, 0.92, 0.78, 0.45) # 끼어들기 잔상(턴 끝나도 남는 옅은 테두리)
const C_TXT := Color(0.95, 0.96, 0.98, 1)

var _obs: Dictionary = {}

@onready var _unit_panel := $UnitPanel
@onready var _tooltip: Label = $Tooltip/Label
@onready var _skip_btn: Button = $EndTurn
@onready var _skills: HBoxContainer = $Skills/Box
@onready var _tokens: VBoxContainer = $TurnOrder/Tokens

func _ready() -> void:
	$BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
	$AutoBtn.pressed.connect(func() -> void: GameDirector.auto_battle())
	_skip_btn.pressed.connect(_emit.bind({"type": "skip"}))
	_skip_btn.text = "⏭\n턴 넘기기"
	_skip_btn.add_theme_font_size_override("font_size", 16)
	_skip_btn.add_theme_stylebox_override("normal", _box(C_PANEL2, C_ACCENT, 1.5))
	_skip_btn.add_theme_stylebox_override("hover", _box(Color(0.2, 0.18, 0.12), C_ACCENT, 2))
	_skip_btn.add_theme_stylebox_override("pressed", _box(Color(0.12, 0.11, 0.08), C_ACCENT, 2))
	_unit_panel.tip.connect(_tip)

func populate(obs: Dictionary) -> void:
	_obs = obs
	_tip(TIP_IDLE)
	_render_unit_panel()
	_render_order()
	_render_skills()

## 라운드 시작 SPD 주사위 연출 위임.
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

# ── 현재 유닛 패널(좌하단) ──
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

func _current_unit() -> Dictionary:
	var c: Variant = _obs.get("current")
	if not (c is Dictionary): return {}
	var uid := str(c.get("uid", ""))
	for u in _obs.get("allies", []) + _obs.get("enemies", []):
		if u is Dictionary and str(u.get("uid", "")) == uid: return u
	return {}

# ── 행동서열 토큰 스트립(좌상단, 세로) — 현재 턴 토큰만 크게+accent ──
## 현재 턴 = cursorIndex(인덱스)로 판정. uid 매칭 금지 — 끼어들기/정규가 같은 uid라 둘 다 켜지던 버그.
func _render_order() -> void:
	for c in _tokens.get_children(): c.queue_free()
	var names := _names()
	var cursor := int(_obs.get("cursorIndex", -1))
	var order: Array = _obs.get("order", [])
	for i in order.size():
		var o: Dictionary = order[i]
		var uid := str(o.get("uid", ""))
		_tokens.add_child(_make_token(names.get(uid, "?"), int(o.get("speed", 0)), i == cursor, str(o.get("kind", "normal"))))

## 토큰 = PanelContainer(테두리·여백) + 라벨. 현재=크게+accent, 나머지=작게.
## kind=="interrupt" → 민트 하이라이트(현재) / 옅은 민트 잔상 테두리(대기·종료). 정규=accent(현재)/회색(그외).
func _make_token(nm: String, spd: int, is_current: bool, kind: String) -> Control:
	var interrupt := kind == "interrupt"
	var accent := C_MINT if interrupt else C_ACCENT
	var border := accent if is_current else (C_MINT_FAINT if interrupt else C_LINE)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(C_PANEL2 if is_current else C_PANEL, border, 2.0 if is_current else 1.0))
	p.custom_minimum_size = Vector2(176 if is_current else 150, 0)
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	p.add_child(box)
	if is_current:
		box.add_child(_lbl("▶ " + nm, 16, C_TXT))
		box.add_child(_lbl("끼어들기!" if interrupt else "SPD %d · 현재 턴" % spd, 12, accent))
	elif interrupt:
		box.add_child(_lbl("%s · 끼어들기" % nm, 14, C_MINT))
	else:
		box.add_child(_lbl("%s · SPD %d" % [nm, spd], 14, Color(0.72, 0.74, 0.79)))
	return p

# ── 스킬 카드(중앙 하단, 아이콘+이름) — 1단계 ──
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
		var sk: Dictionary = skills.get(str(a.get("action", {}).get("skillId", "")), {})
		var t: String = Tips.skill(sk, statuses)
		var card := _make_card(sn, _skill_icon(sk))
		card.mouse_entered.connect(_tip.bind(t if t != "" else sn))
		card.pressed.connect(_choose_skill.bind(sn))
		_skills.add_child(card)

# ── 타겟(2단계) — 보드 칸 클릭. 카드 줄은 취소만. ──
func _choose_skill(skill_name: String) -> void:
	_clear_skills()
	_tip("🎯 「%s」 대상 선택 — 보드의 빛나는 칸을 클릭하세요." % skill_name)
	_skip_btn.disabled = true
	var cancel := _make_card("취소", "✕")
	cancel.pressed.connect(func() -> void:
		targeting_cancelled.emit()
		_render_skills())
	_skills.add_child(cancel)
	skill_selected.emit(skill_name)

## 스킬 카드 = Button(각진 플랫) + 아이콘 라벨(상) + 이름 라벨(하). 가로 균등 확장.
func _make_card(nm: String, icon: String) -> Button:
	var b := Button.new()
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_FILL
	b.add_theme_stylebox_override("normal", _box(C_PANEL, C_LINE, 1.5))
	b.add_theme_stylebox_override("hover", _box(Color(0.18, 0.205, 0.255), C_ACCENT, 1.5))
	b.add_theme_stylebox_override("pressed", _box(Color(0.1, 0.115, 0.15), C_ACCENT, 1.5))
	var ic := _lbl(icon, 32, C_TXT)
	ic.set_anchors_preset(Control.PRESET_TOP_WIDE)
	ic.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ic.offset_top = 16; ic.offset_bottom = 64
	b.add_child(ic)
	var nl := _lbl(nm, 14, C_TXT)
	nl.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nl.offset_top = -40; nl.offset_bottom = -14
	b.add_child(nl)
	return b

## 스킬 아이콘(데이터에 아이콘 없음) — 대상별 플레이스홀더(애셋 들어오면 교체).
func _skill_icon(sk: Dictionary) -> String:
	match str(sk.get("target", "enemy")):
		"ally": return "✚"
		"self": return "🛡"
		_: return "⚔"

# ── 헬퍼 ──
func _lbl(text: String, size: int, col: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	return l

func _box(bg: Color, border: Color, bw: float) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_border_width_all(int(bw))
	s.border_color = border
	s.set_corner_radius_all(0)
	s.content_margin_left = 12; s.content_margin_right = 12
	s.content_margin_top = 8; s.content_margin_bottom = 8
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
