extends RefCounted
class_name BattleDirector
## 전투 디렉터 — 현 web `rustBattle.ts`의 대응물. **이벤트 로그 → 애니메이션 타임라인**.
## spr-core가 반환한 GameEvent[]를 받아, 각 이벤트를 대응 연출(스프라이트 모션·데미지 팝업·파티클·카메라 워크)로
## 순서대로 await 재생한다. "이벤트 = 대본, Godot 애니메이션 = 연기"(불변 4 / GAME-DESIGN 8.5).
## R2 수직 슬라이스에서 실제 구현 — 지금은 계약 뼈대(스텁)만.

var battle_root: Node3D  # 전투 씬 루트(2.5D)

func _init(root: Node3D) -> void:
	battle_root = root

## 이벤트 리스트를 순서대로 연주(각 이벤트 애니메이션 await). 스텁.
func play_events(events: Array) -> void:
	for ev in events:
		var kind: String = str(ev.get("kind", "?")) if ev is Dictionary else "?"
		# TODO(R2): kind별 연출 매핑 — attack/hit/damage/applyStatus/death/dice/move/summon …
		print("[BattleDirector] (stub) event: ", kind)
