# UI-GLOSSARY.md — GUI 도메인 명칭 (SoT)

이 프로젝트의 모든 플레이어 GUI 표면 이름. **코드 주석·커밋·문서·대화에서 이 이름으로 통일**한다.
새 GUI를 만들면 여기에 한 줄 추가. 코드 식별자가 도메인명과 다르면 맨 아래 매핑을 본다(신규 코드는 도메인명을 따른다).

## 화면 (screen) — 최상위 레이아웃 1개

| 도메인 이름 | 무엇 | 코드 | CSS 루트 |
|---|---|---|---|
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
| **캐릭터 시트** | 캐릭터 1명 상세(능력치 원본→현재 · 장착 3칸 · 보유 스킬). **전투=아군·적 단독 모달(읽기전용, uid 키, 유닛카드 ℹ)**, **파티 편성=우측 pane(편집)**(같은 `sheetBody`) | `charSheet.ts` (`sheetBody`/`wireSheet`/`renderCharSheet`) · 전투 데이터 `main.ts buildBattleSheet` | `.charsheet` |
| **파티 편성** | 맵 전용 모달: 좌 **진형 보드** + 우 **캐릭터 시트** | `partyView.ts` `renderPartyView` | `.party-modal` |
| └ **진형 보드** | 4×4 드래그앤드롭 배치(열 = 진형 보너스, 6장) | `partyView.ts` | `.pv-board` |

## 코드 식별자 ↔ 도메인명 (어긋나는 것만)
- **행동서열 패널** = `timelinePanel.ts` / `createTimelinePanel` / `.timeline`
- **파티 편성** = `partyView.ts` / `renderPartyView` / `.party-modal` / `.party-overlay`
- **캐릭터 시트** = `charSheet.ts` (도메인명과 일치)

> 기존 식별자는 유지(리네임 위험 회피). **신규 코드·주석·UI 문구는 위 도메인명**을 쓴다.
