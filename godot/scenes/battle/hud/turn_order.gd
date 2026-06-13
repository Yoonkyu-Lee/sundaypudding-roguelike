extends Control
## 행동서열 + SPD 주사위 **통합**(웹 timelinePanel 이식). 한 컴포넌트가 rolling↔live 모드 전환 — 별개 오버레이 없음.
## ★ 같은 노드가 끝까지 살아남아 변신(웹 .trow가 .rolling 클래스만 벗는 것과 동일): 굴림 행 = 라이브 토큰 = **하나의 공유 행 위젯**(`_make_row`).
## 시퀀스: 굴림 → 차례 확정 → ① 재배치 애니(순위 y 슬라이드) → ② 형태 전환 애니(굴림형→§I 토큰형: 주사위 페이드아웃·테두리/SPD/두 줄 페이드인·폭/높이 트랜지션) → ③ 도킹(토큰이 된 행이 레일로 슬라이드, 그대로 정착).
## live 디자인(§I 합의): 현재=두 줄(이름 16 + "SPD·현재 턴" accent)·넓은 토큰(176)·accent 테두리 / 일반=단일행(150) / ⚡끼어들기 민트 / ✓완료·†사망 흐림. 현재 판정=cursorIndex.
## 순수 뷰(RNG 아님). battle.gd가 라운드마다 play_roll(obs 포함), 갱신마다 update.

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

const RAIL_RECT := Rect2(12, 12, 200, 464)   # 좌측 레일(기존 TurnOrder 위치)
const ROLL_W := 210         # 굴림 행 폭(중앙 패널)
const ROLL_H := 30          # 굴림 행 높이(단일행)
const ROLL_STEP := 46       # 굴림 행 간격(중앙 스택) — 현재 행이 두 줄로 커져도 겹침 최소
const W_CUR := 176          # 라이브 현재 토큰 폭
const W_NORM := 150         # 라이브 일반 토큰 폭
const L2H := 17             # 현재 토큰 2번째 줄("SPD·현재 턴") 높이 — 0↔L2H 트윈으로 두께(높이) 애니
const GHOST_H := 28         # 끼어들기 예고(고스트) 행 높이 — 0→GHOST_H로 삽입 예고 애니

# ── 애니메이션 타이밍(초) — 에디터 인스펙터에서 자유 조정(TurnOrder 노드 선택). 시퀀스 순서대로. ──
@export_group("애니메이션 타이밍 (초)")
@export var t_dim_fade_in := 0.2       # 굴림 시작 시 어두운 배경 페이드인
@export var t_spin_interval := 0.06    # 주사위 숫자 순환 간격
@export var t_settle_first := 0.6      # 첫 주사위 멈춤까지 대기
@export var t_settle_each := 0.13      # 이후 주사위 차례 멈춤 간격
@export var t_die_pop := 0.3           # 주사위 확정 pop(통통)
@export var t_settle_hold := 0.5      # 전부 확정 후 재배치 전 대기
@export var t_reorder_slide := 0.25     # ① 재배치: 행 y 슬라이드
@export var t_reorder_hold := 0.5     # 재배치 후 대기
@export var t_morph := 0.3            # ② 형태 전환: 박스/크기/줄 트랜지션
@export var t_morph_die_fade := 0.18   # 형태 전환: 주사위/보정 페이드아웃
@export var t_morph_appear_delay := 0.3 # 형태 전환: SPD/줄 등장 지연
@export var t_morph_hold := 0.2       # 형태 전환 후 대기
@export var t_predock_hold := 0.1      # 도킹 전 대기
@export var t_dock_slide := 0.5       # ③ 도킹: 행별 레일 슬라이드
@export var t_dock_stagger := 0.04     # 도킹: 행별 시작 지연(스태거)
@export var t_dock_tail := 0.12        # 도킹: 슬라이드 후 여유
@export var t_dock_fade := 0.3         # 도킹: 중앙 패널 페이드아웃
@export var t_dock_dim_fade := 0.5     # 도킹: 어두운 배경 페이드아웃
@export var t_grow := 0.35             # ④ 턴 잡을 때 토큰 grow(현재 강조)
@export var t_shrink := 0.2           # 턴 끝날 때 토큰 shrink
@export_group("")

