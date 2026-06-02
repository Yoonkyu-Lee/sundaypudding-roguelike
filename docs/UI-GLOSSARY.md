# UI-GLOSSARY.md — GUI 도메인 명칭 (SoT)

이 프로젝트의 모든 플레이어 GUI 표면 이름. **코드 주석·커밋·문서·대화에서 이 이름으로 통일**한다.
새 GUI를 만들면 여기에 한 줄 추가. 코드 식별자가 도메인명과 다르면 맨 아래 매핑을 본다(신규 코드는 도메인명을 따른다).

## 화면 (screen) — 최상위 레이아웃 1개

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **타이틀 화면** | 부팅 스플래시 → '시작'(→본거지) | `shell.ts` `renderTitle` | `.title-screen` |
| **본거지(집)** | 런 밖 허브. 편성 중=**캐릭터 선택 그리드**(playable 풀에서 1~4명 토글, 카드에 숙련도 Lv·해금T·XP바)+새 런 / 런 중=현재 원정대(읽기전용)+이어하기/포기 | `shell.ts` `renderHub` | `.hub` · `.hub-pickgrid` / `.hub-pick` |
| **전투 화면** | 전투 진행 전체(3열) | `render.ts` `renderApp` | `.battlelayout` |
| **맵 화면** | 헥스 노드 경로 선택 | `runRender.ts` `mapScreen` | `.mapwrap` |
| **상점 화면** | 골드 구매(강화권·범용기·아이템·회복) | `runRender.ts` `shopScreen` | `.shop` |
| **보상 화면** | 전투 후 3택1 | `runRender.ts` `rewardScreen` | `.reward` |
| **인카운터 화면** | 이벤트 선택지 | `runRender.ts` `encounterScreen` | `.encounter` |
| **결과 화면** | 클리어/실패 | `runRender.ts` `endScreen` | `.endscreen` |

## 패널 (panel) — 화면 안에 상주하는 영역

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **행동서열 패널** | 좌측 세로 턴 서열 + 라운드 시작 SPD 주사위(rolling 모드 같은 패널) | `timelinePanel.ts` | `.timeline` |
| **전장** | 아군/적 4×4 그리드 + 유닛 카드 | `render.ts` `grid` · `unitCard.ts` | `.arena` / `.board` / `.card` |
| **행동 패널** | 스킬 선택 카드 / 타겟팅 프롬프트 | `actions.ts` `actionPanel` | `.actions` |
| **전투 로그** | 전투 이벤트 로그 | `render.ts` | `.logpanel` |
| **파티 패널** | 맵 사이드바 요약(HP·활성 스킬·'파티 편성' 진입) | `runRender.ts` `partyPanel` | `.party` |
| **런 로그** | 런 이벤트 로그 | `runRender.ts` `logPanel` | `.runlog` |

## 오버레이 (모달)

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
| **캐릭터 시트** | 캐릭터 1명 상세: **체력/쉴드바** · 능력치(**'자세히 보기' 토글** — 기본 현재값만, ON이면 `[원본]+변화` 병기) · **상태 섹션**(전투 중 상태이상 칩+팝오버) · 장착 3칸 · **스킬 편성**(⚔출전 N/4 + 보유 분리, 스킬별 스펙줄(쿨·명중·피해·사정권·특징) + 출전 토글). **전투=아군·적 단독 모달(읽기전용, uid 키, 유닛카드 ℹ)**, **파티 편성=비전투 어디서나 편집(우측 pane)**(같은 `sheetBody`) | `charSheet.ts` (`sheetBody`/`wireSheet`/`renderCharSheet`) · 전투 데이터 `main.ts buildBattleSheet` | `.charsheet` |
| **일시정지** | 런 중 오버레이(Esc/⏸) — 재개·집으로(진행 유지)·타이틀로 | `shell.ts` `renderPause` | `.pause-overlay` |
| **파티 편성** | 비전투 모달(3칼럼): 좌 **진형 보드**(카드에 3 미니 장착칸) + 중 **캐릭터 시트**(최대폭=스킬 편성 자리) + 우 **장착 인벤토리 칼럼**(아이템 칩 + 공유 상세, 세로 스택). 장착=**드래그앤드롭**(인벤토리↔캐릭터/슬롯↔해제) 주 + 클릭 폴백. 좁은 화면은 2→1칼럼 폴백 | `partyView.ts` `renderPartyView` | `.party-modal` |
| └ **진형 보드** | 4×4 드래그앤드롭 배치(열 = 진형 보너스, 6장) + 카드별 3 미니 장착칸(drop 타깃) | `partyView.ts` | `.pv-board` / `.pv-slot` |
| └ **장착 인벤토리** | 우측 전용 칼럼(🎒 헤더 + 아이템 칩 + 하단 공유 상세). 파티 공유 아이템(드래그=장착, 클릭=선택 캐릭 장착, 호버=상세 갱신). 칼럼 drop=해제 | `partyView.ts` `invPanel` | `.pv-inv` |

## 코드 식별자 ↔ 도메인명 (어긋나는 것만)
- **행동서열 패널** = `timelinePanel.ts` / `createTimelinePanel` / `.timeline`
- **파티 편성** = `partyView.ts` / `renderPartyView` / `.party-modal` / `.party-overlay`
- **캐릭터 시트** = `charSheet.ts` (도메인명과 일치)

> 기존 식별자는 유지(리네임 위험 회피). **신규 코드·주석·UI 문구는 위 도메인명**을 쓴다.
