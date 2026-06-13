extends Control
## 현재 유닛 패널(전투 하단 HUD 좌측) — Figma 디자인 이식. 투명(박스 없음), 자식은 절대배치.
## 구성: 초상화(좌 정사각) + 이름/직업 + 구분선 + 2×2 스탯 + 특수효과 칩 행(가로 스크롤) + 실드바(흰·HP 위) + HP바.
## 데이터: obs UnitView(hp/shield/statuses) + sheet_data(charId) + content(기본 스탯·정의). 호버 상세는 tip 시그널.
signal tip(text: String)

const Tips := preload("res://scenes/battle/hud/tips.gd")
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)

## unit = obs UnitView(현재 턴 유닛), sheet_unit = sheet_data.battleUnits 대응(charId).
func populate(unit: Dictionary, sheet_unit: Dictionary) -> void:
	var chars: Dictionary = GameDirector.content("characters")
	var cdef: Dictionary = chars.get(str(sheet_unit.get("charId", "")), {})
	_render_identity(unit, sheet_unit)
	_render_stats(cdef)
	_render_hp(unit)
	_render_statuses(unit)

func _render_identity(unit: Dictionary, sheet_unit: Dictionary) -> void:
	var side := str(unit.get("side", ""))
	$NameL.text = str(unit.get("name", "?"))
	$NameL.add_theme_color_override("font_color", C_ALLY if side == "ally" else C_ENEMY)
	var job := str(sheet_unit.get("jobName", ""))
	var tier := int(sheet_unit.get("classTier", 0))
	$JobL.text = "%s%s" % [job, "  ·  %d차" % tier if tier > 0 else ""]

func _render_stats(cdef: Dictionary) -> void:
	if cdef.is_empty():
		for n in ["SpdL", "EvaL", "AccL", "CritL"]: get_node(n).text = ""
		return
	$SpdL.text = "SPD %d~%d" % [int(cdef.get("speedMin", 0)), int(cdef.get("speedMax", 0))]
	$EvaL.text = "회피 %d%%" % int(cdef.get("evasion", 0))
	$AccL.text = "명중 %+d%%" % int(cdef.get("accuracy", 0))
	$CritL.text = "치명 %d%%" % int(cdef.get("critChance", 0))

func _render_hp(unit: Dictionary) -> void:
	var hp := int(unit.get("hp", 0))
	var hp_max := maxi(1, int(unit.get("hpMax", 1)))
	var shield := int(unit.get("shield", 0))
	var pct := clampf(float(hp) / float(hp_max), 0.0, 1.0)
	$HpBar/Fill.anchor_right = pct
	$HpBar/Fill.color = _hp_color(pct)
	$HpBar/Txt.text = "%d / %d" % [hp, hp_max]
	# 실드바: HP바 폭(216) 기준, 쉴드/최대HP 비율(상한 1). 0이면 숨김.
	var sw := clampf(float(shield) / float(hp_max), 0.0, 1.0) * 216.0
	$ShieldBar.visible = shield > 0
	$ShieldBar.size.x = sw

func _render_statuses(unit: Dictionary) -> void:
	var chips: HBoxContainer = $Effects/Chips
	for c in chips.get_children(): c.queue_free()
	var defs: Dictionary = GameDirector.content("statuses")
	var statuses: Variant = unit.get("statuses", [])
	if not (statuses is Array): return
	for sv in statuses:
		if not (sv is Dictionary): continue
		chips.add_child(_chip(sv, defs))

## 작은 정사각 틀 + 아이콘(+stacks). 호버 시 상세 tip. (Figma 효과칸 대응)
func _chip(sv: Dictionary, defs: Dictionary) -> Control:
	var stacks := int(sv.get("stacks", 0))
	var b := Button.new()
	b.custom_minimum_size = Vector2(27, 27)
	b.text = "%s%s" % [str(sv.get("icon", "?")), "%d" % stacks if stacks > 1 else ""]
	b.add_theme_font_size_override("font_size", 13)
	b.add_theme_stylebox_override("normal", _chip_box())
	b.add_theme_stylebox_override("hover", _chip_box(Color(1, 0.82, 0.4, 1)))
	b.add_theme_stylebox_override("pressed", _chip_box(Color(1, 0.82, 0.4, 1)))
	var t: String = Tips.status(sv, defs.get(str(sv.get("id", "")), {}))
	b.mouse_entered.connect(func() -> void: tip.emit(t))
	b.pressed.connect(func() -> void: tip.emit(t))
	return b

func _chip_box(border := Color(0.2, 0.2274, 0.2823, 1)) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.145, 0.165, 0.212, 1)
	s.set_border_width_all(1)
	s.border_color = border
	s.set_corner_radius_all(0)
	return s

func _hp_color(pct: float) -> Color:
	if pct > 0.5: return Color(0.314, 0.784, 0.471)
	if pct > 0.25: return Color(1.0, 0.82, 0.4)
	return Color(0.902, 0.408, 0.353)