var _dim: ColorRect
var _rail: ScrollContainer
var _rail_box: VBoxContainer
var _fly: Control            # dock 시 행을 여기로 옮겨 화면 절대좌표로 레일까지 슬라이드
var _mode := "live"
var _spin: Dictionary = {}   # uid → {label,min,max,cur}
var _spin_acc := 0.0
var _skipped := false
var _live_rows: Array = []   # 현재 레일 행들(uid·kind·cur 추적). update가 재사용해 턴 전환(현재↔일반)을 애니메이션.
var _ghost_rows: Array = []  # 끼어들기 예고(고스트) 행들 — 타겟팅 중 현재 토큰 뒤에 삽입 미리보기(transient).
var _ghost_names: Array = [] # 현재 표시 중인 고스트 이름들(동일하면 재구성 안 함 — 깜빡임 방지).

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
	_fly = Control.new()
	_fly.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fly.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fly.z_index = 52
	add_child(_fly)

func _process(delta: float) -> void:
	if _spin.is_empty(): return
	_spin_acc += delta
	if _spin_acc < t_spin_interval: return
	_spin_acc = 0.0
	for uid in _spin:
		var s: Dictionary = _spin[uid]
		s.cur = s.min if s.cur >= s.max else s.cur + 1
		s.label.text = str(s.cur)

func _on_dim_input(e: InputEvent) -> void:
	if _mode == "rolling" and e is InputEventMouseButton and e.pressed:
		_skipped = true

# ── 통합 행 위젯(rolling↔live 같은 노드) ──
## PanelContainer > VBox[ line1 HBox(mark·이름·주사위·±보정·spd) , line2 Label ]. 참조 dict 반환.
func _make_row() -> Dictionary:
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 1)
	p.add_child(box)
	var line1 := HBoxContainer.new()
	line1.add_theme_constant_override("separation", 7)
	box.add_child(line1)
	var mark := _lbl("", 14, C_ACCENT)
	mark.custom_minimum_size = Vector2(15, 0)
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mark.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line1.add_child(mark)
	var nm := _lbl("", 14, C_TXT)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nm.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line1.add_child(nm)
	var die := _lbl("?", 20, C_ACCENT)
	die.custom_minimum_size = Vector2(32, 0)
	die.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	die.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line1.add_child(die)
	var adj := _lbl("", 12, C_ENEMY)
	adj.custom_minimum_size = Vector2(26, 0)
	adj.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	adj.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line1.add_child(adj)
	var spd := _lbl("", 12, C_DIM)
	spd.custom_minimum_size = Vector2(46, 0)
	spd.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	spd.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line1.add_child(spd)
	# 2번째 줄 = 높이 래퍼(clip) 안에 — 래퍼 높이(custom_minimum_size.y) 0↔L2H 트윈으로 행 두께를 연속 변화(VBox가 아래 행을 부드럽게 밀어냄).
	var line2_box := Control.new()
	line2_box.clip_contents = true
	line2_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line2_box.custom_minimum_size = Vector2(0, 0)
	box.add_child(line2_box)
	var line2 := _lbl("", 12, C_ACCENT)
	line2.set_anchors_preset(Control.PRESET_TOP_WIDE)
	line2.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line2.visible = false
	line2_box.add_child(line2)
	return {"node": p, "mark": mark, "name": nm, "die": die, "adj": adj, "spd": spd, "line2": line2, "line2_box": line2_box}

## 굴림 외형: 투명 패널, 주사위·±보정 표시, SPD/2번째 줄 숨김, 진영색 이름.
func _row_to_rolling(row: Dictionary, nm_text: String, side: String, mod: int) -> void:
	row.node.add_theme_stylebox_override("panel", _box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, 0, 8, 4))
	row.node.custom_minimum_size = Vector2(ROLL_W, ROLL_H)
	row.name.text = nm_text
	row.name.add_theme_color_override("font_color", C_ENEMY if side == "enemy" else C_ALLY)
	row.name.add_theme_font_size_override("font_size", 14)
	row.mark.text = ""
	row.die.visible = true
	row.die.modulate.a = 1.0
	row.die.text = "?"
	row.adj.visible = true
	row.adj.modulate.a = 1.0
	row.adj.text = ("+%d" % mod) if mod > 0 else (str(mod) if mod < 0 else "")
	row.spd.visible = false
	row.line2.visible = false
	row.line2_box.custom_minimum_size.y = 0

