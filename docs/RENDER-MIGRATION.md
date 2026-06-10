# RENDER-MIGRATION — 렌더링 엔진 마이그레이션 설계 (웹 DOM → Godot)

> **상태: 구현 진행 중 — R1 완료, R2(전투 씬) 착수 (2026-06~).** [`PORTING.md`](PORTING.md)(TS→Rust)의 **후속**. PORTING이 "두뇌를 Rust로"였다면 이 문서는 "몸(렌더링)을 진짜 게임 엔진으로". Godot 작업 규칙 = [`GODOT-CONVENTIONS.md`](GODOT-CONVENTIONS.md). **상세 진행현황·할일 = §5.**

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
| **R1** gdext 스파이크 ✅ | `spr-godot`(top-level, 독립 워크스페이스) = `SprSession` GDExtension. `create_run`/`view`가 RunView JSON 반환. `godot/`(Godot 4.6.3 프로젝트)가 호출·표시 | **✅ 완료(2026-06)** — 헤드리스 검증: Godot이 익스텐션 로드→spr-core 호출→**2949자 RunView 수신·파싱**. gdext 0.2.4 ↔ Godot 4.6.3 호환. 경계+빌드 파이프라인 입증 |
| **R2** 수직 슬라이스 1 = 전투 한 장면 ⏳ | 전투 씬 하나를 Godot에서 끝까지: 전장+유닛+스킬 1종+이벤트 구동 디렉터. 디자이너가 씬/애니 저작, 당신이 디렉터 배선. **DOM 프론트는 병행 가동** | **⏳ 착수**: 2.5D 보드·HUD 스캐폴드·런 루프 배선 완료. **남음**: battle_obs 실데이터·battle_step 실전투·이벤트→애니(디렉터). §5 |
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

## 5. 진행 현황 & 할일 (상세 기록, 2026-06)

### ✅ 완료 — Godot 클라이언트 현재 상태

**엔진 경계 (`spr-godot/` — top-level 독립 워크스페이스, gdext 0.2.4)**
- `SprSession`(GDExtension) = 현 `desktop/main.rs` IPC 1:1. 모두 JSON 문자열 in/out.
- 명령: `create_run`·`create_run_id`(번들 RunDef)·`create_run_roster`·`create_run_def` · `view` · `enter_node`·`choose_reward`·`buy`·`leave_shop`·`encounter`·`class_change`·`class_change_skip`·`set_active`·`move_party`·`equip`·`unequip` · `battle_init`·`battle_view`·`battle_obs`·`battle_step`·`battle_ai_step`·`battle_targeting` · `sheet_data`·`save`·`load` · 정적 `run_list`(캠페인 목록).
- 빌드: `cargo build --manifest-path spr-godot/Cargo.toml` → dll → `godot/bin/` 복사(수동).

**Godot 클라이언트 (`godot/`)**
- `scripts/game_director.gd` (autoload = `rustRun.ts`): 영속 SprSession + 현재 `view` 보유 + 명령 호출 후 **phase 라우팅**(map/battle/reward/shop/encounter/won/lost). `run_list`/`start_run`/`enter_node`/`choose_reward`/`buy`/`leave_shop`/`encounter`.
- `scripts/battle_director.gd` (= `rustBattle.ts`): 이벤트 로그→애니 디렉터 **스텁**.
- 셸 씬: `boot`→`title`→`hub`(모드 메뉴)→`campaign_select`→`run_map`→`battle`/`reward`/`shop`/`encounter`/`chardex`/`overlays/pause`.
- **Theme**(`ui/theme.tres`) = 웹 `style.css` 다크 팔레트 전역 적용 + 다크 배경.
- **전투 2.5D 보드**(`scenes/battle/battle.tscn`): 정적 보드(바닥·4×4 양진영 셀·카메라)=씬에 박힘(에디터 편집), 유닛 카드·이름표=코드(`battle.gd`). 카메라=사용자 조정(틸트 탑다운, 아군 좌/적 우 마주봄). 진단색=아군 초록·적 보라.
- **전투 HUD 스캐폴드**(`scenes/battle/hud/`): `battle_hud.tscn`(CanvasLayer — 행동서열 패널·스킬바·정보·뒤로) + 반복 원자 `skill_button.tscn`·`turn_chip.tscn` 인스턴스. battle.tscn에 인스턴스로 박힘.
- **런 루프 실데이터 배선**: campaign_select=`run_list` 실런목록 · run_map=`RunView.nodes`(도달가능→`enter_node`) · reward/shop/encounter=`view`의 옵션→`choose_reward`/`buy`/`encounter` · battle=`view.party` 아군.

**환경·도구**
- Godot 4.6.3 포터블 = `tools/godot/`(gitignore). gdext 0.2.4 호환.
- **MCP 연결됨** — `godot-mcp-enhanced`(`.mcp.json`, gitignore, `GODOT_PATH`=console exe). `mcp__godot__screenshot capture`로 **헤드리스 렌더→PNG**, AI가 PNG 읽어 **시각 검증**. + scene/script/game(런타임)/editor 30+ 도구.

