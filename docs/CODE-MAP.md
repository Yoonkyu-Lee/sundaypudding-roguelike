# 코드 매핑 (CODE-MAP)

> **목적**: "어떤 코드 파일이 무슨 역할인지"를 한눈에. 작업 전 이 문서를 읽어 맥락을 잡고,
> 의미 있는 슬라이스를 완료하면 이 문서를 **반드시 갱신**한다. (규칙: `CLAUDE.md`)
>
> 게임 규칙 자체는 여기 적지 않는다 → [`GAME-DESIGN.md`](GAME-DESIGN.md)가 그 SoT.

## 레이어 개요

```
src/
  core/   ← 순수·결정론 게임 로직(전투 combat + 런 run + ai). 렌더링/IO 의존 0. (GAME-DESIGN 8.1)
  data/   ← 데이터 주도 콘텐츠. 엔진은 이걸 "해석"만. (8.6/8.8)
  cli/    ← 터미널 드라이버(사람/AI용 IO). core를 소비.
  web/    ← 웹 렌더러(사람용 뷰). 같은 core 상태를 구독 + 이벤트 로그 재생 (8.5)
```

**단방향 의존:** `data → types ← core → views(cli/web)`. core는 view를 import하지 않고, view는 core를 읽기만.
**core는 절대 console/DOM/readline을 직접 만지지 않는다.** IO는 cli/·web/에서만.
타입 레벨 강제: `tsconfig.json`(코어/CLI, DOM lib 없음) vs `tsconfig.web.json`(웹, DOM lib).

## 모듈 트리 (배럴 = 공개 API, 소비자는 배럴만 import)

```
src/core/
  rng.ts            시드 PRNG. 모든 무작위의 유일 출처(결정론, 8.3) → Rng
  util.ts           cross-cutting 소도구 + 상태 QUERY(사이클 방지 leaf): clamp·samePos·unitById·
                    aliveUnits·hasStatus·totalStacks·statusNumSum·statusFlag·critPctOf·isFrozen
  types.ts          ▸배럴: export * from types/{content,runtime}
  types/
    content.ts      디자이너 스키마(데이터 계약): Side·Pos·StatusDef(+거동필드)·SkillEffect·
                    AreaShape·SkillTarget·Skill·FormationBonusKind/ColumnBonus/FormationLayout·Character
    runtime.ts      엔진 상태: StatusInstance·Unit·PartyMemberState·TurnKind·QueueEntry·
                    Action·Phase·GameEvent·GameState·UnitView·LegalAction·Observation
  engine.ts         ▸배럴(파사드): export * from combat/index
  combat/
    state.ts        makeUnit · createBattle
    winCheck.ts     checkWin (leaf — turnOrder·flow 공용, 사이클 방지)
    formation.ts    getFormationBonus (열보너스·총량보존)
    status.ts       applyStatusInstance · tickPeriodic (적용/틱; QUERY는 util)
    damage.ts       computeDamage · dealRawDamage · previewDamage · previewHpLoss
    targeting.ts    validTargets · reachableColumns(동적 근접 도달 열) · sideDims ·
                    computeAreaCells · areaTargets · computeHitChance · getLegalActions
    skills.ts       resolveSkill · resolveAnchorUid · applySelfEffects · applyTargetEffects · moveUnit
    interrupt.ts    predictInterruptSubjects · insertInterrupts
    turnOrder.ts    startRound · advance · onNormalTurnStart · onNormalTurnEnd (ACTION_CONST)
    flow.ts         step (행동 1회 처리 오케스트레이터)
    observation.ts  buildObservation · viewUnit · viewStatuses
    index.ts        ▸배럴
  observation.ts    ▸배럴(파사드): export { buildObservation } from combat/observation
  run.ts            ▸배럴(파사드): export * from run/index
  run/
    map.ts          헥스 타일맵 생성: hid · pickType · forwardIds · genMap (axial q,r·좌표인접=간선·프루닝)
    types.ts        런 도메인 타입(leaf): RunPhase·RewardOption·RunState·NodeStatus·RunView
    rewards.ts      genRewards(강화/학습 3택1) · damagingSkills (순수 생성; 적용은 run.ts)
    run.ts          createRun · enterNode · resolveBattleEnd · chooseReward · setActiveSkill(로드아웃) · movePartyMember(진형 배치/교대, 맵전용) · buyShopOffer/leaveShop(상점) · chooseEncounterOption(인카운터) (+ node/completeNode/healParty/generateShop/applyOutcome)
    items.ts        장착(4.3): equipItem/unequipItem(maxHp 재계산) · genItemOffers(상점)/itemRewardOptions(보상) · 인벤토리 왕복
    save.ts         런 이어하기 직렬화(순수): serializeRun/deserializeRun (Rng→{__rng:state} 치환·복원)
    view.ts         getRunView (RunState → RunView; party[].pos 노출)
    index.ts        ▸배럴
  ai.ts             ▸배럴(파사드): export * from ai/index
  ai/
    policy.ts       chooseAction (결정론 휴리스틱; rng 미사용)
    index.ts        ▸배럴
  testutil.ts       테스트 공용 헬퍼(playToEnd·forceTurn)
  engine.test.ts    전투 흐름(결정론·종료·명중·합법·SPD·대기)
  interrupt.test.ts 끼어들기(연격·버프출처·대상끼어들기·웹 경로)
  status.test.ts    상태이상(빙결·공포·관통·불사·재생)
  formation.test.ts 포메이션 총량보존·보스전 적용·데미지 미리보기
  area.test.ts      면적/타겟팅(재배치·AoE 모양·자유선택·빈칸앵커·쉴드→HP)
  run.test.ts       런 결정론·헥스맵 연결성·완주 루프·진형 편성
  equip.test.ts     장착(스탯/데미지/쉴드 보정·equip 왕복)
```
> 테스트는 `node --test` 자동 디스커버리(`*.test.ts`) — 새 파일은 목록 갱신 불필요.

