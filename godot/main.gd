extends Control
# R1 스파이크 — spr-core(GDExtension)에서 RunView를 받아 표시. 경계 입증용.

func _ready() -> void:
	var label := $Label as Label
	if not ClassDB.class_exists("SprSession"):
		label.text = "❌ SprSession 미등록\nspr-godot cdylib 빌드/경로(spr.gdextension) 확인 필요"
		push_error("SprSession class not found — GDExtension load 실패?")
		return
	var s = ClassDB.instantiate("SprSession")
	var json: String = s.create_run(12345)
	print("=== RunView JSON ===")
	print(json)
	var view: Variant = JSON.parse_string(json)
	if view == null:
		label.text = "⚠ JSON 파싱 실패 (길이 %d)\n%s" % [json.length(), json.substr(0, 400)]
	else:
		var run_name: String = str(view.get("name", "?")) if view is Dictionary else "?"
		label.text = "✅ Rust ↔ Godot 경계 OK!\nRunView 수신 (JSON %d자)\nrun name: %s\n\n(전체 JSON은 출력 패널 참고)" % [json.length(), run_name]
		print("=== 경계 OK: run name = %s (JSON %d자) ===" % [run_name, json.length()])
	# 헤드리스(CLI 검증)면 자동 종료. 에디터/창 실행 시엔 유지.
	if DisplayServer.get_name() == "headless":
		await get_tree().process_frame
		get_tree().quit()
