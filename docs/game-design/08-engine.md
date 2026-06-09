<!-- docs/DOC-INDEX.md(인덱스)의 한 장(章). 절 번호(예: 8.8·4.7)는 전체 명세 기준 안정 식별자 — 타 문서는 "GAME-DESIGN 8.8"로 이 번호를 참조한다. 인덱스: ../DOC-INDEX.md -->

## 8. 자체 엔진 & 모니터링 인프라

> 목표: 게임 시스템을 **사람 육안으로 확인 가능** + **AI가 직접 플레이 가능** + **모니터링이 아주 잘 되는** 자체 엔진.

### 8.1 근본 아키텍처 — 헤드리스 코어 + 다중 뷰

| 계층 | 역할 | 상태 |
|---|---|---|
| **코어(Core)** | 렌더링 0 의존. `상태 + 행동 → 다음 상태`인 **순수 시뮬레이션**. 상태를 구조화 데이터로 통째 노출 | ✓ |
| **텍스트 뷰 / CLI** | 보드를 matrix/array 텍스트로 출력 + 터미널 명령으로 행동 주입 — **AI·모니터링의 1급 인터페이스** | ✓ |
| **웹 렌더러(사람용)** | 코어 상태를 예쁘게 그림. **AI 플레이에 불필요**(사람 관전·플레이용). 후순위 | ✓ |

> 셋이 같은 코어를 공유 → "사람이 보는 것 = AI가 읽는 것 = 진실" 자동 보장.

### 8.2 ★ AI 인터페이스 원칙 — "터미널로 플레이"

> **AI는 스크린샷이 아니라 구조화된 관측(observation)과 터미널 명령으로 게임을 완전히 플레이한다.**
> 이는 수치 투명성(0.2)의 기계 버전: **결정에 필요한 모든 정보가 observation에 있어야 한다(픽셀에 숨은 정보 0).**

| 요구 | 내용 | 상태 |
|---|---|---|
| **완전한 관측** | 보드 그리드(4×4 등)·유닛 스탯(원본+현재)·턴 서열 배열·상태이상 원장·쉴드 등 **모든 상태를 matrix/array/JSON로** | ✓ |
| **행동 공간 질의** | 현재 합법 행동(어떤 유닛이 어떤 스킬을 어느 칸에)을 **열거/질의 가능** → AI가 골라서 주입 | ✓ |
| **터미널 명령** | CLI로 상태 읽기 + 행동 실행 | ✓ |
| ASCII 렌더 | 보드를 텍스트 격자로 — 사람·AI 공통 가독 | ✓ |

### 8.3 ★ 결정론 + 시드 (1급 요구사항)

| 요구 | 내용 | 상태 |
|---|---|---|
| 결정론 | 전투는 주사위 천지(SPD·크리·명중·보상 추첨) → 코어는 **시드 기반 결정론**: *같은 시드 + 같은 행동 = 항상 같은 결과* | ✓ |
| 리플레이 | 시드 + 행동 로그로 **판 전체 재현**(버그 재현·"이 판 다시 보기") | ✓ |
| 이벤트 로그 | 모든 상태 전이를 이벤트로 기록(모니터링·디버깅) | ✓ |

### 8.4 기술 스택 — TypeScript 단일 (확정)

| 항목 | 결정 | 상태 |
|---|---|---|
| 스택 | **TypeScript 단일.** 코어(헤드리스, Node) + 웹 렌더러(사람) 동일 언어, **레이어로 분리** | ✓ |
| Tauri 비교 | 분리 철학은 같음(사람↔프론트 / AI↔코어). 단 언어는 하나라 IPC·직렬화 부담↓, 타입 공유 | ✓ |
| 내가 플레이 | 프론트 미경유. Node로 코어 직접: `getObservation()` / `getLegalActions()` / `step(action)` | ✓ |
| 결정론 | `Math.random` 금지 + 시드 PRNG + 정수/고정소수 연산 규율로 확보 | ✓ |
| 이주 경로 | 후일 네이티브·고성능 필요 시 **순수 코어만 Rust로 포팅(→Tauri)** 가능 | ✓ |

### 8.5 연출(그래픽/애니메이션)은 "이벤트 로그의 재생"

