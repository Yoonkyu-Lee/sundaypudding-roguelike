@tool
extends "res://scenes/ui/chamfer_panel.gd"
## 현재 유닛 패널(전투 하단 HUD) — chamfer 패널 상속(오른쪽 상단 대각선 컷). @tool=에디터에서 외형 보임.
## 독립 앵커 패널(바 종속 X) — 위치·외형은 에디터에서 자유 배치. 코드는 populate로 내용만 채움(런타임). — 스케치: 체력바(숫자)·스탯 창·장비 3슬롯·상태이상 가로 스크롤.
## 데이터: obs 유닛(hp/shield/statuses) + sheet_data(charId/equipped) + 콘텐츠(기본 스탯·정의).
## 호버/클릭 상세는 tip 시그널로 올림 — battle_hud의 툴팁 공간이 받아 표시.
signal tip(text: String)

const Tips := preload("res://scenes/battle/hud/tips.gd")
const SLOT_KO := {"weapon": "무기", "armor": "방어구", "held": "지닌물건"}
const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)

func _ready() -> void:
	super._ready()
	for slot in ["Weapon", "Armor", "Held"]:
		var b: Button = get_node("V/H/Equip/" + slot)
		b.mouse_entered.connect(_equip_tip.bind(slot.to_lower()))
		b.pressed.connect(_equip_tip.bind(slot.to_lower()))

var _equipped: Dictionary = {}

## unit = obs UnitView(현재 턴 유닛), sheet_unit = sheet_data.battleUnits 대응(charId/equipped).
func populate(unit: Dictionary, sheet_unit: Dictionary) -> void:
	_equipped = sheet_unit.get("equipped", {}) if sheet_unit.get("equipped") is Dictionary else {}
	var chars: Dictionary = GameDirector.content("characters")
	var cdef: Dictionary = chars.get(str(sheet_unit.get("charId", "")), {})
	_render_hp(unit)
	_render_stats(unit, cdef, sheet_unit)
	_render_equip()
	_render_statuses(unit)

func _render_hp(unit: Dictionary) -> void:
	var hp := int(unit.get("hp", 0))
	var hp_max := maxi(1, int(unit.get("hpMax", 1)))
	var shield := int(unit.get("shield", 0))
	var pct := clampf(float(hp) / float(hp_max), 0.0, 1.0)
	var bar: Control = $V/HpBar
	bar.get_node("Fill").custom_minimum_size = Vector2.ZERO
	bar.get_node("Fill").anchor_right = pct
	bar.get_node("Fill").color = _hp_color(pct)
	var txt := "%d / %d" % [hp, hp_max]
	if shield > 0: txt += "  🛡%d" % shield
	bar.get_node("Txt").text = txt

func _render_stats(unit: Dictionary, cdef: Dictionary, sheet_unit: Dictionary) -> void:
	var side := str(unit.get("side", ""))
	var name_l: Label = $V/H/Stats/NameL
	var job := str(sheet_unit.get("jobName", ""))
	name_l.text = "%s%s" % [str(unit.get("name", "?")), "  ·  " + job if job != "" else ""]
	name_l.add_theme_color_override("font_color", C_ALLY if side == "ally" else C_ENEMY)
	if cdef.is_empty():
		$V/H/Stats/SpdL.text = ""
		$V/H/Stats/AccL.text = ""
		$V/H/Stats/CritL.text = ""
		return
	$V/H/Stats/SpdL.text = "SPD %d~%d" % [int(cdef.get("speedMin", 0)), int(cdef.get("speedMax", 0))]
	$V/H/Stats/AccL.text = "명중 %+d%% · 회피 %d%%" % [int(cdef.get("accuracy", 0)), int(cdef.get("evasion", 0))]
	$V/H/Stats/CritL.text = "크리 %d%% ×%d%%" % [int(cdef.get("critChance", 0)), int(cdef.get("critMultiplier", 0))]
	# 포메이션 보너스(현재 위치 보정) — 0 아닌 것만 덧붙임
	var f: Variant = unit.get("formation")
	if f is Dictionary:
		var fa := int(f.get("attackPower", 0))
		var fd := int(f.get("defensePower", 0))
		if fa > 0: $V/H/Stats/CritL.text += "   ⚔+%d" % fa
		if fd > 0: $V/H/Stats/CritL.text += "   🛡+%d" % fd

func _render_equip() -> void:
	var items: Dictionary = GameDirector.content("items")
	for slot in ["weapon", "armor", "held"]:
		var b: Button = get_node("V/H/Equip/" + slot.capitalize())
		var iid := str(_equipped.get(slot, "")) if _equipped.get(slot) != null else ""
		var idef: Dictionary = items.get(iid, {})
		var icon := str(idef.get("icon", ""))
		b.text = icon if icon != "" else {"weapon": "🗡", "armor": "🛡", "held": "🎒"}[slot]
		b.disabled = iid == ""
		b.tooltip_text = ""  # 네이티브 툴팁 미사용 — 툴팁 공간(tip 시그널)으로

func _render_statuses(unit: Dictionary) -> void:
	var chips: HBoxContainer = $V/StatusScroll/Chips
	for c in chips.get_children(): c.queue_free()
	var defs: Dictionary = GameDirector.content("statuses")
	var statuses: Variant = unit.get("statuses", [])
	if not (statuses is Array) or statuses.is_empty():
		var l := Label.new()
		l.text = "상태이상 없음"
		l.add_theme_color_override("font_color", Color(0.545, 0.576, 0.655))
		chips.add_child(l)
		return
	for sv in statuses:
		if not (sv is Dictionary): continue
		var stacks := int(sv.get("stacks", 0))
		var b := Button.new()
		b.text = "%s%s" % [str(sv.get("icon", "?")), "×%d" % stacks if stacks > 1 else ""]
		b.custom_minimum_size = Vector2(44, 36)
		var def: Dictionary = defs.get(str(sv.get("id", "")), {})
		var t: String = Tips.status(sv, def)
		b.mouse_entered.connect(func() -> void: tip.emit(t))
		b.pressed.connect(func() -> void: tip.emit(t))
		chips.add_child(b)

func _equip_tip(slot: String) -> void:
	var items: Dictionary = GameDirector.content("items")
	var iid := str(_equipped.get(slot, "")) if _equipped.get(slot) != null else ""
	tip.emit(Tips.item(SLOT_KO[slot], items.get(iid, {})))

func _hp_color(pct: float) -> Color:
	if pct > 0.5: return Color(0.314, 0.784, 0.471)
	if pct > 0.25: return Color(1.0, 0.82, 0.4)
	return Color(0.902, 0.408, 0.353)