## live 콘텐츠/스타일 적용(§I). animate=true면 굴림형→토큰형을 트랜지션(주사위 페이드아웃·박스/SPD/두 줄 페이드인·크기 보간). false면 즉시(update용).
func _row_to_live(row: Dictionary, info: Dictionary, animate: bool) -> void:
	var is_current: bool = info.current
	var interrupt: bool = info.kind == "interrupt"
	var done: bool = info.done
	var dead: bool = info.dead
	var accent := C_MINT if interrupt else C_ACCENT
	var border := accent if is_current else (C_MINT_FAINT if interrupt else C_LINE)
	var bg := C_MINT_BG if interrupt else (C_PANEL2 if is_current else C_PANEL)
	var target_w := W_CUR if is_current else W_NORM
	row["cur"] = is_current   # 현재 상태 추적(턴 전환 애니 판정)
	# 마크·이름·투명도(즉시)
	row.mark.text = "⚡" if interrupt else ("▶" if is_current else ("†" if dead else ("✓" if done else "")))
	row.mark.add_theme_color_override("font_color", accent if (is_current or interrupt) else C_DIM)
	row.name.text = info.name
	row.name.add_theme_font_size_override("font_size", 16 if is_current else 14)
	if is_current:
		row.name.add_theme_color_override("font_color", C_MINT if interrupt else C_TXT)
	else:
		var base := C_ENEMY if str(info.side) == "enemy" else C_ALLY
		var ncol := C_MINT if interrupt else base
		if (done or dead) and not interrupt: ncol = C_DIM
		row.name.add_theme_color_override("font_color", ncol)
	row.node.modulate.a = 0.4 if dead else (0.55 if done else 1.0)
	# 등장 텍스트
	row.spd.text = "끼어들기" if interrupt else ("" if is_current else "SPD %d" % int(info.spd))
	row.spd.add_theme_color_override("font_color", accent if interrupt else C_DIM)
	row.line2.text = ("끼어들기!" if interrupt else "SPD %d · 현재 턴" % int(info.spd)) if is_current else ""
	row.line2.add_theme_color_override("font_color", accent)
	var show_spd := not is_current
	if not animate:
		row.node.add_theme_stylebox_override("panel", _box(bg, border, 2.0 if is_current else 1.0, 0, 10, 6))
		row.node.custom_minimum_size = Vector2(target_w, 0)
		row.die.visible = false
		row.adj.visible = false
		row.spd.visible = show_spd
		row.line2.visible = is_current
		row.line2.modulate.a = 1.0
		row.line2_box.custom_minimum_size.y = L2H if is_current else 0
		return
	# 애니메이션: 박스(테두리/배경 알파 0→1) + 주사위/보정 페이드아웃 + spd/line2 페이드인 + 크기 보간.
	row.line2_box.custom_minimum_size.y = L2H if is_current else 0
	var sb := _box(Color(bg, 0.0), Color(border, 0.0), 2.0 if is_current else 1.0, 0, 10, 6)
	row.node.add_theme_stylebox_override("panel", sb)
	row.spd.visible = show_spd
	row.spd.modulate.a = 0.0
	row.line2.visible = is_current
	row.line2.modulate.a = 0.0
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_property(sb, "border_color", border, t_morph)
	tw.tween_property(sb, "bg_color", bg, t_morph)
	tw.tween_property(row.die, "modulate:a", 0.0, t_morph_die_fade)
	tw.tween_property(row.adj, "modulate:a", 0.0, t_morph_die_fade)
	# 페이드 후 주사위/보정 숨김 — 안 숨기면 HBox에서 자리를 계속 차지해 이름이 잘림(버그).
	tw.tween_callback(func() -> void: row.die.visible = false; row.adj.visible = false).set_delay(t_morph_die_fade)
	if show_spd: tw.tween_property(row.spd, "modulate:a", 1.0, t_morph).set_delay(t_morph_appear_delay)
	if is_current: tw.tween_property(row.line2, "modulate:a", 1.0, t_morph).set_delay(t_morph_appear_delay)
	tw.tween_property(row.node, "custom_minimum_size", Vector2(target_w, 0), t_morph)

