extends Control
## 행동서열 + SPD 주사위 **통합**(웹 timelinePanel 이식). 한 컴포넌트가 rolling↔live 모드 전환 — 별개 오버레이 없음.
## ★ 같은 노드가 변신: 굴림 행과 라이브 토큰이 **하나의 공유 행 위젯**(`_make_row`). dock=그 행이 그대로 좌측 레일로 슬라이드하며 스타일만 rolling→live (크로스페이드/노드 교체 X = 웹 .trow가 .rolling 클래스만 벗는 것과 동일).
## rolling: 화면 중앙 패널에서 굴림→차례 확정→서열 재정렬(행 y 슬라이드). live: 좌측 레일(▶현재 accent·✓완료 흐림·⚡끼어들기 민트·†사망). 현재 판정=cursorIndex.
## 균일 높이 단일행이라 굴림 holder(y=rank·ROW_STEP)와 레일 VBox(sep 8)의 행 정렬이 정확히 일치 → dock은 holder 통째 슬라이드로 무봉합. 순수 뷰(RNG 아님).

const C_ALLY := Color(0.353, 0.663, 0.902)
const C_ENEMY := Color(0.902, 0.408, 0.353)
const C_PANEL := Color(0.1137, 0.1254, 0.1568, 1)
const C_PANEL2 := Color(0.145, 0.165, 0.212, 1)
const C_LINE := Color(0.2, 0.2274, 0.2823, 1)
const C_ACCENT := Color(1, 0.8196, 0.4, 1)
const C_MINT := Color(0.45, 0.92, 0.78, 1)
const C_MINT_FAINT := Color(0.45, 0.92, 0.78, 0.45)
const C_MINT_BG := Color(0.09, 0.18, 0.15, 1)
const C_TXT := Color(0.95, 0.96, 0.98, 1)
const C_DIM := Color(0.55, 0.58, 0.64, 1)

const RAIL_RECT := Rect2(12, 12, 196, 464)   # 좌측 레일(기존 TurnOrder 위치)
const SPIN_DT := 0.06
const ROW_W := 196          # 행 폭(레일 폭과 일치 → dock 후 폭 변화 없음)
const ROW_H := 32           # 행 높이(균일)
const ROW_STEP := 40        # ROW_H + 레일 VBox separation(8) — 굴림 holder/레일 정렬 일치

var _dim: ColorRect
var _rail: ScrollContainer
var _rail_box: VBoxContainer
var _fly: Control            # dock 시 굴림 holder를 여기로 옮겨 화면 절대좌표로 레일까지 슬라이드
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
	_rail_box.add_theme_constant_override("separation", ROW_STEP - ROW_H)
	_rail.add_child(_rail_box)
	_fly = Control.new()   # dock 비행 레이어
	_fly.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fly.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fly.z_index = 52
	add_child(_fly)

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

# ── 통합 행 위젯(rolling↔live 같은 노드) ──
## PanelContainer + HBox[mark·이름·주사위·±보정·SPD]. die/adj=rolling, spd=live. 참조 dict 반환.
func _make_row() -> Dictionary:
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(0, ROW_H)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 7)
	p.add_child(hb)
	var mark := _lbl("", 13, C_ACCENT)
	mark.custom_minimum_size = Vector2(16, 0)
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mark.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hb.add_child(mark)
	var nm := _lbl("", 14, C_TXT)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nm.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	nm.clip_text = true
	hb.add_child(nm)
	var die := _lbl("?", 20, C_ACCENT)
	die.custom_minimum_size = Vector2(32, 0)
	die.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	die.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hb.add_child(die)
	var adj := _lbl("", 12, C_ENEMY)
	adj.custom_minimum_size = Vector2(26, 0)
	adj.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	adj.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hb.add_child(adj)
	var spd := _lbl("", 12, C_DIM)
	spd.custom_minimum_size = Vector2(46, 0)
	spd.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	spd.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hb.add_child(spd)
	return {"node": p, "mark": mark, "name": nm, "die": die, "adj": adj, "spd": spd}