| 항목 | 결정 | 상태 |
|---|---|---|
| 원리 | 코어는 상태전이를 **이벤트 로그**(8.3)로 기록. **프론트가 그 이벤트 스트림을 연출로 재생** | ✓ |
| 분리 | 로직(무슨 일) ↔ 연출(어떻게 보임) 완전 분리 → 그래픽은 **로직 0 수정, 순수 추가** | ✓ |
| 일관성 | 리플레이·모니터링용 이벤트 로그 = 애니메이션 구동원. 연출 타이밍이 결과에 영향 못 줌 | ✓ |
| 후보 렌더 | DOM(최소) → PixiJS/Phaser(2D 스프라이트·트윈) → WebGL/Three (고급) | ✓ |

### 8.6 데이터 주도 설계 (1급 원칙, 확정)

| 항목 | 결정 | 상태 |
|---|---|---|
| 원칙 | **스킬·상태이상·캐릭터·전투장·열보너스 배치를 전부 데이터 파일(JSON 등)로** 정의. 엔진은 해석만 | ✓ |
| 효과 | 대원칙 0.1(엔진=일반형) 실현 + "디자이너 자유 설계"(6.3) + "모드=설정 제한"이 **코드 수정 없이** | ✓ |
| 타입 스키마 | 데이터 스키마 = 사실상 명세서 (북극성 "구조로 알기"의 코드 버전) | ✓ |

### 8.7 구현 상태

**✅ 스캐폴딩 완료 (핵심 전투 수직 슬라이스)** — `src/`, 실행법 `README.md`.
- **엔진 = Rust(`rust/spr-core`)** — TS→Rust 마이그레이션 완료(전투·AI·런 오케스트레이션·세이브, 결정론·differential 바이트검증). `src/contract/`=프론트↔엔진 계약 타입(content 스키마/runtime DTO) + 순수 유틸(graph). 옛 TS 엔진은 `archive/ts-core`+tag `ts-golden-oracle` 보관. 모듈 트리·기능 색인=`docs/CODE-MAP.md`, 마이그레이션 이력=`docs/PORTING.md`. **(아래 8.7 서술의 `src/core`·`src/data`·`src/web` 등 경로는 마이그레이션·워크스페이스 재구조 전 기록 — 현 매핑은 CODE-MAP: 엔진=`engine/`, 프론트=`web/src/ui`, 콘텐츠=`web/src/content`, 계약=`web/src/contract`)**
- 데이터 주도(`src/data/`): 상태이상·스킬·캐릭터·전투배치.
- 구현됨: 4×4 그리드·라운드제 SPD서열·1턴1행동·위치마스크·스킬상수데미지·명중·치명·쉴드·쿨타임·끼어들기(self/대상아군·웹 targetCell 경로 해소)·동적재배치·**자발적 대기(턴 넘김, 쿨 미소모)**·승패·시드결정론·이벤트로그·**상태이상 원장 출처(유닛+스킬)**·포메이션 열보너스(총량보존, 보스 적용규칙)·**아군 진형 편성**(비전투 시 4×4 그리드 자유 배치/교대, 열 선택으로 공격/방어 보너스 조정, 6장).
- **상태이상 전체**: 전역(화상/중독/출혈/마비/동상/빙결/공포) + 특수(관통/재생/불사) + 공위증(데미지 합연산). 공포=쉴드 잠식 가속, 관통=쉴드 무시, 불사=1턴 생존, 재생=HoT.
- **웹 렌더러 v3**(`src/web/`, Vite `npm run dev`, HMR 라이브; 전투 뷰는 `web/battle/*` 모듈화): **3열 레이아웃**(타임라인 좌측 세로 │ 전장+행동 중앙 │ 로그 우측, 가로폭 활용)·**규격 통일 4×4 그리드**(아군/적 칸 크기·아바타 박스 동일)·유닛카드(아바타·이름·포메이션·**쉴드바(체력바 위 좌측정렬, hpMax 대비 비율)**·HP바·상태칩)·**동적 삽입형 타임라인**(완료✓/현재▶/예정, 끼어들기 초록 동적 삽입, 사망 회색)·**2단계 타겟팅 GUI**(스킬 선택→유효칸 하이라이트+머리위 명중%(2.7)+캐스터→타겟 눈금 화살표+호버 시 HP 깎일 양 깜빡 미리보기(0.2))·**균일 스킬 카드**(타입 색칩(공격/지원/강화/약화/기동) + ⏱쿨·🎯명중·💥피해 아이콘 / 사정권·AoE 규칙 투명 표기 / 특징 칩)·**상태이상 상세 팝오버**(호버·포커스로 펼침: 거동설명·스택·지속·다음변화·**출처 "유닛 — 스킬"**(3.1 원장, 관측 노출)) — **유닛 활성 상태칩뿐 아니라 스킬의 부여효과 칩(스킬카드·편성)에도 동일 팝오버**(부여 전에 효과 미리 확인, `describeStatus` 재사용)·**대기 버튼**(턴 넘김)·**타겟팅 점유칸 빨강 풋프린트**(범위공격 명확, AoE는 영향 칸 전체에 HP 미리보기)·**빈 칸 타겟팅 화살표**·**이동 펄스**(재배치 피드백)·**파티 편성(통합 파티뷰, 맵)**(요약 카드/'⚙ 파티 편성' 버튼 → 오버레이: 좌 4×4 진형 보드 **드래그앤드롭 배치/교대** + 열 보너스 힌트(앞=공격/뒤=방어, 총량÷인원), 우 선택 캐릭 상세) + **캐릭터 시트**(전투 유닛카드 ℹ는 **아군·적 단독 모달**(uid 키, 읽기전용 — 적도 능력치·learnset 열람: 관측 투명성 0.2) — **체력/쉴드바**·능력치(**'자세히 보기' 토글**: 기본 현재값, ON이면 `[원본]+변화` 병기)·**상태이상 섹션**(전투 중 칩+팝오버)·3 장착칸(장착·교체·해제+인벤토리 픽커, 지닌물건 잠금)·보유 스킬; 맵=장착·활성4·진형 조작, 전투=읽기전용)·**라운드 시작 SPD 주사위 연출 = 행동서열 패널의 한 모드**(별개 오버레이 아님): 패널이 중앙 확장→유닛별 주사위 굴림→±speedDown→최종 SPD→서열 정렬 후, **같은 행이 FLIP 슬라이드로 좌측 레일에 도킹**해 전투 타임라인(live)으로 연속 전환. 매 라운드·클릭 스킵; `roundStart` 이벤트 `rolls` 재생·이벤트 로그 재생·피격 플래시. 코어 무수정 브라우저 구동.

