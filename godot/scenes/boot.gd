extends Control
## 부팅 화면 — 세션 확인 후 타이틀로. (현 web: rustRun 부팅 + 세이브 복원 자리)
## GameDirector(autoload)가 메인 씬보다 먼저 _ready → 여기선 session 준비 여부만 확인.

func _ready() -> void:
	var ok: bool = GameDirector.session != null
	$Center/Label.text = "세션 OK — 타이틀로…" if ok else "❌ 세션 없음 (spr.gdextension 확인)"
	print("[boot] session ready = ", ok)
	if ok:
		await get_tree().create_timer(0.4).timeout
		GameDirector.goto(GameDirector.TITLE)
