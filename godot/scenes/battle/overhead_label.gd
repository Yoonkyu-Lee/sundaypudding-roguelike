extends VBoxContainer
## 유닛 머리위 2D 오버레이(해법 B) — CanvasLayer 위 Control. battle.gd가 매 프레임 카드 머리 월드→화면 투영으로 위치 갱신.
## 화면 공간이라 항상 선명·일정 크기·중심 정렬·겹침 제어. 위→아래: 명중% → 상태이상 칩 → 이름 → HP바(유닛에 가장 가까움).
## 명중%·체력 까임 프리뷰는 타겟팅 중 battle.gd가 show_hit/show_loss로 구동(웹 렌더러 .ploss+분자 빨강 패리티). 텍스트=검은 아웃라인.

const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const C_TXT := Color(0.95, 0.96, 0.98)
const C_OUTLINE := Color(0, 0, 0, 0.85)
const C_HIT := Color(1.0, 0.82, 0.4)     # 명중% (타겟 accent)
const C_LOSS := Color(0.95, 0.32, 0.32)  # 까일 segment·분자 빨강
const BAR := Vector2(96, 16)

var _hp: int = 0
var _hp_max: int = 0
var _hit_lbl: Label
var _hp_num: Label      # 분수의 분자(빨강 깜빡 대상)
var _ploss: ColorRect   # 까일 segment(빨강 깜빡)
var _blink: Tween

func _init() -> void:
	alignment = BoxContainer.ALIGNMENT_END   # 아래(유닛쪽) 정렬
	add_theme_constant_override("separation", 3)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

## unit_name·side("ally"/"enemy")·hp/hpMax/shield/statuses. hpMax<=0이면 HP바·명중·상태 생략(데모).
func setup(unit_name: String, side: String, hp: int = 0, hp_max: int = 0, shield: int = 0, statuses: Variant = []) -> void:
	_hp = hp
	_hp_max = hp_max
	if hp_max > 0:
		_hit_lbl = _make_hit_label()  # 맨 위(상태이상 위). 프리뷰 전엔 숨김(레이아웃 미점유).
		add_child(_hit_lbl)
	if hp_max > 0 and statuses is Array and not statuses.is_empty():
		add_child(_status_row(statuses, shield))
	add_child(_name_label(unit_name, side))
	if hp_max > 0:
		add_child(_hp_bar(hp, hp_max))

# ── 명중% 프리뷰(타겟팅) ──
func show_hit(hit: int) -> void:
	if _hit_lbl == null: return
	_hit_lbl.text = "🎯%d%%" % hit
	_hit_lbl.visible = true

func clear_hit() -> void:
	if _hit_lbl: _hit_lbl.visible = false

# ── 체력 까임 프리뷰(호버) — 까일 segment 빨강 깜빡 + 분자 줄어든 값 빨강 깜빡 ──
func show_loss(hp_loss: int) -> void:
	if _ploss == null or _hp_max <= 0: return
	var after := maxi(0, _hp - hp_loss)
	var after_pct := clampf(float(after) / float(_hp_max), 0.0, 1.0)
	var cur_pct := clampf(float(_hp) / float(_hp_max), 0.0, 1.0)
	_ploss.anchor_left = after_pct   # 까일 segment = [피해 후, 현재] 구간
	_ploss.anchor_right = cur_pct
	_ploss.visible = true
	_hp_num.text = "%d" % after       # 분자=줄어든 값
	_hp_num.add_theme_color_override("font_color", C_LOSS)
	_start_blink()

func clear_loss() -> void:
	_stop_blink()
	if _ploss: _ploss.visible = false
	if _hp_num:
		_hp_num.text = "%d" % _hp
		_hp_num.add_theme_color_override("font_color", C_TXT)

# ── 위젯 빌드 ──
func _make_hit_label() -> Label:
	var l := Label.new()
	l.visible = false
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	l.add_theme_font_size_override("font_size", 15)
	l.add_theme_color_override("font_color", C_HIT)
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", C_OUTLINE)
	return l

func _name_label(unit_name: String, side: String) -> Label:
	var l := Label.new()
	l.text = unit_name
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	l.add_theme_font_size_override("font_size", 16)
	l.add_theme_color_override("font_color", C_ALLY if side == "ally" else C_ENEMY)
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", C_OUTLINE)
	return l

func _hp_bar(hp: int, hp_max: int) -> Control:
	var pct := clampf(float(hp) / float(maxi(1, hp_max)), 0.0, 1.0)
	var root := Control.new()
	root.custom_minimum_size = BAR
	root.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var bg := ColorRect.new()
	bg.color = Color(0.1, 0.11, 0.14, 0.92)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(bg)
	var fill := ColorRect.new()
	fill.color = _hp_color(pct)
	fill.anchor_bottom = 1.0
	fill.anchor_right = pct
	root.add_child(fill)
	_ploss = ColorRect.new()       # 까일 segment(fill 위에 겹침). show_loss가 anchor·표시 갱신.
	_ploss.color = C_LOSS
	_ploss.visible = false
	_ploss.anchor_bottom = 1.0
	_ploss.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_ploss)
	var numbox := HBoxContainer.new()  # 분자/분모 분리 — 분자만 빨강 깜빡.
	numbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	numbox.alignment = BoxContainer.ALIGNMENT_CENTER
	numbox.add_theme_constant_override("separation", 0)
	numbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hp_num = _num_lbl("%d" % hp)
	numbox.add_child(_hp_num)
	numbox.add_child(_num_lbl(" / %d" % hp_max))
	root.add_child(numbox)
	return root

func _num_lbl(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", C_TXT)
	l.add_theme_constant_override("outline_size", 4)
	l.add_theme_color_override("font_outline_color", C_OUTLINE)
	return l

func _status_row(statuses: Array, shield: int) -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 3)
	if shield > 0:
		row.add_child(_chip("🛡%d" % shield))
	for s in statuses:
		if not (s is Dictionary): continue
		var ic := str(s.get("icon", ""))
		if ic == "": continue
		var st := int(s.get("stacks", 0))
		row.add_child(_chip("%s%s" % [ic, str(st) if st > 1 else ""]))
	return row

func _chip(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 13)
	l.add_theme_color_override("font_color", C_TXT)
	l.add_theme_constant_override("outline_size", 5)
	l.add_theme_color_override("font_outline_color", C_OUTLINE)
	return l

func _hp_color(pct: float) -> Color:
	if pct > 0.5: return Color(0.314, 0.784, 0.471)
	if pct > 0.25: return Color(1.0, 0.82, 0.4)
	return Color(0.902, 0.408, 0.353)

# ── 빨강 맥동(ploss segment + 분자) — 알파를 사인 ease로 연속 보간(계단식 깜빡 대신 부드럽게) ──
func _start_blink() -> void:
	_stop_blink()
	_blink = create_tween().set_loops().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_blink.tween_method(_set_blink, 1.0, 0.3, 0.5)
	_blink.tween_method(_set_blink, 0.3, 1.0, 0.5)

func _stop_blink() -> void:
	if _blink and _blink.is_valid(): _blink.kill()
	_blink = null
	_set_blink(1.0)

func _set_blink(a: float) -> void:
	if is_instance_valid(_ploss): _ploss.modulate.a = a
	if is_instance_valid(_hp_num): _hp_num.modulate.a = a