- **확장 프리미티브**: 광역(AoE)·투지/약화(공격±)·예리/은신(치명±)·무적·도발(AI 반영)·마비(SPD↓)·정화·applyStatusSelf.
- **아바타 시스템 + 야인시대 테마 로스터**(임시 콘텐츠): 우익(김두한·상하이조·신영균·조병옥) vs 좌익(정진영·김천호·심영·의사양반) + 잡몹. 아바타=이모지 플레이스홀더(저작권 안전, 추후 이미지 교체). 스킬은 제미나이 초안을 우리 엔진 규칙으로 매핑.
- **런(7장)**: **헥스 타일맵**(axial 좌표, 좌표 인접성=간선, 보스 방향 진행, start↔boss 프루닝, 결정론) — **생성 값(노드 타입 가중치·분기 확률·깊이·시작너비)은 데이터화**(`data/maps.ts` `MapGenConfig`, 메커니즘=`genMap` 엔진), 6 노드타입, 전투 노드↔engine 연결, 파티 HP·런빌드 전투 사이 유지, 보스전 적 진형 보너스(6.3), **다층(7.3, 3액트 고정)**: 액트별 맵(`data/maps.ts ACTS` — 깊이·엘리트 가중 램프), 액트 보스 격파→`advanceAct`(다음 액트 새 맵·파티/빌드 유지·50% 회복), **3액트 보스=게임 클리어**(`RunState.act`/`acts`, 결정론 `run.rng`). 승=최종보스격파/패=전멸. **휴식**=50% 회복. **상점**(7.2)=골드로 강화권(4.6 상점 전용)/범용기/회복 구매·나가기. **인카운터**(7.2)=이벤트 선택지(확정/도박, 생존 보장 — 피해는 최소 HP1). **런 골드**=전투 승리(일반 8/엘리트 16)·인카운터로 획득, 상점서 소비(**메타 재화와 별개**, 380행). 웹: 맵·보상·**상점**·**인카운터**·결과 화면 + 골드 표시.
- **육성(4장, 스킬 중심)**: **스킬 보유 풀 + 전투 전 활성 4선택**(`PartyMemberState.ownedSkillIds`/`activeSkillIds`, 맵 로드아웃 UI 토글) · **강화 티어**(4.6: `Skill.nextTierId` 데이터 체인, 보상 강화=다음 티어 id로 교체, 데미지↑/효과추가) · **전용기/범용기**(4.6: `Skill.exclusiveTo`=전용기 소유자/없으면 범용기; **learnset=`Character.skillIds`** 멤버십이 학습 가능 여부 결정, 포켓몬식; 범용기 `u_*`는 중립 네이밍·여러 learnset 공유, 전용기는 플레이버 이름+★) · **보상 3택1**(4.5: 강화 또는 새 스킬 학습, learnset에서 추첨 → 게이팅 자동; `maxhp` 보상 제거 — 4.2 스탯=장착으로만 준수). **데이터 주도 — 새 전투 프리미티브 0**(티어/범용=데이터 엔트리, 게이팅=learnset).
- **숙련도 메타(4.4/5.3) + 모드 스캐폴드(0.1/7.4)**: 캐릭별 **영구 숙련도**(레벨/XP, 전투 승리마다 소량 — `web/meta.ts`, 별도 세이브 `spr_meta_v1`)가 **보상 스킬 tier를 해금**(`run/rewards.ts unlockedTier`, `genRewards`·`generateShop` 게이팅; `useMastery` off면 전 tier). 런 시작 시 `PartyMemberState.masteryLevel` 스냅샷. **게임 모드 = `GameMode` 데이터**(`data/modes.ts`, roster·acts·useMastery) — '일반' 1개, 디자이너가 캠페인/챌린지를 데이터로 추가. 허브에 숙련도 패널.
- **본거지 캐릭터 편성(데이터-온리)**: `Character.playable` 플래그로 정의되는 **플레이 가능 풀**에서 본거지가 **1~4명 선택**(`shell.ts renderHub` 선택 그리드, `web/meta.ts getRoster/setRoster`로 영구 저장). 선택 로스터는 `data/modes.ts rosterFromIds`로 기본 포메이션에 배치 후 `createRun`(엔진 무수정 — 1~4명 파티 지원). 디자이너가 캐릭터+스킬을 추가하고 `playable:true`만 붙이면 즉시 편성·테스트·밸런싱. 런 중엔 편성 잠금.
- **특성(trait)/패시브(passive) 룰 엔진(엔진 프리미티브 추가)**: 비능동 상시 효과를 `when/if/then` 룰로 데이터화. 특성=캐릭터 정의(`data/traits.ts`+`traitIds`, **항상 켜짐**), 패시브=스킬 **출전(활성 4)** 시 작동(`Skill.passives`, `active:false`=순수 패시브/공존=하이브리드). 디스패처=`combat/passives/`(전투 훅 인라인 `fireTrigger`, **활성 스킬 패시브+특성을 `Unit.rules` 컴파일**, 결정론 정렬·깊이/재진입 가드·maxPerTurn/Battle). 전투 스코프 Trigger/Condition/Effect 전체 + `statMod`/주사위 조작. GUI=charSheet 「특성」 섹션·스킬 패시브 칩(`web/battle/passiveDesc.ts`), 순수 패시브는 스킬창 비노출. 카탈로그=`src/data/README.md`. **모험(run) 스코프도 구현**: `run/passives.ts fireRunTrigger`가 노드 진입/클리어·액트 시작·골드 획득·파티 HP 변화 트리거 + `goldDelta`/`healParty`/`grantRunStatus`(다음 전투 계승=`pendingStatuses`) 효과 + `nodeTypeIs`/`goldAtLeast` 조건 해석(재진입 가드).

