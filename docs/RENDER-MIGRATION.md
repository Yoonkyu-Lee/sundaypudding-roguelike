# RENDER-MIGRATION — 렌더링 엔진 마이그레이션 설계 (웹 DOM → Godot)

> **상태: 회의/설계 진행 중 (2026-06~).** [`PORTING.md`](PORTING.md)(TS→Rust)의 **후속**. PORTING이 "두뇌를 Rust로"였다면 이 문서는 "몸(렌더링)을 진짜 게임 엔진으로". 결정 미확정 — 열린 질문(§4)은 회의로 메운다.

## 0. 배경 · 원칙

### 왜
현 프론트 = **Tauri2 WebView2 안의 DOM/CSS**. 게임 로직을 확인하는 인터페이스로는 충분하나(애셋=아이콘·webp뿐), **애니메이션·영상·3D 전장·2D 스프라이트·카메라 워크**를 제대로 구현해 상용 모바일 게임처럼 포장하려면 웹 렌더링은 천장에 막힌다(게임필·연출·네이티브 배포). → 렌더링 호스트를 **풀 게임 엔진(Godot 4)**으로 교체.

### 엔진 선택 = Godot 4 (회의 잠정 결론)
- 핵심 요구 *"배치는 내가, 디테일 비주얼은 디자이너에게 위임"* → **비주얼 에디터 필수** → Godot/Unity 류. Bevy(순수 Rust)는 에디터 없어 디자이너 위임 불가로 탈락, Unity는 라이선스·C# 재작성 유혹으로 보류.
- **장르 선례 = Slay the Spire 2가 Godot.** 무료·오픈·2D/3D/연출/카메라/영상 내장·콘솔 익스포트.

### 불변 원칙 (마이그레이션 내내 사수)
1. **`spr-core`는 한 줄도 안 건드린다.** 렌더러 독립 결정론 코어(불변 규칙 1·2)가 이 마이그레이션의 보험. 두뇌는 그대로, 몸만 교체.
2. **계약(WHAT)은 보존, 레이아웃(HOW)은 완전 신규.** 화면에 **무슨 정보가 있어야 하는가**(관측·이벤트 = observation/RunView/GameEvent)는 현 프론트에서 그대로 계승. 그러나 **어디에 어떻게 배치되는가**(팝업·3D·오버레이·패널·전장·전투 GUI)는 **전면 재설계** — 상용 모바일 게임 디자인 규칙. 즉 **현 DOM 프론트 = "정보 집합의 레퍼런스 구현"**이지 보존할 레이아웃이 아니다.
3. **결정론 보존.** 로직이 엔진 RNG/물리/프레임을 절대 안 탄다. Godot = 순수 뷰(상태 변이 0). 모든 무작위는 여전히 `state.rng`.
4. **웹 저작 도구는 살린다.** 방금 만든 콘텐츠 에디터(jobs/items/skills/traits/characters)·런 에디터는 **개발자 도구**로 웹에 잔류 — JSON 계약을 Godot도 읽으므로 공유. **웹 스택 = 저작 툴체인, Godot = 플레이어 클라이언트**로 역할 분리.

---

## 1. Godot ↔ Rust 경계 아키텍처

### 큰 그림
```
[Rust]  spr-types ← spr-data ← spr-core ← spr-godot(신규 바인딩 = desktop/ 대응물)
                                              │  GDExtension(gdext), cdylib
                                              ▼
[Godot] SprSession (네이티브 클래스, JSON in/out)
                                              │  Dictionary/JSON
                                              ▼
        GameDirector / BattleDirector (GDScript) ── 현 rustRun.ts / rustBattle.ts 대응물
                                              │  이벤트 로그 → 애니메이션 타임라인
                                              ▼
        Scenes(.tscn) · AnimationPlayer · GPUParticles · Camera (디자이너 저작)
```

### 통합 메커니즘
- **`gdext`**(godot-rust, Godot 4용 `godot` 크레이트)로 `spr-core`를 **GDExtension cdylib**으로 빌드. `.gdextension` 파일로 Godot이 로드. **in-process 네이티브 라이브러리**(별도 프로세스 IPC 아님 — 현 Tauri IPC보다 빠르고 단순).
- 신규 크레이트 **`spr-godot`** = 얇은 바인딩(desktop/ Tauri 레이어의 대응물). `#[derive(GodotClass)]` 구조체 `SprSession`이 `#[func]` 메서드로 현 IPC 커맨드를 1:1 노출:
  - `create_run(seed, run_def_json) -> String(RunView JSON)`
  - `view() -> String`, `enter_node(id)`, `choose_reward(id)`, `buy(id)`, `encounter(id)`, `class_change(...)`, `set_active(...)`
  - 전투: `battle_step()`, `targeting(skill_id)`, …
  - `sheet_data()`, `save() -> String`, `load(json) -> bool`