## rolling 외형: 투명 패널, 주사위·±보정 표시, SPD 숨김, 진영색 이름.
func _row_to_rolling(row: Dictionary, nm_text: String, side: String, mod: int) -> void:
	row.node.add_theme_stylebox_override("panel", _box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, 0, 8, 5))
	row.name.text = nm_text
	row.name.add_theme_color_override("font_color", C_ENEMY if side == "enemy" else C_ALLY)
	row.name.add_theme_font_size_override("font_size", 14)
	row.mark.text = ""
	row.die.visible = true
	row.die.text = "?"
	row.adj.visible = true
	row.adj.text = ("+%d" % mod) if mod > 0 else (str(mod) if mod < 0 else "")
	row.spd.visible = false

## live 외형: 토큰 테두리/배경, SPD 표시, 주사위·보정 숨김, 마크(▶/✓/⚡/†), 현재 강조·끼어들기 민트·완료/사망 흐림.
func _row_to_live(row: Dictionary, nm_text: String, side: String, spd: int, is_current: bool, done: bool, dead: bool, kind: String) -> void:
	var interrupt := kind == "interrupt"
	var accent := C_MINT if interrupt else C_ACCENT
	var border := accent if is_current else (C_MINT_FAINT if interrupt else C_LINE)
	var bg := C_MINT_BG if interrupt else (C_PANEL2 if is_current else C_PANEL)
	row.node.add_theme_stylebox_override("panel", _box(bg, border, 2.0 if is_current else 1.0, 0, 9, 5))
	row.die.visible = false
	row.adj.visible = false
	row.spd.visible = true
	row.spd.text = "끼어들기" if interrupt else "SPD %d" % spd
	row.spd.add_theme_color_override("font_color", accent if interrupt else C_DIM)
	row.name.text = nm_text
	var base := C_ENEMY if side == "enemy" else C_ALLY
	var ncol := C_MINT if interrupt else (C_TXT if is_current else base)
	if (done or dead) and not interrupt: ncol = C_DIM
	row.name.add_theme_color_override("font_color", ncol)
	row.name.add_theme_font_size_override("font_size", 15 if is_current else 14)
	row.mark.text = "⚡" if interrupt else ("▶" if is_current else ("†" if dead else ("✓" if done else "")))
	row.mark.add_theme_color_override("font_color", accent if (is_current or interrupt) else C_DIM)
	row.node.modulate.a = 0.4 if dead else (0.55 if done else 1.0)

# ── live: 좌측 레일 행동서열(같은 행 위젯으로 재구성) ──
func update(obs: Dictionary) -> void:
	if _mode == "rolling": return   # 굴림 중엔 갱신 보류
	for c in _rail_box.get_children(): c.queue_free()
	var names := {}
	var sides := {}
	var alive := {}
	for u in obs.get("allies", []) + obs.get("enemies", []):
		if not (u is Dictionary): continue
		var uid := str(u.get("uid", ""))
		names[uid] = str(u.get("name", "?"))
		sides[uid] = str(u.get("side", "ally"))
		alive[uid] = bool(u.get("alive", true))
	var cursor := int(obs.get("cursorIndex", -1))
	var order: Array = obs.get("order", [])
	for i in order.size():
		var o: Dictionary = order[i]
		var uid := str(o.get("uid", ""))
		var row := _make_row()
		_row_to_live(row, names.get(uid, "?"), sides.get(uid, "ally"), int(o.get("speed", 0)), i == cursor, i < cursor, not bool(alive.get(uid, true)), str(o.get("kind", "normal")))
		_rail_box.add_child(row.node)

