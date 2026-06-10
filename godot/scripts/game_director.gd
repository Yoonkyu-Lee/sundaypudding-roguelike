extends Node
## 게임 디렉터 (autoload 싱글톤) — 현 web `rustRun.ts`의 대응물.
## 책임: ① spr-core 세션 보유(GDExtension SprSession) ② 화면 라우팅 ③ (추후) 세이브/이어하기.
## 데이터 에디터(jobs/items/skills/traits/characters·런 에디터)는 웹에 잔류 — 여기 없음(플레이어 클라이언트 전용).

var session: Object = null  # SprSession (spr-godot GDExtension)

# 화면 경로 상수 (셸 맵 — SHELL-DESIGN). 비전투 런 하위화면(reward/shop/encounter)은 run_map이 오버레이로 띄울 예정.
const TITLE := "res://scenes/title.tscn"
const HUB := "res://scenes/hub/hub.tscn"
const CAMPAIGN := "res://scenes/hub/campaign_select.tscn"
const RUN_MAP := "res://scenes/run/run_map.tscn"
const BATTLE := "res://scenes/battle/battle.tscn"
const CHARDEX := "res://scenes/chardex/chardex.tscn"

func _ready() -> void:
	if ClassDB.class_exists("SprSession"):
		session = ClassDB.instantiate("SprSession")
		print("[GameDirector] SprSession 준비됨 (Rust 코어 연결)")
	else:
		push_error("[GameDirector] SprSession 미등록 — spr.gdextension / cdylib 확인")

## 씬 전환. (현 web: appState 변경 + render)
func goto(scene_path: String) -> void:
	get_tree().change_scene_to_file(scene_path)

## 새 캠페인 런 시작 → RunView JSON 파싱본 반환. (현 web: run_create_def)
func create_run(seed: int) -> Variant:
	if session == null:
		return null
	return JSON.parse_string(session.create_run(seed))