## data / view 파일

| 파일 | 레이어 | 책임 | 핵심 export |
|---|---|---|---|
| `src/data/statuses.ts` | data | 상태이상 정의(거동 데이터) | `STATUS_DEFS` |
| `src/data/skills.ts` | data | 스킬(위치마스크·쿨타임·명중·효과) | `SKILLS` |
| `src/data/characters.ts` | data | 캐릭터(고유 스탯 + learnset) | `CHARACTERS` |
| `src/data/encounters.ts` | data | 전투 배치 + **노드 타입별 적 구성(`NODE_ROSTERS`)** + 보스/포메이션 override | `DEMO_ENCOUNTER` · `NODE_ROSTERS` · `Encounter`/`Placement` |
| `src/data/events.ts` | data | 인카운터 이벤트(7.2) — 제목·텍스트·선택지(확정/도박)·결과(heal/hurt/gold/강화/학습) | `ENCOUNTER_EVENTS` · `EncounterEvent`/`EncounterOutcome` |
| `src/data/maps.ts` | data | 맵 생성 값(7.1) + **3액트 맵 구성(7.3, 깊이·엘리트 램프)** (`NodeType`/`MapGenConfig`는 content.ts) | `ACTS` · `DEFAULT_MAP` |
| `src/data/formations.ts` | data | 포메이션 열보너스 배치(총량보존, 6장) | `STANDARD_FORMATION` |
| `src/data/modes.ts` | data | **게임 모드(0.1/7.4)** — `GameMode`(roster·acts·useMastery). '일반' 1개, 디자이너가 캠페인/챌린지 추가 | `MODES` · `DEFAULT_MODE` |
| `src/web/meta.ts` | web | **영구 숙련도 메타**(레벨/XP, 별도 세이브 `spr_meta_v1`) — `grantWin`(전투 승리 XP)·`masteryMap`(런 주입)·`masteryInfo`(허브) | `grantWin` · `masteryMap` · `masteryInfo` |
| `src/data/items.ts` | data | 장착 아이템(4.3) — 무기(dmgFlat·crit) / 방어구(hp·쉴드획득). `ItemDef`는 content.ts | `ITEMS` · `ITEM_POOL` |
| `src/cli/play.ts` | cli | 대화형/`--demo` 터미널 드라이버 | (엔트리) |
| `src/cli/ascii.ts` | cli | ASCII 보드 렌더(뷰 — core 아님) | `renderAscii` |
| `src/web/main.ts` | web | 웹 엔트리·**앱 상태기계**(title↔hub↔run, `appState`/`runActive`/`pauseOpen`)+런 컨트롤러. 오버레이 조립은 `overlay.ts` | (엔트리) |
| `src/web/shell.ts` | web | **게임 흐름 셸** — 타이틀·본거지(집)·일시정지 화면. 런 바깥 | `renderTitle` · `renderHub` · `renderPause` · `ShellHandlers` |
| `src/web/overlay.ts` | web | **오버레이 컨트롤러**(`createOverlay`) — 맵=파티 편성 / 전투=단독 캐릭터 시트. `buildSheetData`·`buildBattleSheet`·`renderOverlay` + 시트/파티뷰 핸들러. main이 `{app,ui,getRun,render}` 주입 | `createOverlay` |
| `src/web/render.ts` | web | **전투 렌더** — 영속 셸(svg·header·battlelayout) 1회 생성 후 **존 갱신**(.battlemain/.battleside). **.battleleft는 TimelinePanel이 소유**(통짜 재렌더서 분리). 셀 타겟팅·SVG 화살표. renderApp(…, panel) | `renderApp` · `avatarHtml` |
| `src/web/battle/shared.ts` | web | 공용 소도구(esc·r1·ck·avatarHtml) + UI 타입(Ui·Handlers·TgtCtx) | — |
| `src/web/battle/unitCard.ts` | web | 그리드 캐릭터 카드(아바타·쉴드바(체력바 위 좌측정렬)·HP바·HP·상태칩) | `unitCard` |
| `src/web/battle/status.ts` | web | 상태이상 칩 + 펼침 팝오버(거동설명·스택·지속·다음변화·**출처**, 호버/포커스) | `statusChips` · `describeStatus` |
| `src/web/battle/skillDesc.ts` | web | 스킬 데이터→정돈 설명(쿨·명중·피해/사정권·AoE 규칙/특징 칩) | `skillCardBody` · `skillInline` · `areaRule` |
| `src/web/battle/actions.ts` | web | 행동 패널(균일 스킬 카드 4개 / 타겟팅 프롬프트) | `actionPanel` |
| `src/web/battle/timelinePanel.ts` | web | **행동서열 패널(영속·모드)** — `rolling`(중앙 확장 SPD 주사위→±→서열) → `dock()`(같은 행 FLIP 슬라이드로 좌측 레일) → `live`(전투 타임라인: 완료✓/현재▶/끼어들기). roundIntro+timeline 통합. `.battleleft`에 영속 마운트 | `createTimelinePanel` · `RollView` |
| `src/web/battle/{events,arrow}.ts` | web | 이벤트→로그 한 줄 / 캐스터→타겟 눈금 화살표 | `formatEvent` · `drawArrow` |
| `src/web/runRender.ts` | web | **맵/보상/결과** 화면 렌더 + 헥스 노드 + 파티 요약(클릭→시트) | `renderRunScreen` |
| `src/web/charSheet.ts` | web | **캐릭터 시트** — 능력치표(원본→현재 델타)·3 장착칸(장착·교체·해제+인벤토리 픽커)·보유 스킬(맵=활성4 토글, 전투=읽기전용). `sheetBody`+`wireSheet`로 분리 → 전투 단독 모달(`renderCharSheet`)·파티뷰 상세 pane 공용 | `renderCharSheet` · `sheetBody` · `wireSheet` · `SheetData` |
| `src/web/partyView.ts` | web | **파티 편성(통합 파티뷰, 모달)** — 좌: 4×4 진형 보드(드래그앤드롭 배치/교대, 열 보너스 힌트) / 우: 선택 캐릭 상세(charSheet 인라인). 맵 전용 | `renderPartyView` · `PartyViewData` |
| `src/web/style.css` | web | 다크 테마 스타일 | — |
| `index.html` · `vite.config.ts` | web | Vite 진입/설정 (`npm run dev`) | — |