# ── rolling: 중앙 굴림 → 확정 → 재정렬 → dock(같은 행이 레일로 슬라이드·변신) ──
## rolls=[{uid,speedMin,speedMax,roll,speedMod,speed}], order_uids=확정 서열, names/sides=uid→표시. on_done=라이브 전환(refresh).
func play_roll(round_no: int, rolls: Array, order_uids: Array, names: Dictionary, sides: Dictionary, on_done: Callable) -> void:
	_mode = "rolling"
	_skipped = false
	_spin.clear()
	for c in _rail_box.get_children(): c.queue_free()   # 이전 라운드 레일 비움(dock 도착지)
	_dim.visible = true
	_dim.modulate.a = 0.0
	create_tween().tween_property(_dim, "modulate:a", 1.0, 0.2)

	var center := PanelContainer.new()
	center.z_index = 51
	center.add_theme_stylebox_override("panel", _box(Color(0.114, 0.125, 0.157, 0.98), Color(1, 0.82, 0.4, 0.55), 2.0, 10, 22, 16))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	center.add_child(v)
	var title := _lbl("⚄ ROUND %d · 행동 서열 결정" % round_no, 18, C_ACCENT)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	# 굴림 행 = 좌표 직접 배치(VBox 아님) — 재정렬/dock에서 position 자유 Tween.
	var holder := Control.new()
	holder.custom_minimum_size = Vector2(ROW_W, rolls.size() * ROW_STEP - (ROW_STEP - ROW_H))
	v.add_child(holder)
	var speed_by := {}
	var row_by := {}
	for i in rolls.size():
		var r: Dictionary = rolls[i]
		var uid := str(r.get("uid", ""))
		var row := _make_row()
		_row_to_rolling(row, str(names.get(uid, uid)), str(sides.get(uid, "ally")), int(r.get("speedMod", 0)))
		var node: Control = row.node
		node.position = Vector2(0, i * ROW_STEP)
		node.size = Vector2(ROW_W, ROW_H)
		node.custom_minimum_size = Vector2(ROW_W, ROW_H)
		holder.add_child(node)
		row_by[uid] = row
		speed_by[uid] = int(r.get("speed", 0))
		_spin[uid] = {"label": row.die, "min": int(r.get("speedMin", 1)), "max": int(r.get("speedMax", 6)), "cur": int(r.get("speedMin", 1))}
	var skip := _lbl("클릭하면 건너뛰기", 11, C_DIM)
	skip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(skip)
	add_child(center)
	await get_tree().process_frame   # 사이즈 확정 후 중앙 배치
	center.position = (get_viewport_rect().size - center.size) * 0.5

	# Phase B: 입력 순서대로 차례차례 멈춰 roll 확정
	for i in rolls.size():
		await _wait(0.6 if i == 0 else 0.13)
		var uid := str(rolls[i].get("uid", ""))
		_spin.erase(uid)
		row_by[uid].die.text = str(int(rolls[i].get("roll", 0)))
		_pop(row_by[uid].die)
	_spin.clear()

	# Phase C: 최종 서열로 재정렬 — 각 행 y를 순위 위치로 슬라이드(스왑), 순위 번호.
	await _wait(0.25)
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		row_by[uid].mark.text = "%d" % (rank + 1)
		var ty := rank * ROW_STEP
		if _skipped:
			(row_by[uid].node as Control).position.y = ty
		else:
			create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT).tween_property(row_by[uid].node, "position:y", ty, 0.4)
	if not _skipped: await _wait(0.45)

	# Phase D: 잠깐 보여주고 dock
	await _wait(0.5)
	await _dock(center, holder, order_uids, names, sides, speed_by, row_by, on_done)

## dock — 같은 행이 그 자리에서 live로 변신(die/adj 숨김→SPD·테두리) + holder 통째를 레일 위치로 슬라이드.
## 도착 후 update가 동일 행으로 레일 재구성(같은 위치 → 무봉합). 크로스페이드/노드 교체 없음 = 웹 .trow 도킹.
func _dock(center: Control, holder: Control, order_uids: Array, names: Dictionary, sides: Dictionary, speed_by: Dictionary, row_by: Dictionary, on_done: Callable) -> void:
	_mode = "live"
	# 1. 각 행을 제자리에서 live 스타일로 변신(같은 노드). 라운드 시작 직후라 rank0=현재, 완료/사망 없음.
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		_row_to_live(row_by[uid], str(names.get(uid, uid)), str(sides.get(uid, "ally")), int(speed_by.get(uid, 0)), rank == 0, false, false, "normal")
	# 2. holder를 _fly로(절대좌표 보존) 옮겨 레일 위치로 슬라이드.
	var gp := holder.global_position
	holder.get_parent().remove_child(holder)
	_fly.add_child(holder)
	holder.global_position = gp
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(holder, "global_position", RAIL_RECT.position, 0.5)
	tw.tween_property(center, "modulate:a", 0.0, 0.3)   # 패널 bg/제목/스킵 페이드(행은 holder로 빠져 영향 없음)
	tw.tween_property(_dim, "modulate:a", 0.0, 0.5)
	await tw.finished
	on_done.call()              # _rail_box를 동일 행으로 재구성(같은 위치 → 무봉합 교체)
	holder.queue_free()
	center.queue_free()
	_dim.visible = false

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
