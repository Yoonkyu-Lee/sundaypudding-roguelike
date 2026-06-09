# UI-GLOSSARY.md — GUI 도메인 명칭 (SoT)

이 프로젝트의 모든 플레이어 GUI 표면 이름. **코드 주석·커밋·문서·대화에서 이 이름으로 통일**한다.
**게임 내에 존재하는 화면·팝업마다 한 절(節)로 분류**한다 — 새 화면/팝업을 만들면 그 분류에 절을 추가하고, 아래 색인에 한 줄 더한다. 코드 식별자가 도메인명과 다르면 맨 아래 매핑을 본다(신규 코드는 도메인명을 따른다).

## 📑 화면·팝업 색인 (한눈에)

| 분류 | 도메인 이름 | 코드(렌더) | CSS 루트 |
|---|---|---|---|
| 본편 화면 | **타이틀 화면** | `shell.ts` `renderTitle` | `.title-screen` |
| 본편 화면 | **허브** | `shell.ts` `renderHub` | `.hub` |
| 본편 화면 | **맵 화면** | `runRender.ts` `mapScreen` | `.mapwrap` |
| 본편 화면 | **전투 화면** | `render.ts` `renderApp`/`renderAppObs` | `.battlelayout` |
| 본편 화면 | **상점 화면** | `runRender.ts` `shopScreen` | `.shop` |
| 본편 화면 | **보상 화면** | `runRender.ts` `rewardScreen` | `.reward` |
| 본편 화면 | **인카운터 화면** | `runRender.ts` `encounterScreen` | `.encounter` |
| 본편 화면 | **결과 화면** | `runRender.ts` `endScreen` | `.endscreen` |
| 본편 화면 | **캐릭터 도감 화면** | `codex.ts` `renderCodex` | `.codex` |
| 팝업(모달) | **캐릭터 시트** | `charSheet.ts` `renderCharSheet` | `.charsheet` |
| 팝업(모달) | **파티 편성** | `partyView.ts` `renderPartyView` | `.party-modal` |
| 팝업(모달) | **일시정지** | `shell.ts` `renderPause` | `.pause-overlay` |
| 팝업(모달) | **오류 알림** | `shell.ts` `renderError` | `.pause-overlay`(재사용) |
| 디자이너 도구 | **런 에디터 화면** | `editor/editorRender.ts` `renderEditor` | `.editor` |
| 디자이너 도구 | **노드 내용 에디터** | `editor/nodeEditView.ts` `renderNodeEditView` | `.node-editor` |

## 맵/런 도메인 용어 (SoT) — 화면 무관 공통 어휘

> 코드 식별자는 영어 유지(`RunDef`·`FloorDef`·`MapNode`·`start`·`clear`·`toFloor`·`entryFloorId`·`MapEdge`). **플레이어 표시·UI 문구·주석·문서는 아래 한글 용어**로 통일. (특정 화면이 아니라 여러 화면에 걸치는 데이터/지형 어휘.)

| 도메인 이름 | 무엇 | 코드 |
|---|---|---|
| **런** | 플레이 1회차(시작~승/패). 층 그래프 + 시작 파티 | `RunDef` · `RunState` |
| **층** | 런의 한 단계(헥스 무방향그래프 1장). 런 = 층 그래프 | `FloorDef` |
| **입장 층** | 런이 시작하는 층 | `RunDef.entryFloorId` |
| **노드** | 맵의 한 칸(육각) | `MapNode` |
| **입장 노드** | 층에 들어서는 시작 칸(층당 1개). *"시작" 아님 → "입장"으로 통일* | `type:"start"` · `FloorDef.entryNodeId` |
| **클리어 노드** | 목표 칸. 진입 시 층 종료 → `toFloor`로 다음 층(없으면 런 승리) | `type:"clear"` · `MapNode.toFloor` |
| **보스 노드** | 강적·최대 보상. **길목**(층 종료는 클리어 노드가) | `type:"boss"` |
| **전투·엘리트·상점·휴식·인카운터 노드** | 노드 종류(표시명 그대로) | `battle`·`elite`·`shop`·`rest`·`encounter` |
| **변** | 인접 노드 사이 무방향 연결(맞닿은 헥스끼리만) | `MapEdge` |
| **벽** | 인접하지만 연결 끊긴 변(=변 부재). 표시=어두운 빨강 | (edges에 없음) |
| **분기** | 한 층의 클리어 노드들이 서로 다른 `toFloor` → 층 갈래 | (toFloor 복수) |

---

# 화면 (게임 본편)

각 화면 = 최상위 레이아웃 1개. 그 안에 상주하는 패널은 해당 절의 표에 함께 분류한다.

## 타이틀 화면
부팅 스플래시 → '시작'(→허브)·'런 에디터'. **`shell.ts` `renderTitle` / `.title-screen`**.

## 허브
런 밖 **진입점 메뉴**. 모드 선택(📜 캠페인 · 📖 캐릭터 도감 · 일반/챌린지=회색 준비중 · 🗺 런 에디터). **캠페인** 입장 → `mode==="campaign"` 런 목록 → 선택 런의 **고정 로스터로 시작**(스토리=주인공 강제, 자유 편성 없음). 런 중 = 현재 원정대(읽기전용)+이어하기/포기. **`shell.ts` `renderHub`·`HubMode` / `.hub`**.