## obs로부터 rank별 live 정보(현재/완료/사망/speed/kind/이름/진영) 산출.
func _live_info(obs: Dictionary, uid: String, rank: int) -> Dictionary:
	var cursor := int(obs.get("cursorIndex", -1))
	var spd := 0
	var kind := "normal"
	var order: Array = obs.get("order", [])
	if rank >= 0 and rank < order.size():
		spd = int(order[rank].get("speed", 0))
		kind = str(order[rank].get("kind", "normal"))
	var nm := uid
	var side := "ally"
	var live := true
	for u in obs.get("allies", []) + obs.get("enemies", []):
		if u is Dictionary and str(u.get("uid", "")) == uid:
			nm = str(u.get("name", "?")); side = str(u.get("side", "ally")); live = bool(u.get("alive", true))
			break
	return {"name": nm, "side": side, "spd": spd, "kind": kind, "current": rank == cursor, "done": rank >= 0 and rank < cursor, "dead": not live}

# ── live: 좌측 레일 행동서열(행 위젯 재사용 — 턴 전환 애니) ──
## 기존 행을 인덱스(uid·kind 일치)로 재사용해 _retarget_live로 상태 변화 애니(현재↔일반 grow/shrink). 불일치/신규만 새로 생성.
func update(obs: Dictionary) -> void:
	if _mode == "rolling": return
	clear_ghosts()   # 레일 재구성 — 끼어들기 예고는 transient, 다음 호버에 다시 추가
	var order: Array = obs.get("order", [])
	var prev := _live_rows
	var new_rows := []
	var reused := {}
	for i in order.size():
		var uid := str(order[i].get("uid", ""))
		var kind := str(order[i].get("kind", "normal"))
		var info := _live_info(obs, uid, i)
		var row: Dictionary
		if i < prev.size() and str(prev[i].get("uid", "")) == uid and str(prev[i].get("kind", "")) == kind and is_instance_valid(prev[i].node):
			row = prev[i]
			reused[row.node] = true
			_retarget_live(row, info)   # 재사용 — 턴 전환(현재↔일반) 애니
		else:
			row = _make_row()
			_row_to_live(row, info, false)
			_rail_box.add_child(row.node)
		row["uid"] = uid; row["kind"] = kind
		_rail_box.move_child(row.node, i)
		new_rows.append(row)
	for old in prev:
		if not reused.has(old.node) and is_instance_valid(old.node): old.node.queue_free()
	_live_rows = new_rows