- **장착 아이템(4.3)**: 무기(공격상수 dmgFlat·치명 보정)·방어구(HP·쉴드획득 보정), 지닌물건은 후속(슬롯 잠금). `ItemDef`(데이터)+`data/items.ts` / 엔진=makeUnit 비-HP 스탯 합산+`equipDmgFlat`/`equipShieldGainAdd` read훅, HP는 equipItem이 maxHp 재계산. **파티 공유 인벤토리**(`RunState.inventory`) — 상점 `buyItem`·보상 장신구로 획득, **맵에서만** 캐릭터 시트로 장착/교체/해제. 스탯=오직 장착(4.2) 준수. `[엔진 프리미티브 추가]`.

**☐ 미구현 (다음 슬라이스)** — 우선순위 SoT = [`ROADMAP.md`](../ROADMAP.md)(현행 순서는 ROADMAP 참조 — 2026-06 인터뷰로 재정렬됨). 아래는 과거 미구현 기록(상당수 완료).
- **적 전용 AI/패턴(엔진 프리미티브 추가)**: 우선순위 룰 프로파일(`AiProfile`)을 데이터(`data/ai.ts`)로, 캐릭터가 `aiProfileId`로 참조. 엔진 `ai/profile.ts`가 해석(매 턴 합법행동을 prefer/target/weight로 스코어→최고점, 미적용 시 공유 그리디 fallback). 좌익 4명에 healer/assassin/guardian/skirmisher 배정. 결정론(rng 미사용)·데모 골든 불변(데모=잡몹, 프로파일 없음). 카탈로그·작성법=`src/data/README.md`.
- **런 에디터 GUI(웹 기능 — 엔진/스키마 불변)**: 타이틀 진입 → 런 목록(repo+드래프트 병합) → 단일 층 헥스 에디터(카탈로그 드래그 배치·노드 선택/삭제·인접 무방향 변 토글·실시간 `validateRun`)·층 그래프 패널(선형 추가/선택/삭제/순서). 드래프트=localStorage(`spr_editor_drafts_v1`), **JSON 내보내기**로 `src/data/runs/` 커밋(배포 진실). 테스트플레이=`createRun(draft)`. `src/web/editor/`(store·ops·controller·editorRender·editView). **후속**: 분기 층 그래프·노드 메타데이터·dev-write 미들웨어.
- **맵 엔진 대개편(엔진 프리미티브 추가)**: 좌표암시 헥스 → **헥스 인접 무방향그래프**(맞닿은 헥스끼리 변, 디자이너 토글) + **재방문 불가 이동**(미방문 이웃, 막힌노드 비활성) + **클리어 노드**(도달=층 종료, 보스=길목, 다중 보스/클리어 갈림길) + **런=층 선형체인**. 절차생성 폐기, **저작 런 JSON**(`data/runs/*.json`)만. 엔진 `run/graph.ts`(인접·도달성·검증), 스키마 `types/map.ts`, 야인시대 런 재저작. 웹=무방향 변 선·클리어 노드 시각. **남은 절반(다음 스펙)**: 런 에디터 GUI(런 CRUD·3패인 드래그드롭·저장 검증) + 분기 층 그래프 + 노드 메타데이터.
- 본산 메타 재화·추가 해금(5.3 다, 5장 일부 — 숙련도 XP/tier 해금은 구현) · 여러 모드(캠페인/챌린지) 데이터·모드 선택 UI · 적 스탯 층 스케일링 · 웹 렌더러 고도화 · 밸런싱(골드/가격·이벤트 풀·숙련도 곡선)
  - (해소됨) ~~근접 도달불가 교착~~ → **`reach` 프리미티브**(동적 도달, 2.4): 근접 스킬은 정적 전방 마스크 대신 "최전열(살아있는 적 최소 열)부터 연속 n칸"을 타격 → 후열만 남아도 그게 전열이 되어 항상 도달, 교착 불가. 빈 열을 건너뛰지 않음(근접=인접, 원거리화 방지).