### ⏳ 즉시 할일 (다음 작업, 우선순위)

0. ✅ **dll 갱신** 완료(전체 명령 포함). ✅ **slice 1: 노드 맵 렌더링** — `run_map`이 `RunView.nodes(q,r 헥스)+edges`를 2D 그래프로(노드=버튼+아이콘+status색, 엣지=Line2D, web 모방). GameDirector에 `bootstrap_demo`(단독 캡처용). mcp 스크린샷 검증 ✅.
1. **전투 화면 시각 개선**(스크린샷으로 본 것): 유닛 카드(파랑/빨강 쿼드)가 셀에 묻혀 안 보임 → 띄움/대비 · 양 진영 중앙 간격(`SIDE_GAP`) · 이름표 높이. + 노드맵 폴리시(간격·엣지).
3. **전투 실데이터**: `battle_obs`/`battle_view` 연동 → HUD `populate(obs)`(적 배치·행동 서열·스킬·명중%). 지금 HUD·적은 데모.
4. **전투 실전투 진행**: `battle_step`/`battle_ai_step` 루프(스킬 선택→타겟→실행→이벤트). **지금 전투 back버튼은 엔진 우회**(battle phase 미해소).
5. **이벤트→애니메이션**: `BattleDirector.play_events` 실구현(이벤트별 연출 훅).
6. **남은 화면 모방**: 허브 모드카드(현 단순 버튼) · 도감(charDex, 웹은 정교) · classChange 화면(없음) · won/lost 결과(현 허브로 우회).
7. **run_map 헥스 시각배치**: 현재 노드 리스트(버튼) → q·r 좌표 헥스 맵.

### 🔁 워크플로 (MCP로 바뀐 점)
- **AI 자율 시각 루프**: 만들고 → `screenshot capture`(헤드리스) → PNG Read로 **내가 보고** → 고침. 스크린샷은 `D:\tmp`에(레포 청결).
- 헤드리스 캡처 = `mcp__godot__screenshot`(GODOT_PATH로 씬 실행). 라이브 게임 조작·UI클릭 = `mcp__godot__game`(브리지, 에디터+플러그인 필요).
- 여전히 사람: 미적/재미 판단, 실제 아트(스프라이트·파티클), 애니 키프레임.

### 🛑 주의·함정
- **dll 잠금**: Godot 에디터 열려 있으면 `cp ...dll` 실패(busy) → 에디터 닫고 갱신.
- **co-edit 충돌**: `battle.tscn` 등은 에디터(사용자)+파일(AI) 양쪽 수정 가능 → 한쪽이 저장하면 덮어씀. 구조 변경은 파일, 시각 튜닝은 에디터로 역할 분리. 에디터가 uid·unique_id 추가/정규화함.
- **규칙 SoT** = [`GODOT-CONVENTIONS.md`](GODOT-CONVENTIONS.md)(씬=모듈·정적/동적·엔진링크·자동화 범위).

---

## 부록 — R1 빌드·실행 레시피

```bash
# 1) cdylib 빌드 (gdext + spr-core)
cargo build --manifest-path spr-godot/Cargo.toml
# 2) dll을 프로젝트 안으로 복사 (res://는 프로젝트 밖 ../ 불가 → godot/bin/)
cp spr-godot/target/debug/spr_godot.dll godot/bin/        # win: Copy-Item
# 3) 에디터 임포트 1회 — .godot/extension_list.cfg 생성(GDExtension 등록). 클론/최초 1회
tools/godot/Godot_v4.6.3-stable_win64_console.exe --headless --editor --quit --path godot
# 4-a) 헤드리스 검증(CLI): print에 "경계 OK …" 떠야 함
tools/godot/Godot_v4.6.3-stable_win64_console.exe --headless --path godot
# 4-b) GUI: Godot 에디터로 godot/ 열고 F5 → 화면에 "✅ 경계 OK" 라벨
```
- 미래 자동화: dll 복사를 cargo post-build/스크립트로(현재 수동). `godot/bin/`·`godot/.godot/`·`spr-godot/target/`·`tools/godot/`는 gitignore(아티팩트/바이너리).
- 알려진 함정: ① `res://../`로 프로젝트 밖 dll 참조 불가 → `bin/`에 복사 ② 에디터 임포트 전엔 GDExtension 미등록(extension_list.cfg 없음) → 최초 1회 `--editor --quit`.

## 부록 — 참고
- 엔진 선례: Slay the Spire(Java+LibGDX→2는 Godot) · Darkest Dungeon 1/2(Unity).
- gdext = godot-rust 프로젝트(Godot 4 GDExtension). Godot 3의 gdnative 후속.
- 관련 불변식: [`INVARIANTS.md`](INVARIANTS.md)(결정론) · [`SERIALIZATION-CONTRACT.md`](SERIALIZATION-CONTRACT.md)(이벤트 로그) · 게임 명세 [`08-engine.md`](game-design/08-engine.md)(연출=이벤트 재생 8.5).