## 기존 live 행을 새 상태로 — 마크/이름/박스는 즉시, 현재↔일반 변화 시 크기·SPD/두 줄을 애니메이션(턴 잡을 때 grow+하이라이트).
func _retarget_live(row: Dictionary, info: Dictionary) -> void:
	var is_current: bool = info.current
	var interrupt: bool = info.kind == "interrupt"
	var accent := C_MINT if interrupt else C_ACCENT
	var border := accent if is_current else (C_MINT_FAINT if interrupt else C_LINE)
	var bg := C_MINT_BG if interrupt else (C_PANEL2 if is_current else C_PANEL)
	var target_w := W_CUR if is_current else W_NORM
	row.mark.text = "⚡" if interrupt else ("▶" if is_current else ("†" if info.dead else ("✓" if info.done else "")))
	row.mark.add_theme_color_override("font_color", accent if (is_current or interrupt) else C_DIM)
	row.name.text = info.name
	row.name.add_theme_font_size_override("font_size", 16 if is_current else 14)
	if is_current:
		row.name.add_theme_color_override("font_color", C_MINT if interrupt else C_TXT)
	else:
		var base := C_ENEMY if str(info.side) == "enemy" else C_ALLY
		var ncol := C_MINT if interrupt else base
		if (info.done or info.dead) and not interrupt: ncol = C_DIM
		row.name.add_theme_color_override("font_color", ncol)
	row.node.modulate.a = 0.4 if info.dead else (0.55 if info.done else 1.0)
	row.node.add_theme_stylebox_override("panel", _box(bg, border, 2.0 if is_current else 1.0, 0, 10, 6))
	row.die.visible = false
	row.adj.visible = false
	row.spd.text = "끼어들기" if interrupt else ("" if is_current else "SPD %d" % int(info.spd))
	row.spd.add_theme_color_override("font_color", accent if interrupt else C_DIM)
	row.line2.text = ("끼어들기!" if interrupt else "SPD %d · 현재 턴" % int(info.spd)) if is_current else ""
	row.line2.add_theme_color_override("font_color", accent)
	var was := bool(row.get("cur", false))
	row["cur"] = is_current
	if was == is_current:
		row.spd.visible = not is_current; row.spd.modulate.a = 1.0
		row.line2.visible = is_current; row.line2.modulate.a = 1.0
		row.line2_box.custom_minimum_size.y = L2H if is_current else 0
		row.node.custom_minimum_size = Vector2(target_w, 0)
		return
	if is_current:
		# 일반→현재: 너비 + **두께(line2_box 높이 0→L2H)** 연속 트윈 → 아래 토큰들이 부드럽게 밀려남. "현재 턴" 줄 페이드인.
		row.spd.visible = false
		row.line2.visible = true; row.line2.modulate.a = 0.0
		var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_property(row.node, "custom_minimum_size:x", float(target_w), t_grow)
		tw.tween_property(row.line2_box, "custom_minimum_size:y", float(L2H), t_grow)
		tw.tween_property(row.line2, "modulate:a", 1.0, t_grow)
	else:
		# 현재→일반: 너비 + 두께(L2H→0) 줄이며 아래 토큰들이 당겨짐. SPD 페이드인, 줄 페이드아웃.
		row.spd.visible = true; row.spd.modulate.a = 0.0
		var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tw.tween_property(row.node, "custom_minimum_size:x", float(target_w), t_shrink)
		tw.tween_property(row.line2_box, "custom_minimum_size:y", 0.0, t_shrink)
		tw.tween_property(row.line2, "modulate:a", 0.0, t_shrink)
		tw.chain().tween_callback(func() -> void: row.line2.visible = false)

# ── 끼어들기 삽입 예고(고스트) — 타겟팅 중 현재 토큰 뒤에 점선 민트 행을 높이 0→full로 밀어내며 삽입(웹 .trow.ghost) ──
## names = battle_targeting.ghosts(예고 주체 이름). battle.gd가 호버마다 호출, 빈 배열이면 제거.
func show_ghosts(names: Array) -> void:
	if _mode != "live": return
	if names == _ghost_names: return   # 동일 예고 — 재구성 안 함(호버 이동 시 깜빡임 방지)
	clear_ghosts()
	_ghost_names = names.duplicate()
	if names.is_empty(): return
	# 현재 토큰 바로 뒤 위치
	var at := _rail_box.get_child_count()
	for r in _live_rows:
		if bool(r.get("cur", false)) and is_instance_valid(r.node):
			at = (r.node as Control).get_index() + 1
			break
	for i in names.size():
		var g := _make_ghost(str(names[i]))
		_rail_box.add_child(g.box)
		_rail_box.move_child(g.box, at + i)
		_ghost_rows.append(g)
		# 입장: 높이 0→GHOST_H(아래 토큰 밀어내며 삽입 예고)
		g.box.custom_minimum_size.y = 0
		create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT).tween_property(g.box, "custom_minimum_size:y", float(GHOST_H), t_grow)
		# 펄스(웹 ghostin)
		var pulse := create_tween().set_loops().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		pulse.tween_property(g.panel, "modulate:a", 0.4, 0.6)
		pulse.tween_property(g.panel, "modulate:a", 0.95, 0.6)
		g["pulse"] = pulse

