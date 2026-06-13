extends Control
## 행동서열 + SPD 주사위 **통합**(웹 timelinePanel 이식). 한 컴포넌트가 rolling↔live 모드 전환 — 별개 오버레이 없음.
## rolling: 화면 중앙 확장 패널 → 주사위 굴림 → 차례 확정(roll·±·=spd) → 최종 서열 재정렬 → dock(패널이 좌측 레일로 슬라이드·축소·페이드 + 라이브 레일 페이드인).
## live: 좌측 레일 행동서열 토큰(▶현재 크게·accent / ✓완료 흐림 / ⚡끼어들기 민트·잔상 / 사망 흐림). 현재 판정=cursorIndex(끼어들기·정규 같은 uid 겹침 방지).
## 순수 뷰(게임 RNG 아님 — roundStart가 결과 확정, 여기선 보여주기만). battle.gd가 라운드마다 play_roll, 갱신마다 update.

const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const C_PANEL := Color(0.1137, 0.1254, 0.1568, 1)
const C_PANEL2 := Color(0.145, 0.165, 0.212, 1)
const C_LINE := Color(0.2, 0.2274, 0.2823, 1)
const C_ACCENT := Color(1, 0.8196, 0.4, 1)
const C_MINT := Color(0.45, 0.92, 0.78, 1)
const C_MINT_FAINT := Color(0.45, 0.92, 0.78, 0.45)
const C_TXT := Color(0.95, 0.96, 0.98, 1)
const C_DIM := Color(0.55, 0.58, 0.64, 1)
const C_HP := Color(0.314, 0.784, 0.471, 1)

const RAIL_RECT := Rect2(12, 12, 196, 464)   # 좌측 레일(기존 TurnOrder 위치)
const SPIN_DT := 0.06

var _dim: ColorRect
var _rail: ScrollContainer
var _rail_box: VBoxContainer
var _mode := "live"
var _spin: Dictionary = {}   # uid → {label,min,max,cur}
var _spin_acc := 0.0
var _skipped := false

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dim = ColorRect.new()
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim.color = Color(0.04, 0.05, 0.06, 0.82)
	_dim.visible = false
	_dim.z_index = 50   # rolling 중 HUD 위를 덮어 입력 차단(클릭=스킵)
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	_dim.gui_input.connect(_on_dim_input)
	add_child(_dim)
	_rail = ScrollContainer.new()
	_rail.position = RAIL_RECT.position
	_rail.custom_minimum_size = RAIL_RECT.size
	_rail.size = RAIL_RECT.size
	_rail.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_rail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_rail)
	_rail_box = VBoxContainer.new()
	_rail_box.add_theme_constant_override("separation", 8)
	_rail.add_child(_rail_box)

## 회전 중인 주사위만 SPIN_DT마다 순환(min..max). 확정되면 _spin에서 제거됨.
func _process(delta: float) -> void:
	if _spin.is_empty(): return
	_spin_acc += delta
	if _spin_acc < SPIN_DT: return
	_spin_acc = 0.0
	for uid in _spin:
		var s: Dictionary = _spin[uid]
		s.cur = s.min if s.cur >= s.max else s.cur + 1
		s.label.text = str(s.cur)

func _on_dim_input(e: InputEvent) -> void:
	if _mode == "rolling" and e is InputEventMouseButton and e.pressed:
		_skipped = true   # 남은 지연 생략(빠른 진행)

# ── live: 좌측 레일 행동서열 ──
func update(obs: Dictionary) -> void:
	if _mode == "rolling": return   # 굴림 중엔 갱신 보류
	for c in _rail_box.get_children(): c.queue_free()
	var names := {}
	var alive := {}
	for u in obs.get("allies", []) + obs.get("enemies", []):
		if not (u is Dictionary): continue
		names[str(u.get("uid", ""))] = str(u.get("name", "?"))
		alive[str(u.get("uid", ""))] = bool(u.get("alive", true))
	var cursor := int(obs.get("cursorIndex", -1))
	var order: Array = obs.get("order", [])
	for i in order.size():
		var o: Dictionary = order[i]
		var uid := str(o.get("uid", ""))
		_rail_box.add_child(_make_live_token(
			names.get(uid, "?"), int(o.get("speed", 0)),
			i == cursor, i < cursor, not bool(alive.get(uid, true)), str(o.get("kind", "normal"))))

## 토큰 = PanelContainer + 라벨. 현재=크게+accent(▶), 완료=흐림(✓), 끼어들기=민트(⚡)/잔상, 사망=흐림(†).
func _make_live_token(nm: String, spd: int, is_current: bool, done: bool, dead: bool, kind: String) -> Control:
	var interrupt := kind == "interrupt"
	var accent := C_MINT if interrupt else C_ACCENT
	var border := accent if is_current else (C_MINT_FAINT if interrupt else C_LINE)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(C_PANEL2 if is_current else C_PANEL, border, 2.0 if is_current else 1.0))
	p.custom_minimum_size = Vector2(176 if is_current else 150, 0)
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	if dead: p.modulate.a = 0.4
	elif done: p.modulate.a = 0.5
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	p.add_child(box)
	var mark := "⚡" if interrupt else ("▶" if is_current else ("†" if dead else ("✓" if done else "")))
	var pre := (mark + " ") if mark != "" else ""
	if is_current:
		box.add_child(_lbl(pre + nm, 16, C_TXT))
		box.add_child(_lbl("끼어들기!" if interrupt else "SPD %d · 현재 턴" % spd, 12, accent))
	elif interrupt:
		box.add_child(_lbl("%s%s · 끼어들기" % [pre, nm], 14, C_MINT))
	else:
		box.add_child(_lbl("%s%s · SPD %d" % [pre, nm, spd], 14, C_DIM if (done or dead) else Color(0.72, 0.74, 0.79)))
	return p