- **경계 데이터 = JSON 문자열** (잠정 권장). 현 IPC가 이미 JSON over IPC → Rust 쪽 `serde_json` 그대로, Godot은 `JSON.parse_string`으로 Dictionary화. ~100개 타입을 Variant로 손마샬링하는 비용 회피. (대안: 네이티브 Variant/Dictionary 직접 마샬 = 타입세이프하나 작업량 큼 — §4 열린질문.)

### 이벤트 로그 → 애니메이션 ("디렉터" 패턴)
현 구조의 정신적 계승: 매 행동은 **새 view + 이벤트 델타(이번 스텝의 `GameEvent[]`)**를 반환. 지금 `rustBattle`이 `logEvents`를 소비해 주사위·데미지 숫자·상태칩을 그리듯 —

> **BattleDirector가 같은 이벤트 리스트를 소비해 애니메이션 타임라인을 연주한다.** 각 `GameEvent`마다 대응 연출(스프라이트 공격 모션·피격 플래시·데미지 팝업·파티클·카메라 흔들림·상태 아이콘)을 찾아 재생(`await` AnimationPlayer/Tween)하고 다음으로. **이벤트 = 대본, Godot 애니메이션 = 연기.**

이건 현 이벤트 재생(8.5)의 부유한 버전 — 계약 동일, 연출만 풍부.

### 현 DOM ↔ Godot 대응표
| 현재 (web/src/ui) | Godot 대응물 |
|---|---|
| `desktop/`(Tauri IPC) | `spr-godot`(GDExtension 바인딩) |
| `rustRun.ts`(appState·디스패치) | `GameDirector`(autoload Node, 화면 전환) |
| `rustBattle.ts`(전투 루프·이벤트 재생) | `BattleDirector`(이벤트→애니메이션) |
| `runRender.ts`/`renderBattle`(DOM 생성) | `.tscn` 씬 + 노드(디자이너 저작) |
| `shell.ts`(타이틀/허브) | 셸 씬들 |
| 상태칩·HP바·데미지 숫자(DOM) | 씬 노드 + AnimationPlayer/파티클 |

---

## 2. 디자이너 위임 워크플로

ROADMAP의 "엔진+도구=엔지니어 / 콘텐츠=디자이너" 원칙을 **데이터에서 비주얼로 확장.**

### 디자이너 (Godot 에디터에서)
- **씬(.tscn) 제작**: 전투 씬 레이아웃 · 전장(2D/2.5D/3D — §4) · 유닛 스프라이트 씬 · UI 패널 · 팝업/모달 · 오버레이 · HUD(전투 GUI). **상용 모바일 게임 배치 규칙**을 여기서 자유롭게.
- **애니메이션 저작**(AnimationPlayer): 공격 모션·피격 반응·스킬 VFX·파티클(GPUParticles)·카메라 무브.
- **비주얼 스타일**: Theme·폰트·셰이더·화면 전환 — "상용 모바일 게임 룩".
- **콘텐츠↔비주얼 매핑**: charId→유닛 씬, skillId→VFX 씬, statusId→아이콘/애니메이션, eventKind→연출.

### 엔지니어 (당신, 코드/데이터에서)
- `spr-godot` 바인딩 + `GameDirector`/`BattleDirector`(이벤트→애니메이션 오케스트레이션).
- **배선 계약**: "`GameEvent X`가 오면 디렉터가 노드 Z의 애니메이션 Y를 재생한다." **당신이 명명된 훅(hook)을 정의**하고, 디자이너는 그 훅 이름 뒤의 애니메이션을 채운다.
- 매핑 데이터(Godot Resource 또는 기존 JSON 콘텐츠 재사용): 어떤 char/skill/event에 어떤 씬/애니메이션.
- **로직(Rust)·게임 규칙은 손 안 댐.**

### 경계 한 줄 요약
> **엔지니어 = 정보 계약 + 명명된 애니메이션 훅 + 언제 연주할지(디렉터). 디자이너 = 그 훅에서 무엇이 어떻게 보일지(씬·애니메이션·레이아웃).** "메커니즘=디렉터, 값=디자이너 씬."

화면에 **무슨 정보가** 있어야 하는지(HP바·상태칩·서열·명중%·주사위·데미지 숫자 등)는 현 프론트의 관측 집합에서 계승. **어디에 어떻게**는 디자이너의 모바일 게임 레이아웃.

---

## 3. 마이그레이션 단계 계획 (점진 · 병행 · DOM 안 버림)

핵심: Godot 프론트는 **레이아웃 전면 재작성** — DOM UI의 포팅이 아니라, **같은 계약에 대고 새 표현을 새로 짓는다.** TS→Rust 때 골든/differential로 옛 것을 살려둔 규율을, 여기선 "DOM 프론트를 슬라이스 패리티까지 살려둔다"로 적용.

