extends Node3D
## 전투 씬 루트 (2.5D) — 현 web rustBattle/renderBattle 대응. HD-2D 라이트:
## Camera3D(틸트 카메라) + Units(Sprite3D 빌보드 유닛) + HUD(CanvasLayer 2D 오버레이).
## BattleDirector가 spr-core 이벤트 로그를 받아 애니메이션 연주(R2). 지금은 뼈대 + 돌아가기.

var director: BattleDirector

func _ready() -> void:
	director = BattleDirector.new(self)
	$HUD/Root/BackBtn.pressed.connect(func() -> void: GameDirector.goto(GameDirector.RUN_MAP))