## 기능 → 위치 색인

| 게임 기능 (GAME-DESIGN 참조) | 모듈 · 함수 |
|---|---|
| 라운드/SPD 주사위 서열 (2.2) | `combat/turnOrder.ts`: `startRound`/`advance` (타임라인 `roundOrder`+`cursor`) |
| SPD 주사위 분해 노출(연출용) (2.2) | `roundStart` 이벤트 `rolls: SpeedRoll[]`(roll·speedDown·final) → 웹 `timelinePanel.ts`(rolling 모드) |
| 정규 턴 시작·종료(쿨타임↓·DoT·지속턴↓) | `combat/turnOrder.ts`: `onNormalTurnStart`/`onNormalTurnEnd` |
| 합법 행동 열거·사정권/쿨다운/빙결 (8.2/2.10) | `combat/targeting.ts`: `getLegalActions`/`validTargets` · `util.ts`: `isFrozen` |
| 명중 판정 (2.7) | `combat/targeting.ts`: `computeHitChance` · `combat/skills.ts`: `resolveSkill` |
| 데미지 계산·치명타·곱연산 순서 (3.7) | `combat/damage.ts`: `computeDamage` |
| 쉴드→HP 피해 적용·공포·관통·불사 (2.9/3.5/3.6) | `combat/damage.ts`: `dealRawDamage` |
| HP 손실 미리보기(관통/공포 반영) | `combat/damage.ts`: `previewHpLoss` |
| 데미지 미리보기(비크리 결정론, 타겟팅 UI) | `combat/damage.ts`: `previewDamage` |
| 상태이상 원장 부여/틱(DoT+HoT) (3.1/3.5) | `combat/status.ts`: `applyStatusInstance`/`tickPeriodic` |
| 상태 QUERY(스택합·플래그·crit%) | `util.ts`: `totalStacks`/`statusNumSum`/`statusFlag`/`critPctOf` |
| 스킬 효과 디스패치(뎀/상태/쉴드/힐/이동/끼어들기) (3.9) | `combat/skills.ts`: `applyTargetEffects`/`applySelfEffects` |
| 동적 재배치 (6.4) | `combat/skills.ts`: `moveUnit` |
| 끼어들기 주체 예측(스킬+버프+특성) (2.11) | `combat/interrupt.ts`: `predictInterruptSubjects` (실행·미리보기 공유) |
| 끼어들기 대상 앵커 해소(웹 targetCell→유닛) (2.11) | `combat/skills.ts`: `resolveAnchorUid` (flow가 끼어들기 주체에 사용) |
| 끼어들기 동적 삽입 (2.11) | `combat/interrupt.ts`: `insertInterrupts` (flow의 정규 턴만 호출) |
| 자발적 대기(턴 넘김, 쿨 미소모) (2.10) | `combat/targeting.ts`: `getLegalActions`("대기" 상시) · `flow.ts` skip "chosen" |
| 상태이상 출처(유닛+스킬) (3.1) | `StatusInstance.sourceSkillId` → `combat/observation.ts` `viewStatuses`(via=스킬명) |
| 포메이션 열보너스·총량보존 (6.1/6.3) | `combat/formation.ts`: `getFormationBonus` |
| 면적(AoE) 모양→영향 칸/유닛 | `combat/targeting.ts`: `computeAreaCells`/`areaTargets` (웹 바닥 하이라이트 공유) |
| 근접 동적 도달(reach, 2.4 교착방지) | `Skill.reach` · `combat/targeting.ts`: `reachableColumns`(최전열부터 연속 n칸) → `validTargets` 필터 · 웹 `render.ts` 동일 규칙 하이라이트 · 근접 단일타겟 스킬 전부 `reach:1`(최전열 적만, data/skills.ts) |
| 승패 (7.3) | `combat/winCheck.ts`: `checkWin` |
| 행동 1회 처리(턴 진행) | `combat/flow.ts`: `step` |
| 관측 빌드(JSON) (8.2) | `combat/observation.ts`: `buildObservation` |
| 헥스 타일맵 생성·전진 인접·프루닝 (7.1) | `run/map.ts`: `genMap(cfg)`/`forwardIds` (메커니즘=엔진) |
| 맵 생성 값 데이터화 (7.1) | `data/maps.ts` `DEFAULT_MAP` (가중치·분기·깊이) · `content.ts` `MapGenConfig`/`NodeType` · `createRun(seed,roster,map?)` |
| 노드 진입·해소·전투생성·승패 (7장) | `run/run.ts`: `enterNode`/`resolveBattleEnd` |
| 런 이어하기 영속화 (셸) | `run/save.ts` `serializeRun`/`deserializeRun`(순수, Rng=state만) · 웹 `main.ts` localStorage(`spr_save_v1`, render마다 저장·승패/포기 시 삭제·부팅 복원) |
| 다층 3액트 진행 (7.3) | `RunState.act`/`acts`(`data/maps.ts ACTS`) · `run/run.ts` `advanceAct`(보스→다음 액트 맵·50%회복, 결정론) · `resolveBattleEnd`(최종 액트 보스=won) · `RunView.act`/`totalActs` · 웹 "액트 N/3" 표기 |
| 보상 3택1 생성·적용 (4.5) | `run/rewards.ts`: `genRewards` · `run/run.ts`: `chooseReward` |
| 육성: 스킬 보유풀/활성선택/강화티어 (4.2/4.6) | `PartyMemberState.ownedSkillIds`/`activeSkillIds` · `Skill.nextTierId`(데이터 티어) · `run/run.ts`: `setActiveSkill`·`chooseReward`(강화=id교체/학습=풀추가) · `combat/state.ts` makeUnit가 활성 4 사용 |
| 전용기/범용기 + learnset (4.6) | `Skill.exclusiveTo`(전용기 소유자, 없으면 범용기 `u_*`) · `Character.skillIds`=learnset(포켓몬식, 학습 가능 여부) · 범용기는 여러 learnset 공유(예 `u_guard`=kim·shin·cho) · 게이팅=`run/rewards.ts` genRewards가 learnset에서 추첨 |
| 장착 아이템 (4.3) | `ItemDef`(content.ts)·`data/items.ts` `ITEMS` · `PartyMemberState.equipped`+`RunState.inventory` · `combat/state.ts` makeUnit가 비-HP 스탯 합산+`Unit.equipDmgFlat`/`equipShieldGainAdd` · `damage.ts`/`skills.ts` read훅 · `run/items.ts` equip/오퍼 · 웹=`charSheet.ts` 장착칸. 지닌물건=후속 |
| 아군 진형 편성 (6장) | `PartyMemberState.pos`(열=진형 보너스) · `run/run.ts` `movePartyMember`(맵전용 이동/교대) · `combat/formation.ts` 열 총량÷인원 분배 · 웹=`partyView.ts` 드래그앤드롭 보드 |
| 상점·인카운터 + 골드 (7.2) | `RunState.gold`(전투승리/인카운터 획득) · 상점=`generateShop`+`buyShopOffer`(강화권/범용기/회복, 골드)·`leaveShop` · 인카운터=`data/events.ts` 이벤트 추첨+`chooseEncounterOption`(확정/도박, 생존보장) · 웹: runRender `shopScreen`/`encounterScreen` |
| 적 구성(노드별, 데이터) | `data/encounters.ts`: `NODE_ROSTERS` (run.ts가 키로 조회) |
| 결정론 휴리스틱 AI | `ai/policy.ts`: `chooseAction` |

## 미구현 → 들어갈 자리 (☐, 부록 B)

| 기능 | 예정 위치 |
|---|---|
| 메타/본산/기억회랑 (5장) | 신규 `core/meta/` (런 위 레이어) |
| 상점/인카운터 본구현 (현재 즉시해소 stub) | `core/run/` (커지면 비전투 해소를 `run/nodes.ts`로 분리) |
| **적 전용 AI/패턴** | `core/ai/` (현재는 아군과 공유 정책 — 패턴 추가 시 모듈 확장) |
| 웹 렌더러 고도화(스프라이트/애니메이션) | `src/web/` (현재 v2: DOM 카드 + 피격 플래시 + 로그 재생) |