| 도메인 이름 | 무엇 | CSS 루트 |
|---|---|---|
| **모드 메뉴** | 진입점 카드(캠페인·도감·에디터·준비중 회색) | `.hub-modes`/`.hub-mode` |
| **캠페인 런 목록** | `mode==="campaign"` 런 카드 + 선택 런 고정 로스터 미리보기 | `.hub-runs`/`.hub-run` |
| **현재 원정대** | 런 중 읽기전용 파티 + 이어하기/포기 | `.hub-mems` |

> *구 "본거지/집"·자유 편성 picker(`.hub-pickgrid`/`.hub-pick`)는 비캠페인 모드용으로 휴면.*

## 맵 화면
헥스 노드 경로 선택. **`runRender.ts` `mapScreen` / `.mapwrap`**(고정 뷰포트 줌·팬, 벽=hexgeo 기하).

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **파티 패널** | 맵 사이드바 요약(HP·활성 스킬·'파티 편성' 진입) | `runRender.ts` `partyPanel` | `.party` |
| **런 로그** | 런 이벤트 로그 | `runRender.ts` `logPanel` | `.runlog` |

## 전투 화면
전투 진행 전체(3열: `.battleleft`/`.battlemain`/`.battleside`). **`render.ts` `renderApp`(셸 1회)·`renderAppObs`(매 step 배틀존 갱신) / `.battlelayout`**.

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **행동서열 패널** | 좌측 세로 턴 서열 + 라운드 시작 SPD 주사위(같은 패널 rolling) | `timelinePanel.ts` `createTimelinePanel` | `.timeline` |
| **전장** | 아군/적 4×4 그리드 + 유닛 카드 | `render.ts` `grid` · `unitCard.ts` | `.arena`/`.board`/`.card` |
| **행동 패널** | 스킬 선택 카드 / 타겟팅 프롬프트 | `actions.ts` `actionPanel` | `.actions` |
| **전투 로그** | 전투 이벤트 로그 | `render.ts` | `.logpanel` |

## 상점 화면
골드 구매(강화권·범용기·아이템·회복). **`runRender.ts` `shopScreen` / `.shop`**.

## 보상 화면
전투 후 N택1(등급별 선택지·아이템 가산). **`runRender.ts` `rewardScreen` / `.reward`**.

## 인카운터 화면
이벤트 선택지(확정/도박). **`runRender.ts` `encounterScreen` / `.encounter`**.

## 결과 화면
클리어/실패. **`runRender.ts` `endScreen` / `.endscreen`**.

## 캐릭터 도감 화면 (CDX)
허브 진입점 `📖 캐릭터 도감`. **`codex.ts` `renderCodex` / `.codex`**(풀폭, 전체 페이지 스크롤 없음 — 패널 내부 스크롤만). 2열: **좌=디테일**, **우=캐릭터 목록**.

- **상태 모델**(메타, `meta.ts`): **해금**=관련 런 클리어(`unlocked`) — 미해금은 잠금 표시 · **스킬 공개**=런에서 보유/획득해본 스킬(`seenSkills`) — 나머지 '?'. (숙련도 게이트는 보류, GAME-DESIGN 4.4.)
- **분기 모델**(GAME-DESIGN 4.7): 전직 분기는 **부여 특성으로 갈리고**, **전용기 풀은 같은 차수 분기가 공유**. 도감은 이를 차수 컬럼으로 표현(분기=특성 카드, 스킬=차수 띠).

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **캐릭터 목록** | 우측 패널 — 전체 playable 캐릭. 해금=밝게, **미해금=🔒 어두운 프로필·???**. 자체 스크롤, 선택=좌측 디테일 갱신 | `codex.ts` | `.cdx-list`·`.cdx-pick`(`.locked`/`.sel`) |
| **정체성 바** | 좌측 상단 **고정 패널**(스크롤 안 함) — 아바타·이름 · 능력치 · **기본 특성 칩**(내재·상시) | `codex.ts` `baseTraitsBar` | `.cdx-idbar`·`.cdx-bt-chip` |
| **전직 트리 패널** | 좌측 하단 **자체 스크롤 패널** — **차수 컬럼**(0차→1차→… 가로 진행). 미해금 캐릭이면 잠금 안내 | `codex.ts` `tierColumnsHtml` | `.cdx-tree-sec`·`.cdx-tree` |
| └ **차수 컬럼** | 한 차수(0/1/2…)=한 컬럼. 상단=직업 노드, 하단=그 차수 스킬. 컬럼 사이 `→` | `codex.ts` | `.cdx-tier`·`.cdx-tier-link` |
| └ **직업 노드** | 그 차수 직업. **분기는 세로 스택**(⑂). 노드 안에 **부여 특성 카드**(✦ 이름+설명) — 분기 차별점 | `codex.ts` `jobsByTier`·`traitCard` | `.cdx-jobcard`·`.cdx-tcard` |
| └ **스킬 카드** | 차수별 스킬(0차=시작기·범용기, N차=전용기 풀=분기 공유). 런에서 본 스킬=전투용 스펙(`skillCardBody` 재사용), **미발견='?'** | `codex.ts` `skillCardEl`·`skillSpec` | `.cdx-skill`(`.locked`)·`.cdx-q` |
| └ **강화 토글** | 강화 체인 스킬은 **차수 토글(T1/T2…)** 한 카드에서 원본↔강화 스펙 전환(공간 절약, 로컬 DOM·재렌더 없음) | `codex.ts` `skillCardEl` | `.cdx-upg`·`.cdx-tbtn`/`.cdx-tbody` |