| 단계 | 무엇 | 끝점/검증 |
|---|---|---|
| **R0** 계약 동결 | 관측·이벤트 계약(화면에 있어야 할 정보 집합)을 명문화 — 두 프론트가 지킬 SoT. 현 RunView/BattleView/GameEvent 타입에서 추출 | 계약 문서 = WHAT의 단일 기준 |
| **R1** gdext 스파이크 | `spr-godot` 세움: `spr-core`를 GDExtension으로, `create_run`+`view` 한 메서드가 JSON 반환, Godot 씬이 view를 출력. 게임 아님 | **경계+빌드 파이프라인 입증**(미지 리스크 제거) |
| **R2** 수직 슬라이스 1 = 전투 한 장면 | 전투 씬 하나를 Godot에서 끝까지: 전장+유닛+스킬 1종+이벤트 구동 디렉터. 디자이너가 씬/애니 저작, 당신이 디렉터 배선. **DOM 프론트는 병행 가동** | 이벤트→애니메이션 패턴 + 디자이너 워크플로 입증 |
| **R3** 전투 완성 | 전투 GUI 전체(타겟팅·상태·서열·주사위·전 스킬 VFX·카메라) Godot로 | 전투 패리티 |
| **R4** 런·비전투 화면 | 노드 맵·보상·상점·인카운터·도감·허브 — 모바일 게임 레이아웃 재설계 | 런 전체 패리티 |
| **R5** 셸·세이브·배포 | 타이틀/일시정지/세이브-로드 · 플랫폼 익스포트(데스크톱→콘솔/모바일). **DOM 프론트+Tauri 셸 은퇴**(Godot 패리티 도달 후) | 플레이어 클라이언트 = Godot |

### 살아남는 것 / 은퇴하는 것
- **살아남음**: `spr-core`(그대로) · `web/src/content/*.json`(콘텐츠 계약 공유) · **웹 저작 에디터들**(개발자 도구 = jobs/items/skills/traits/characters + 런 에디터). 웹 스택 = 툴체인.
- **은퇴(R5)**: `web/src/ui/*`(DOM 플레이어 프론트) · Tauri 셸(`desktop/`) → Godot 클라이언트로 대체.

### 병행 안전망
같은 Rust 코어가 두 프론트를 구동하므로 differential 불필요(소스 단일). 리스크는 순수 표현 — 규율 = **슬라이스가 Godot에서 패리티 낼 때까지 DOM을 플레이 가능 상태로 유지.**

---

## 4. 열린 질문 (회의로 메운다)

1. ~~전장 차원~~ **✅ 확정 = 2.5D (HD-2D 라이트).** 2D 스프라이트(빌보드 `Sprite3D`)를 3D 공간에 배치 + `Camera3D`로 깊이·카메라 워크(옥토패스식 공간감). **3D 모델 없음**(스프라이트만 → 디자이너 모델링 부담 0) · **복잡한 3D 시각효과 없음**(볼류메트릭 안개·PBR 반사 X, unlit/flat) · 애니메이션·`GPUParticles3D` juice는 OK. 충실도 기준 = 스타듀밸리/뱀파이어서바이버. → 전투 씬 = 3D 씬(Camera3D + 바닥 + Sprite3D 유닛 + 파티클), UI/HUD = CanvasLayer 2D 오버레이.
2. **경계 데이터 포맷**: JSON 문자열(저마찰, 권장) vs 네이티브 Variant/Dictionary 마샬(타입세이프, 작업량↑). R1 스파이크에서 실측 확정.
3. **언어 경계 범위**: 디렉터 로직을 GDScript로? vs Rust(`spr-godot`)에 더 둘지? — 연출 오케스트레이션은 뷰 영역이라 GDScript가 자연스러움(핫리로드·디자이너 근접). 결정론 로직만 Rust.
4. ~~착수 시점~~ **✅ 결정 = 지금 R1 스파이크.** `spr-core`는 추가 작업 불필요(사용자 확인) — 미지 영역은 종이 설계보다 "뷰 띄우고 거기서 생각"이 빠르다. **분업: 엔지니어가 코드/프로젝트 스캐폴딩 + Rust cdylib 빌드, 사용자가 Godot 에디터로 실행·확인**(GUI는 헤드리스 불가). 전제: Godot 4 설치.
5. **웹 에디터 장기**: 웹 잔류(권장) vs 언젠가 Godot 에디터 플러그인으로 통합.
6. **오디오·입력·세이브**: Godot 내장으로 흡수(현 manual DOM 대비 이득). 세이브 = 현 `run_save`/`run_load` JSON 그대로 `spr-godot` 통해.

---

## 부록 — 참고
- 엔진 선례: Slay the Spire(Java+LibGDX→2는 Godot) · Darkest Dungeon 1/2(Unity).
- gdext = godot-rust 프로젝트(Godot 4 GDExtension). Godot 3의 gdnative 후속.
- 관련 불변식: [`INVARIANTS.md`](INVARIANTS.md)(결정론) · [`SERIALIZATION-CONTRACT.md`](SERIALIZATION-CONTRACT.md)(이벤트 로그) · 게임 명세 [`08-engine.md`](game-design/08-engine.md)(연출=이벤트 재생 8.5).
