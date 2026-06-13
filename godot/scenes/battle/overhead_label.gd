extends VBoxContainer
## 유닛 머리위 2D 오버레이(해법 B) — CanvasLayer 위 Control. battle.gd가 매 프레임 카드 머리 월드→화면 투영으로 위치 갱신.
## 화면 공간이라 항상 선명·일정 크기·중심 정렬·겹침 제어. 위→아래: 상태이상 칩 → 이름 → HP바(유닛에 가장 가까움).
## 텍스트는 보드 위에서도 읽히게 검은 아웃라인.

const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const C_TXT := Color(0.95, 0.96, 0.98)
const C_OUTLINE := Color(0, 0, 0, 0.85)
const BAR := Vector2(96, 16)

func _init() -> void:
	alignment = BoxContainer.ALIGNMENT_END   # 아래(유닛쪽) 정렬
	add_theme_constant_override("separation", 3)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

## unit_name·side("ally"/"enemy")·hp/hpMax/shield/statuses. hpMax<=0이면 HP바·상태 생략(데모).
func setup(unit_name: String, side: String, hp: int = 0, hp_max: int = 0, shield: int = 0, statuses: Variant = []) -> void:
	if hp_max > 0 and statuses is Array and not statuses.is_empty():
		add_child(_status_row(statuses, shield))
	add_child(_name_label(unit_name, side))
	if hp_max > 0:
		add_child(_hp_bar(hp, hp_max))

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
	var num := Label.new()
	num.text = "%d / %d" % [hp, hp_max]
	num.set_anchors_preset(Control.PRESET_FULL_RECT)
	num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	num.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	num.add_theme_font_size_override("font_size", 11)
	num.add_theme_color_override("font_color", C_TXT)
	num.add_theme_constant_override("outline_size", 4)
	num.add_theme_color_override("font_outline_color", C_OUTLINE)
	root.add_child(num)
	return root

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