---

# 팝업·오버레이 (모달)

게임 내 자체 구현(네이티브 위젯 금지 — 웹 게임-티 정책). 백드롭/Esc로 닫힘.

## 캐릭터 시트
캐릭터 1명 상세: **체력/쉴드바** · 능력치(**'자세히 보기' 토글** — 기본 현재값만, ON이면 `[원본]+변화` 병기) · **상태 섹션**(전투 중 상태이상 칩+팝오버) · 장착 3칸 · **스킬 편성**(⚔출전 N/4 + 보유 분리, 스킬별 스펙줄(쿨·명중·피해·사정권·특징) + 출전 토글). **전투=아군·적 단독 모달(읽기전용, uid 키, 유닛카드 ℹ)**, **파티 편성=비전투 어디서나 편집(우측 pane)**(같은 `sheetBody`). **`charSheet.ts`(`sheetBody`/`wireSheet`/`renderCharSheet`) · 전투 데이터 `main.ts buildBattleSheet` / `.charsheet`**.

## 파티 편성
비전투 모달(3칼럼): 좌 **진형 보드** + 중 **캐릭터 시트**(최대폭=스킬 편성 자리) + 우 **장착 인벤토리 칼럼**. 장착=**드래그앤드롭**(인벤토리↔캐릭터/슬롯↔해제) 주 + 클릭 폴백. 좁은 화면은 2→1칼럼 폴백. **`partyView.ts` `renderPartyView` / `.party-modal`**.

| 도메인 이름 | 무엇 | CSS 루트 |
|---|---|---|
| **진형 보드** | 4×4 드래그앤드롭 배치(열=진형 보너스, 6장) + 카드별 3 미니 장착칸(drop 타깃) | `.pv-board`/`.pv-slot` |
| **장착 인벤토리** | 우측 전용 칼럼(🎒 + 아이템 칩 + 공유 상세). 드래그=장착·클릭=선택 캐릭 장착·호버=상세 갱신. 칼럼 drop=해제 | `.pv-inv` |

## 일시정지
런 중 오버레이(Esc/⏸) — 재개·집으로(진행 유지)·타이틀로. **`shell.ts` `renderPause` / `.pause-overlay`**.

## 오류 알림
런 생성 실패 등 IPC 오류를 게임 내 오버레이로 표시(네이티브 `alert` 대체). 확인/백드롭=닫기. 메시지 텍스트만 선택·복사 허용(디버깅). **`shell.ts` `renderError` / `.pause-overlay`(재사용)·`.err-msg`**.

---

# 화면 (디자이너 도구)

> 게임 본편이 아닌 **저작 도구**. 웹 게임-티 정책 면제(네이티브 `prompt`/`alert` 허용).

## 런 에디터 화면
층 그래프 저작(노드 배치·변 연결·층 분기). **`editor/editorRender.ts` `renderEditor` / `.editor`**.

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **격자** | 광활한 육각 배경(캔버스) | `editor/hexgeo.ts` | `.ed-canvas` |
| **노드 카탈로그** | 우측 노드 종류 팔레트(드래그 배치) | `editor/editView.ts` | `.ed-catalog` |
| **층 그래프 뷰포트** | 하단 — 층=박스, 클리어 `toFloor`=방향 화살표(블럭 다이어그램). 입장 층 ★, 박스 클릭=편집·입장 지정·추가/삭제 | `editor/editView.ts` `floorGraph` | `.ed-floors`/`.fg-box` |

## 노드 내용 에디터
노드 1개의 레이어(core/onEnter/onResolve) 편집 — 레이어 추가/삭제/순서 + 스키마 구동 폼(전투 배치·상점·인카운터·전직·파티 변동 등). **`editor/nodeEditView.ts` `renderNodeEditView`·`layerSchema.ts` / `.node-editor`**.

---

## 코드 식별자 ↔ 도메인명 (어긋나는 것만)
- **행동서열 패널** = `timelinePanel.ts` / `createTimelinePanel` / `.timeline`
- **파티 편성** = `partyView.ts` / `renderPartyView` / `.party-modal` / `.party-overlay`
- **캐릭터 시트** = `charSheet.ts` (도메인명과 일치)
- **오류 알림** = `shell.ts renderError` (CSS는 일시정지 `.pause-overlay` 재사용)

> 기존 식별자는 유지(리네임 위험 회피). **신규 코드·주석·UI 문구는 위 도메인명**을 쓴다.
