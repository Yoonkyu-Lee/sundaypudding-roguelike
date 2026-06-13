@tool
extends MarginContainer
## 각진 + 대각선 컷(chamfer) 패널 — StyleBoxFlat이 못 하는 사각 컷 모서리를 _draw 폴리곤으로.
## 재사용 위젯(HUD 바·툴팁·토큰). 자식은 margin(pad) 안쪽에 배치. (BATTLE-SCREEN-DESIGN §B)
## class_name 미사용(헤드리스 미등록) — 소비자는 .tscn ext_resource로 부착.

@export var fill_color: Color = Color(0.1137, 0.1254, 0.1568, 1.0):
	set(value):
		fill_color = value
		queue_redraw()
@export var border_color: Color = Color(0.2, 0.2274, 0.2823, 1.0):
	set(value):
		border_color = value
		queue_redraw()
@export var border_width: float = 1.5:
	set(value):
		border_width = value
		queue_redraw()
@export var chamfer: float = 16.0:
	set(value):
		chamfer = value
		queue_redraw()
@export var cut_tl: bool = false:
	set(value):
		cut_tl = value
		queue_redraw()
@export var cut_tr: bool = false:
	set(value):
		cut_tr = value
		queue_redraw()
@export var cut_br: bool = false:
	set(value):
		cut_br = value
		queue_redraw()
@export var cut_bl: bool = false:
	set(value):
		cut_bl = value
		queue_redraw()
@export var pad: int = 12:
	set(value):
		pad = value
		_update_margins()

func _ready() -> void:
	_update_margins()

func _update_margins() -> void:
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		add_theme_constant_override(side, pad)

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()

func _draw() -> void:
	var pts := _poly()
	draw_colored_polygon(pts, fill_color)
	var closed := pts
	closed.append(pts[0])
	draw_polyline(closed, border_color, border_width, true)

## 8각(컷 모서리) 폴리곤 — 시계방향(TL→TR→BR→BL). 컷 모서리는 두 점으로.
func _poly() -> PackedVector2Array:
	var w := size.x
	var h := size.y
	var c := minf(chamfer, minf(w, h) * 0.5)
	var p := PackedVector2Array()
	if cut_tl:
		p.append(Vector2(0, c))
		p.append(Vector2(c, 0))
	else:
		p.append(Vector2(0, 0))
	if cut_tr:
		p.append(Vector2(w - c, 0))
		p.append(Vector2(w, c))
	else:
		p.append(Vector2(w, 0))
	if cut_br:
		p.append(Vector2(w, h - c))
		p.append(Vector2(w - c, h))
	else:
		p.append(Vector2(w, h))
	if cut_bl:
		p.append(Vector2(c, h))
		p.append(Vector2(0, h - c))
	else:
		p.append(Vector2(0, h))
	return p