# ── rolling: 중앙 확장 주사위 → 확정 → 재정렬 → dock ──
## rolls=[{uid,speedMin,speedMax,roll,speedMod,speed}], order_uids=확정 서열, names/sides=uid→표시. on_done=라이브 전환(refresh).
func play_roll(round_no: int, rolls: Array, order_uids: Array, names: Dictionary, sides: Dictionary, on_done: Callable) -> void:
	_mode = "rolling"
	_skipped = false
	_spin.clear()
	_dim.visible = true
	_dim.modulate.a = 0.0
	create_tween().tween_property(_dim, "modulate:a", 1.0, 0.2)

	var center := PanelContainer.new()
	center.z_index = 51
	center.pivot_offset = Vector2.ZERO
	center.add_theme_stylebox_override("panel", _box(Color(0.114, 0.125, 0.157, 0.98), Color(1, 0.82, 0.4, 0.55), 2.0, 10, 22, 16))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	center.add_child(v)
	var title := _lbl("⚄ ROUND %d · 행동 서열 결정" % round_no, 18, C_ACCENT)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var rows := VBoxContainer.new()
	rows.add_theme_constant_override("separation", 8)
	v.add_child(rows)
	var row_by := {}
	for r in rolls:
		var uid := str(r.get("uid", ""))
		var row := _build_roll_row(r, str(names.get(uid, uid)), str(sides.get(uid, "ally")))
		rows.add_child(row.node)
		row_by[uid] = row
		_spin[uid] = {"label": row.die, "min": int(r.get("speedMin", 1)), "max": int(r.get("speedMax", 6)), "cur": int(r.get("speedMin", 1))}
	var skip := _lbl("클릭하면 건너뛰기", 11, C_DIM)
	skip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(skip)
	add_child(center)
	await get_tree().process_frame   # 사이즈 확정 후 중앙 배치
	center.position = (get_viewport_rect().size - center.size) * 0.5

	# Phase B: 입력 순서대로 차례차례 멈춰 roll·합산 확정
	for i in rolls.size():
		await _wait(0.6 if i == 0 else 0.13)
		var r: Dictionary = rolls[i]
		var uid := str(r.get("uid", ""))
		_spin.erase(uid)
		var rb: Dictionary = row_by[uid]
		rb.die.text = str(int(r.get("roll", 0)))
		rb.spd.text = "= %d" % int(r.get("speed", 0))
		_pop(rb.die)
	_spin.clear()

	# Phase C: 최종 서열로 재배치 + 순위 번호
	await _wait(0.25)
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		var rb: Dictionary = row_by[uid]
		rb.mark.text = "%d" % (rank + 1)
		rows.move_child(rb.node, rank)

	# Phase D: 잠깐 보여주고 dock → 라이브 레일로
	await _wait(0.7)
	await _dock(center, on_done)

## 굴림 행 = HBox[순위 | 이름 | 주사위 | ±보정 | =speed]. {node,die,spd,mark} 반환.
func _build_roll_row(r: Dictionary, nm_text: String, side: String) -> Dictionary:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var mark := _lbl("", 14, C_ACCENT)
	mark.custom_minimum_size = Vector2(18, 0)
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(mark)
	var nm := _lbl(nm_text, 14, C_ENEMY if side == "enemy" else C_ALLY)
	nm.custom_minimum_size = Vector2(120, 0)
	row.add_child(nm)
	var die := _lbl("?", 22, C_ACCENT)
	die.custom_minimum_size = Vector2(38, 0)
	die.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(die)
	var mod := int(r.get("speedMod", 0))
	var adj := _lbl(("+%d" % mod) if mod > 0 else (str(mod) if mod < 0 else ""), 12, C_ENEMY)
	adj.custom_minimum_size = Vector2(30, 0)
	adj.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(adj)
	var spd := _lbl("", 14, C_HP)
	spd.custom_minimum_size = Vector2(56, 0)
	spd.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	row.add_child(spd)
	return {"node": row, "die": die, "spd": spd, "mark": mark}

## dock — 중앙 패널이 레일로 슬라이드·축소·페이드 + 동시에 라이브 레일 페이드인. 연속적 변신(별개 오버레이 X).
func _dock(center: Control, on_done: Callable) -> void:
	_mode = "live"
	_rail.modulate.a = 0.0
	on_done.call()   # refresh→update: 라이브 레일 토큰 빌드
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(center, "position", RAIL_RECT.position, 0.5)
	tw.tween_property(center, "scale", Vector2(0.5, 0.5), 0.5)
	tw.tween_property(center, "modulate:a", 0.0, 0.5)
	tw.tween_property(_rail, "modulate:a", 1.0, 0.5)
	tw.tween_property(_dim, "modulate:a", 0.0, 0.5)
	await tw.finished
	center.queue_free()
	_dim.visible = false
	_rail.modulate.a = 1.0

func _wait(t: float) -> void:
	if _skipped: return
	await get_tree().create_timer(t).timeout

func _pop(n: Control) -> void:
	n.pivot_offset = n.size * 0.5
	n.scale = Vector2(1.35, 1.35)
	create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).tween_property(n, "scale", Vector2.ONE, 0.3)

# ── 헬퍼 ──
func _lbl(text: String, size: int, col: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	return l

func _box(bg: Color, border: Color, bw: float, radius: int = 0, mh: int = 12, mv: int = 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_border_width_all(int(bw))
	s.border_color = border
	s.set_corner_radius_all(radius)
	s.content_margin_left = mh; s.content_margin_right = mh
	s.content_margin_top = mv; s.content_margin_bottom = mv
	return s