func clear_ghosts() -> void:
	for g in _ghost_rows:
		if g.has("pulse") and g.pulse != null and g.pulse.is_valid(): g.pulse.kill()
		if is_instance_valid(g.box): g.box.queue_free()
	_ghost_rows.clear()
	_ghost_names = []

## 고스트 행 = 높이 클립 래퍼(box) + 점선 느낌 민트 토큰(panel: 투명 민트 bg + 옅은 민트 테두리 + ⚡이름).
func _make_ghost(nm_text: String) -> Dictionary:
	var box := Control.new()
	box.clip_contents = true
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	box.custom_minimum_size = Vector2(W_NORM, 0)
	var p := PanelContainer.new()
	p.set_anchors_preset(Control.PRESET_TOP_WIDE)
	p.add_theme_stylebox_override("panel", _box(Color(C_MINT.r, C_MINT.g, C_MINT.b, 0.07), C_MINT_FAINT, 1, 0, 10, 5))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 7)
	p.add_child(hb)
	var mark := _lbl("⚡", 14, C_MINT)
	mark.custom_minimum_size = Vector2(15, 0)
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hb.add_child(mark)
	var nm := _lbl("%s · 끼어들기 예고" % nm_text, 12, C_MINT)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nm.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hb.add_child(nm)
	box.add_child(p)
	return {"box": box, "panel": p}

# ── rolling: 중앙 굴림 → 확정 → 재배치 → 형태 전환 → 도킹 ──
## rolls=[{uid,speedMin,speedMax,roll,speedMod,speed}], order_uids=확정 서열, names/sides=표시, obs=라이브 정보원. on_done=라이브 전환(refresh).
func play_roll(round_no: int, rolls: Array, order_uids: Array, names: Dictionary, sides: Dictionary, obs: Dictionary, on_done: Callable) -> void:
	_mode = "rolling"
	_skipped = false
	_spin.clear()
	for c in _rail_box.get_children(): c.queue_free()
	_dim.visible = true
	_dim.modulate.a = 0.0
	create_tween().tween_property(_dim, "modulate:a", 1.0, t_dim_fade_in)

	var center := PanelContainer.new()
	center.z_index = 51
	center.add_theme_stylebox_override("panel", _box(Color(0.114, 0.125, 0.157, 0.98), Color(1, 0.82, 0.4, 0.55), 2.0, 10, 22, 16))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	center.add_child(v)
	var title := _lbl("⚄ ROUND %d · 행동 서열 결정" % round_no, 18, C_ACCENT)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var holder := Control.new()   # 좌표 직접 배치 — 재배치/도킹에서 position 자유 제어.
	holder.custom_minimum_size = Vector2(ROLL_W, rolls.size() * ROLL_STEP)
	v.add_child(holder)
	var row_by := {}
	for i in rolls.size():
		var r: Dictionary = rolls[i]
		var uid := str(r.get("uid", ""))
		var row := _make_row()
		_row_to_rolling(row, str(names.get(uid, uid)), str(sides.get(uid, "ally")), int(r.get("speedMod", 0)))
		var node: Control = row.node
		node.position = Vector2(0, i * ROLL_STEP)
		node.size = Vector2(ROLL_W, ROLL_H)
		holder.add_child(node)
		row_by[uid] = row
		_spin[uid] = {"label": row.die, "min": int(r.get("speedMin", 1)), "max": int(r.get("speedMax", 6)), "cur": int(r.get("speedMin", 1))}
	var skip := _lbl("클릭하면 건너뛰기", 11, C_DIM)
	skip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(skip)
	add_child(center)
	await get_tree().process_frame
	center.position = (get_viewport_rect().size - center.size) * 0.5

	# Phase B: 차례차례 멈춰 roll 확정
	for i in rolls.size():
		await _wait(t_settle_first if i == 0 else t_settle_each)
		var uid := str(rolls[i].get("uid", ""))
		_spin.erase(uid)
		row_by[uid].die.text = str(int(rolls[i].get("roll", 0)))
		_pop(row_by[uid].die)
	_spin.clear()

	# Phase C: 재배치 애니 — 각 행 y를 순위 위치로 슬라이드 + 순위 번호.
	await _wait(t_settle_hold)
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		row_by[uid].mark.text = "%d" % (rank + 1)
		var ty := rank * ROLL_STEP
		if _skipped:
			(row_by[uid].node as Control).position.y = ty
		else:
			create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT).tween_property(row_by[uid].node, "position:y", ty, t_reorder_slide)
	if not _skipped: await _wait(t_reorder_hold)

	# Phase C2: 형태 전환 애니 — 굴림형 → §I 토큰형(같은 노드, 제자리). **모두 일반 형태**(현재 강조·크기는 도킹 후 update가 애니로).
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		var info := _live_info(obs, uid, rank)
		info["current"] = false   # 형태 전환 단계에선 전부 일반 — 현재 토큰 grow/하이라이트는 도킹 후
		_row_to_live(row_by[uid], info, not _skipped)
	if not _skipped: await _wait(t_morph_hold)

	# Phase D: 도킹 — 토큰이 된 행이 레일로 슬라이드, 그대로 정착.
	await _wait(t_predock_hold)
	await _dock(center, order_uids, row_by, on_done)

