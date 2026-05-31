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
    targeting.ts    validTargets · sideDims · computeAreaCells · areaTargets ·
                    computeHitChance · getLegalActions
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
    rewards.ts      genRewards · damagingSkills (순수 생성; 적용은 run.ts)
    run.ts          createRun · enterNode · resolveBattleEnd · chooseReward (+ node/completeNode/healParty)
    view.ts         getRunView (RunState → RunView)
    index.ts        ▸배럴
  ai.ts             ▸배럴(파사드): export * from ai/index
  ai/
    policy.ts       chooseAction (결정론 휴리스틱; rng 미사용)
    index.ts        ▸배럴
  engine.test.ts    전투 결정론·기능 단위 테스트
  run.test.ts       런 결정론·헥스맵 연결성·완주 루프 테스트
```

## data / view 파일

| 파일 | 레이어 | 책임 | 핵심 export |
|---|---|---|---|
| `src/data/statuses.ts` | data | 상태이상 정의(거동 데이터) | `STATUS_DEFS` |
| `src/data/skills.ts` | data | 스킬(위치마스크·쿨타임·명중·효과) | `SKILLS` |
| `src/data/characters.ts` | data | 캐릭터(고유 스탯 + learnset) | `CHARACTERS` |
| `src/data/encounters.ts` | data | 전투 배치 + **노드 타입별 적 구성(`NODE_ROSTERS`)** + 보스/포메이션 override | `DEMO_ENCOUNTER` · `NODE_ROSTERS` · `Encounter`/`Placement` |
| `src/data/formations.ts` | data | 포메이션 열보너스 배치(총량보존, 6장) | `STANDARD_FORMATION` |
| `src/cli/play.ts` | cli | 대화형/`--demo` 터미널 드라이버 | (엔트리) |
| `src/cli/ascii.ts` | cli | ASCII 보드 렌더(뷰 — core 아님) | `renderAscii` |
| `src/web/main.ts` | web | 웹 엔트리·**런 컨트롤러**(맵↔전투↔보상↔결과 분기) | (엔트리) |
| `src/web/render.ts` | web | **전투 렌더 오케스트레이터**(파사드) — 3열 레이아웃(타임라인 좌│전장+행동│로그 우)·셀 타겟팅 컨텍스트·SVG 화살표 와이어링. 세부는 `battle/*`. avatarHtml/Ui/Handlers/formatEvent 재노출 | `renderApp` · `avatarHtml` |
| `src/web/battle/shared.ts` | web | 공용 소도구(esc·r1·ck·avatarHtml) + UI 타입(Ui·Handlers·TgtCtx) | — |
| `src/web/battle/unitCard.ts` | web | 그리드 캐릭터 카드(아바타·쉴드바(체력바 위 좌측정렬)·HP바·HP·상태칩) | `unitCard` |
| `src/web/battle/status.ts` | web | 상태이상 칩 + 펼침 팝오버(거동설명·스택·지속·다음변화·**출처**, 호버/포커스) | `statusChips` · `describeStatus` |
| `src/web/battle/skillDesc.ts` | web | 스킬 데이터→정돈 설명(쿨·명중·피해/사정권·AoE 규칙/특징 칩) | `skillCardBody` · `skillInline` · `areaRule` |
| `src/web/battle/actions.ts` | web | 행동 패널(균일 스킬 카드 4개 / 타겟팅 프롬프트) | `actionPanel` |
| `src/web/battle/timeline.ts` | web | 행동 서열 타임라인(좌측 세로, 완료/현재/끼어들기 예고) | `turnBar` |
| `src/web/battle/{events,arrow}.ts` | web | 이벤트→로그 한 줄 / 캐스터→타겟 눈금 화살표 | `formatEvent` · `drawArrow` |
| `src/web/runRender.ts` | web | **맵/보상/결과** 화면 렌더 + 헥스 노드 | `renderRunScreen` |
| `src/web/style.css` | web | 다크 테마 스타일 | — |
| `index.html` · `vite.config.ts` | web | Vite 진입/설정 (`npm run dev`) | — |

## 기능 → 위치 색인

| 게임 기능 (GAME-DESIGN 참조) | 모듈 · 함수 |
|---|---|
| 라운드/SPD 주사위 서열 (2.2) | `combat/turnOrder.ts`: `startRound`/`advance` (타임라인 `roundOrder`+`cursor`) |
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
| 승패 (7.3) | `combat/winCheck.ts`: `checkWin` |
| 행동 1회 처리(턴 진행) | `combat/flow.ts`: `step` |
| 관측 빌드(JSON) (8.2) | `combat/observation.ts`: `buildObservation` |
| 헥스 타일맵 생성·전진 인접·프루닝 (7.1) | `run/map.ts`: `genMap`/`forwardIds` |
| 노드 진입·해소·전투생성·승패 (7장) | `run/run.ts`: `enterNode`/`resolveBattleEnd` |
| 보상 3택1 생성·적용 (4.5) | `run/rewards.ts`: `genRewards` · `run/run.ts`: `chooseReward` |
| 적 구성(노드별, 데이터) | `data/encounters.ts`: `NODE_ROSTERS` (run.ts가 키로 조회) |
| 결정론 휴리스틱 AI | `ai/policy.ts`: `chooseAction` |

## 미구현 → 들어갈 자리 (☐, 부록 B)

| 기능 | 예정 위치 |
|---|---|
| 메타/본산/기억회랑 (5장) | 신규 `core/meta/` (런 위 레이어) |
| 상점/인카운터 본구현 (현재 즉시해소 stub) | `core/run/` (커지면 비전투 해소를 `run/nodes.ts`로 분리) |
| **적 전용 AI/패턴** | `core/ai/` (현재는 아군과 공유 정책 — 패턴 추가 시 모듈 확장) |
| 웹 렌더러 고도화(스프라이트/애니메이션) | `src/web/` (현재 v2: DOM 카드 + 피격 플래시 + 로그 재생) |
