extends Control
## 전직(classChange) — 현 web runRender 전직 phase. view.classChange{remaining, candidates[{charId,name,jobName,options[{id,name,classReq}]}]}.
## 후보별 직업 옵션 버튼 → class_change(charId, jobId). 건너뛰기 → class_change_skip.

func _ready() -> void:
	$Center/VBox/SkipBtn.pressed.connect(func() -> void: GameDirector.class_change_skip())
	_render()

func _render() -> void:
	var cc: Variant = GameDirector.view.get("classChange")
	if not (cc is Dictionary): cc = {}
	$Center/VBox/Title.text = "🔀 전직 — 남은 %d명" % int(cc.get("remaining", 0))
	var box: VBoxContainer = $Center/VBox/Candidates
	for c in box.get_children(): c.queue_free()
	var cands: Variant = cc.get("candidates")
	if not (cands is Array) or cands.is_empty():
		var hint := Label.new(); hint.text = "(전직 노드에서 표시 — 후보 없음)"
		box.add_child(hint); return
	for cand in cands:
		var lbl := Label.new()
		var jn: Variant = cand.get("jobName")
		lbl.text = "%s%s" % [str(cand.get("name", "?")), (" — %s" % str(jn)) if jn != null else ""]
		box.add_child(lbl)
		var hb := HBoxContainer.new()
		for opt in cand.get("options", []):
			var btn := Button.new()
			btn.text = "%s (%d차)" % [str(opt.get("name", "?")), int(opt.get("classReq", 0))]
			btn.pressed.connect(_pick.bind(str(cand.get("charId", "")), str(opt.get("id", ""))))
			hb.add_child(btn)
		box.add_child(hb)

func _pick(char_id: String, job_id: String) -> void:
	GameDirector.class_change(char_id, job_id)