## dock — 토큰형 행들의 레일 도착 위치를 측정 후 _fly에서 슬라이드, 도착하면 그 행을 레일에 정착(같은 노드).
func _dock(center: Control, order_uids: Array, row_by: Dictionary, on_done: Callable) -> void:
	# 1) 슬라이드 시작점(중앙) 기록.
	var gp_old := {}
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if row_by.has(uid): gp_old[uid] = (row_by[uid].node as Control).global_position
	# 2) 행을 레일에 잠깐 넣어 정확한 도착 위치 측정(숨김).
	_rail.modulate.a = 0.0
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		var node: Control = row_by[uid].node
		node.get_parent().remove_child(node)
		_rail_box.add_child(node)
	await get_tree().process_frame
	var gp_new := {}
	for uid in row_by: gp_new[uid] = (row_by[uid].node as Control).global_position
	# 3) _fly로 옮겨 시작점→도착점 스태거 슬라이드.
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		var node: Control = row_by[uid].node
		node.get_parent().remove_child(node)
		_fly.add_child(node)
		node.global_position = gp_old.get(uid, gp_new[uid])
		create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT) \
			.tween_property(node, "global_position", gp_new[uid], t_dock_slide).set_delay(rank * t_dock_stagger)
	var fade := create_tween().set_parallel(true)
	fade.tween_property(center, "modulate:a", 0.0, t_dock_fade)
	fade.tween_property(_dim, "modulate:a", 0.0, t_dock_dim_fade)
	await get_tree().create_timer(t_dock_slide + order_uids.size() * t_dock_stagger + t_dock_tail).timeout
	# 4) 같은 행을 레일에 정착(VBox가 같은 위치로 배치 → 점프 없음).
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		var node: Control = row_by[uid].node
		node.get_parent().remove_child(node)
		_rail_box.add_child(node)
	_rail.modulate.a = 1.0
	_mode = "live"
	# 도킹된 행들(모두 일반 형태)을 _live_rows로 등록 → 직후 update가 재사용해 현재 토큰만 grow/하이라이트 애니.
	_live_rows = []
	for rank in order_uids.size():
		var uid := str(order_uids[rank])
		if not row_by.has(uid): continue
		row_by[uid]["uid"] = uid
		row_by[uid]["kind"] = "normal"
		row_by[uid]["cur"] = false
		_live_rows.append(row_by[uid])
	on_done.call()              # 보드/HUD 갱신 — update가 _live_rows 재사용 → 현재 토큰 grow 애니
	center.queue_free()
	_dim.visible = false

func _wait(t: float) -> void:
	if _skipped: return
	await get_tree().create_timer(t).timeout

func _pop(n: Control) -> void:
	n.pivot_offset = n.size * 0.5
	n.scale = Vector2(1.35, 1.35)
	create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).tween_property(n, "scale", Vector2.ONE, t_die_pop)

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
