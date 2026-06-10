extends Control
## SPD 주사위 연출 — web timelinePanel rolling 모드 모방.
## 각 유닛 주사위가 speedMin..speedMax 회전 → 차례로 멈춰 roll·"= speed" 확정 → 최종 서열 순위 → on_done.
## 순수 뷰 애니메이션(게임 RNG 아님 — 결과는 엔진 roundStart가 이미 결정, 여기선 보여주기만).

const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const C_ACCENT := Color(1.0, 0.82, 0.4)
const C_TXT := Color(0.902, 0.914, 0.937)

var _spin: Dictionary = {}   # uid -> {label, min, max, cur}
var _acc := 0.0

func _ready() -> void:
	visible = false

## 회전 중인 주사위만 0.06s마다 순환(min..max). 멈추면 _spin에서 제거됨.
func _process(delta: float) -> void:
	if _spin.is_empty(): return
	_acc += delta
	if _acc < 0.06: return
	_acc = 0.0
	for uid in _spin:
		var s: Dictionary = _spin[uid]
		s.cur = s.min if s.cur >= s.max else s.cur + 1
		s.label.text = str(s.cur)

## rolls=[{uid,speedMin,speedMax,roll,speedMod,speed}], order_uids=확정 서열, names/sides=uid→표시.
func play(round_no: int, rolls: Array, order_uids: Array, names: Dictionary, sides: Dictionary, on_done: Callable) -> void:
	visible = true
	_spin.clear()
	var rows := $Panel/V/Rows
	for c in rows.get_children(): c.queue_free()
	$Panel/V/Title.text = "⚄ ROUND %d · 행동 서열 결정" % round_no
	var row_by := {}
	for r in rolls:
		var uid := str(r.get("uid", ""))
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var nm := Label.new()
		nm.text = str(names.get(uid, uid))
		nm.add_theme_color_override("font_color", C_ENEMY if str(sides.get(uid, "ally")) == "enemy" else C_ALLY)
		nm.custom_minimum_size = Vector2(130, 0)
		row.add_child(nm)
		var die := Label.new()
		die.text = "?"
		die.add_theme_font_size_override("font_size", 22)
		die.add_theme_color_override("font_color", C_ACCENT)
		die.custom_minimum_size = Vector2(38, 0)
		die.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		row.add_child(die)
		var mod := int(r.get("speedMod", 0))
		var adj := Label.new()
		adj.text = ("+%d" % mod) if mod > 0 else (str(mod) if mod < 0 else "")
		adj.add_theme_color_override("font_color", C_TXT)
		adj.custom_minimum_size = Vector2(40, 0)
		row.add_child(adj)
		var spd := Label.new()
		spd.add_theme_color_override("font_color", C_TXT)
		spd.custom_minimum_size = Vector2(80, 0)
		row.add_child(spd)
		rows.add_child(row)
		row_by[uid] = {"row": row, "die": die, "spd": spd}
		_spin[uid] = {"label": die, "min": int(r.get("speedMin", 1)), "max": int(r.get("speedMax", 6)), "cur": int(r.get("speedMin", 1))}

	# Phase B: 입력 순서대로 차례차례 멈춰 roll·합산 확정
	for r in rolls:
		await get_tree().create_timer(0.34).timeout
		var uid := str(r.get("uid", ""))
		_spin.erase(uid)
		var rb: Dictionary = row_by[uid]
		rb.die.text = str(int(r.get("roll", 0)))
		rb.spd.text = "= %d" % int(r.get("speed", 0))

	# Phase C: 최종 서열로 재배치 + 순위 번호
	await get_tree().create_timer(0.35).timeout
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		var rb: Dictionary = row_by[uid]
		rows.move_child(rb.row, rank)
		var rk := Label.new()
		rk.text = "  #%d" % (rank + 1)
		rk.add_theme_color_override("font_color", C_ACCENT)
		rb.row.add_child(rk)

	# Phase D: 잠깐 보여주고 닫기 → 라이브 서열로
	await get_tree().create_timer(0.75).timeout
	visible = false
	on_done.call()