- `x`(보유 스킬 상한), DoT `x`(스택당 피해) 등 밸런스 수치 (현재 placeholder 값으로 동작 중)

### 8.8 데이터 ↔ 엔진 경계 + 프리미티브 카탈로그 (1급 원칙, 확정)

8.6의 "메커니즘=엔진, 값=데이터"를 **누가 무엇을 만지는지**로 구체화한다. 이 경계가 모호하면 엔진에 콘텐츠가 슬금슬금 하드코딩되거나, 반대로 표현 불가능한 걸 데이터로 우겨넣게 된다.

| 영역 | 누가 | 무엇 | 어디 |
|---|---|---|---|
| **데이터** | 게임 디자이너 | 콘텐츠(스킬·상태이상·캐릭터·전투배치·노드 구성·열보너스). 기존 프리미티브의 **조합/수치** | `web/src/content/*` + `web/src/contract/types/content.ts` 스키마 |
| **엔진** | 게임 엔지니어 | 데이터를 해석하는 **메커니즘=프리미티브**(원자적 알고리즘) | `engine/spr-core`(전투·AI·런) |

**프리미티브 카탈로그 (현재 엔진이 제공하는 원자)** — 디자이너는 이 목록의 조합으로만 콘텐츠를 만든다:
- **SkillEffect 종류**: `damage`·`status`·`shield`·`heal`·`move`·`interrupt`(+`applyStatusSelf`/정화). 효과 디스패치는 `combat/skills.ts`.
- **StatusDef 거동 필드**: DoT/HoT(틱 타이밍 turnStart/turnEnd/onAct)·SPD배율·주는뎀배율·받피해(쉴드잠식)·쉴드무시·1턴생존·crit±·공격±·도발·정화 등. 해석은 `combat/status.ts`+`util.ts`.
- **AreaShape 종류**: 단일·열·행·십자·면적(앵커 기준). 계산은 `combat/targeting.ts`(`computeAreaCells`).
- **Skill 필드**: `cooldown`·`accuracy`·사용가능칸/타겟칸 마스크·**`reach`(동적 도달 — 최전열부터 연속 n칸, 빈 열 건너뛰지 않음, 교착 방지, `targeting.ts reachableColumns`)**·`area`·`grantsInterrupt(To)`·`alwaysHit`.
- **TurnOrderResolver**: 라운드제(상수/SPD 주사위 서열). `combat/turnOrder.ts`.
- **특성/패시브 룰 엔진(when/if/then)**: 상시 효과의 디자이너 언어. `PassiveRule = {when:Trigger, if?:Condition[], then:Effect[]}`. **특성**=캐릭터(`data/traits.ts` `TraitDef`+`Character.traitIds`, 항상), **패시브**=스킬 **출전(활성 4)**(`Skill.passives`, `active` 태그로 능동/하이브리드 구분). 전투 훅이 `combat/passives/`의 `fireTrigger`를 인라인 호출(결정론 정렬·재진입 가드). **Trigger**(battleStart/round/turn/everyN/speedRoll/hit/miss/damage/heal/shield/status/move/kill/death/battleEnd…) · **Condition**(hpPct/round/everyN/hasStatus/위치/진영수/chance…) · **Effect**(damage/heal/shield/applyStatus/cleanse/removeStatus/move/grantInterrupt/statMod/modCooldown/modSpeedRoll/rerollSpeed/healByDamage(흡혈)/reflectByDamage(비율반사)/castSkill(액티브 자동시전; **leaf 스킬만**=passives 없는, `validateCastSkill`가 check 게이트서 강제·재귀 방지) · EffTarget other*=자신/대상 제외 광역). 적도 같은 엔진(skillIds passives + traitIds) — 적 특성 콘텐츠 가능. 카탈로그·작성법 = `src/data/README.md`. **모험(run) 스코프**: `run/passives.ts`가 `nodeEnter`/`nodeClear`/`actStart`/`goldGain`/`partyHpChange` 트리거 + `goldDelta`/`healParty`/`grantRunStatus`(계승) 효과 + `nodeTypeIs`/`goldAtLeast` 조건 해석. 전투/모험 같은 `PassiveRule` 스키마 공유.
- **런 노드 해소(레이어 시퀀서)**: 모든 콘텐츠 노드 = 레이어 시퀀스(`MapNode.core: Layer[]`, 없으면 타입 기본 `data/nodeCores.ts defaultCore(type)`)를 순서 실행. start/clear만 구조 노드. `core/run/{layers,run,shop,encounter,rewards}.ts`. **레이어 종류**(InteractiveLayer): `combat`(인라인 `roster` 적 구성 + `boss` + 트리거 `rules`(owner)) · `reward`(`tier`로 선택지·아이템 가산) · `shop`(아래) · `event`(인라인 `EncounterEvent` 또는 전역 풀). 데코(DecoratorLayer): `gold`/`heal`/`grantStatus`/`text`. **상점 진열 저작**(`shop` 레이어 `offers?: ShopOfferDef[]` + `keepGenerated?`): 지정 시 디자이너 진열(`buyItem`/`heal`/`learn`)을 ShopOffer로 구체화(`generateShop`), 없으면 파티 기반 절차생성. `keepGenerated`=저작+절차 병행. learn은 편성 파티원 대상일 때만. **인카운터 선택지 `gamble {chance,win,lose}`**=확률 분기 결과(`encounter.ts rng.chance`).
- **맵 그래프(헥스 인접 무방향그래프 + 층 그래프)**: `RunDef = { entryFloorId, floors: FloorDef[] }`(층 그래프 — clear `toFloor`로 연결, 없으면 승리, 분기 가능), `FloorDef = { entryNodeId, nodes: MapNode[], edges: MapEdge[] }`, `MapNode = { id, type, q, r, toFloor?, label?, layers?, core? }`(**`label`**=표시 라벨, **`core`**=레이어 시퀀스, **`layers`**=onEnter/onResolve 데코), **무방향 변**(맞닿은 헥스끼리만). 엔진 `run/graph.ts`: `hexAdjacent`·`neighborIds`·`liveReachable`(재방문 불가·막힌노드 비활성)·`validateRun`(인접 변·도달성). 클리어 노드 진입=층 종료, 보스=길목. 저작=`data/runs/*.json`(레포 JSON, 에디터 출력). 스키마=`types/map.ts`. (구 `genMap`/`MapGenConfig`/`GameMode` 폐기)
- **AI 행동결정 정책(우선순위 룰)**: "턴이 왔을 때 합법 행동 중 무엇을 고를지"의 디자이너 언어(반응형 패시브와 별개의 *능동* 결정). `AiProfile = { rules: AiRule[] }`, `AiRule = {if?:AiCondition[], prefer?:SkillKindPref, target?:TargetPref, weight?}`. 위→아래 첫 적용가능(조건 참 AND 합법행동 존재) 룰이 결정, 없으면 **공유 그리디 fallback**(도발 우선·최저 HP·최고 명중). **prefer**(damage/heal/shield/applyStatus/cleanse/any) · **target**(lowest/highestHpEnemy·lowestHpAlly·front/backmostEnemy·self·anyEnemy/Ally) · **AiCondition**(selfHpPct·ally/enemyHpPctBelow·self/enemy HasStatus·selfMissingStatus·round·outnumbered·allyCount) · **weight**(backline/frontlineTarget·lowHpTarget·hitChance·critChance, 보조 정렬). 캐릭터가 `aiProfileId`로 참조(없으면 그리디=기존 동작). 결정론(rng 미사용, 동점=인덱스). 스키마=`core/types/ai.ts`, 해석=`ai/profile.ts`, 콘텐츠=`data/ai.ts`. 작성법=`src/data/README.md`.
- **전직(전직 시스템) [설계 확정·미구현 — ROADMAP #1]**: 캐릭터 전속 직업 트리(`JobDef`+`advancesTo`+`Character.rootJobId`)로 **런 한정 빌드 분기.** 전직 = 패시브(`TraitDef`) 부여 + 차수(`classReq`) 전용 스킬 보상 해금. 분기 차이=패시브뿐(스킬 풀은 차수 공유). 스킬 게이트 3축 독립: `tier`(강화)·`masteryReq`(숙련도)·`classReq`(전직). 신규 프리미티브: `classChange` 레이어(인원 캡)·`RunState` 전직상태·보상 게이트·런-trait 반영. 데이터=`web/src/content`, 엔진=`engine/spr-core`. 상세 4.7.
- **런 모드(`RunDef.mode`) [2026-06]**: 런이 자기 모드를 들고 있다(`campaign` | 향후 기본/종결). 셸이 모드별로 런을 필터해 노출(허브 → 캠페인 모드 → mode==campaign 런 목록). 에디터에서 런 생성 시 설정. **캠페인 = 주인공 단신/고정 로스터 강제**(자유 편성 금지) — 스토리 모드. 데이터(런 필드) + 웹(허브 분기) + 엔진(createRun이 런 자체 roster 사용). SHELL-DESIGN D7·D8.
- **파티 변동(`partyChange` 레이어) [2026-06]**: 런 도중 동료 **합류/이탈**(데코 즉시 레이어 `{add?:charId[], remove?:charId[]}`). add=새 `PartyMemberState` 생성(skillIds·rootJob·진형 빈 슬롯), remove=charId 제외. `RunState.party` 동적 변경·세이브 왕복. 캠페인 단신 시작과 짝(예: 야인시대 런1 소년두한 단신→2층 개코·정진영 합류). 엔진=`engine/spr-core/run`(`build_party_member` 헬퍼), 노드 저작=`Layer`.
- **소환(R2, `SkillEffect::summon`) [2026-06]**: 전투 중 시전자 측(아군) 빈 슬롯에 **임시 유닛** 생성(`{charId,count?,duration?}`), duration 라운드 후 만료 소멸. 개코 거지패·세력 증원. 구현: 전투 생성 시 아군 스킬의 summon charId를 스캔해 `GameState.summon_templates`에 사전 빌드(전투 step 중 chars 없이 복제) → `summon_units`(빈 슬롯 배치·`summoned`/`expiresRound` 표식) → 라운드 시작 시 만료 제거. 다음 라운드 서열에 자동 합류(서열은 매 라운드 생존 유닛으로 재계산). 엔진=`engine/spr-core/battle`(템플릿·만료)·`skills`(summon_units). 골든 무변(미사용 시 필드 직렬화 생략).
- **런 자원 게이지(R1) [2026-06]**: 전투 밖 **런-영속 명명 자원**(민심·명예·토사구팽 등). `RunDef.resources: ResourceDef[]`(`{id,name,min,max,initial,icon?}`) 선언 → `RunState.resources`(id→값, 순회=def 순서). 변경=`Layer::Resource{id,delta}`(데코)·`EncounterOutcome::resource`(min/max 클램프). **게이팅**=`EncounterChoice.requires{resourceId,cmp,value}`(미충족 선택 비활성). **전투 모디파이어**=`Layer::Combat.resourceMods[]`(자원 임계 충족 시 side 전원에 상태 주입 — 민심高→아군 버프 / 심리전→적 fear). cmp=gte|lte|gt|lt|eq. 뷰=`RunView.resources`(골드 옆 게이지). 엔진=`run/helpers.modify_resource`·`run/layers`(resourceMods)·`run/encounter`(requires). run2 민심·run3 명예·run7 토사구팽 재사용.

**프리미티브-갭 결정 프로토콜 (필수·사용자에게 명시):**
새 기능 요청 → ① 기존 프리미티브 **조합으로 원자적으로 표현 가능한가?** → ② **가능 = 데이터-온리**(`web/src/content`만 수정, 엔진 불변) → ③ **불가 = 프리미티브 갭**: 엔진 변경 필요. 이때 **구현 전 사용자에게 정해진 형식으로 보고하고 승인받는다**:

> "이 기능은 새 엔진 프리미티브가 필요합니다 — **[무엇]**. 기존 [관련 프리미티브]로는 원자적으로 불가합니다(이유: …). 추가 위치: `types/content.ts`(스키마) + `core/<module>`(해석). 데이터-온리가 아닙니다."

**엔진 프리미티브를 말없이 늘리지 않는다.** 커밋/보고에 분류를 명시: `[데이터-온리]` 또는 `[엔진 프리미티브 추가]`. (예시 사례: 노드별 적 로스터를 `run.ts` 하드코딩 → `data/encounters.ts`의 `NODE_ROSTERS`로 이동 = "콘텐츠는 데이터로"의 시범.)

---
