# 코드 매핑 (CODE-MAP)

> **목적**: "어떤 코드 파일이 무슨 역할인지"를 한눈에. 작업 전 이 문서를 읽어 맥락을 잡고,
> 의미 있는 슬라이스를 완료하면 이 문서를 **반드시 갱신**한다. (규칙: `CLAUDE.md`)
>
> 게임 규칙 자체는 여기 적지 않는다 → [`GAME-DESIGN.md`](GAME-DESIGN.md)가 그 SoT.

## 레이어 개요

```
src/
  core/   ← 순수·결정론 게임 로직(전투 combat + 런 run + ai). 렌더링/IO 의존 0. (GAME-DESIGN 8.1)
  data/   ← 데이터 주도 콘텐츠. 엔진은 이걸 "해석"만. (8.6/8.8) — 디자이너 가이드: src/data/README.md
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
  util.ts           cross-cutting 소도구 + 상태 QUERY(사이클 방지 leaf): clamp·roundDiv(정수 반올림 나눗셈, zero-f64)·samePos·unitById·
                    aliveUnits·hasStatus·totalStacks·statusNumSum·statusFlag·critPctOf·isFrozen
  types.ts          ▸배럴: export * from types/{content,runtime}
  types/
    content.ts      디자이너 스키마(데이터 계약): Side·Pos·StatusDef(+거동필드)·SkillEffect·
                    AreaShape·SkillTarget·Skill(+active/passives)·FormationLayout·Character(+traitIds/aiProfileId)
    passives.ts     특성/패시브 룰 스키마: PassiveRule·Trigger·Condition·Effect·TraitDef·EffTarget·StatKey
    ai.ts           AI 행동결정 정책 스키마: AiProfile·AiRule·AiCondition·SkillKindPref·TargetPref·AiWeightKey
    map.ts          헥스 인접 무방향그래프 맵 스키마: RunDef·FloorDef·MapNode(q,r·toFloor?·roster?·label?·**layers?·core?**)·MapEdge. **combat 레이어가 rules?(NodeRule=PassiveRule+owner) 소유 — 페이즈별 대사, owner(side+charId)로 self=배치 개체 지정**. **DecoratorLayer(gold/heal/grantStatus/text)·InteractiveLayer(combat[roster/rosterPreset/boss]/reward/shop/event)·Layer·NodeLayers(onEnter/onResolve)**. NodeType는 content(+clear). yain 전 노드=core 이전 완료(type=표시용 잔존)
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
    passives/       특성·패시브 룰 디스패처 (when/if/then) — 각 전투 훅이 fireTrigger 호출
      compile.ts      compileRules (보유 스킬 passives + 캐릭 traitIds → Unit.rules)
      dispatch.ts     fireTrigger(매칭·결정론 정렬·재진입 가드) · onUnitTurnStart · applySpeedRollPassives
      conditions.ts   evalConditions (if 평가) · effects.ts applyEffect (then; castSkill=resolveSkill 경유)
      validate.ts     validateCastSkill (castSkill 대상=leaf 스킬만 — check 게이트가 강제, 재귀 방지)
      ctx.ts          TriggerCtx · RuleCtx · cmp · isFrontline    index.ts ▸배럴
    index.ts        ▸배럴
  observation.ts    ▸배럴(파사드): export { buildObservation } from combat/observation
  run.ts            ▸배럴(파사드): export * from run/index
  run/
    graph.ts        헥스 인접 무방향그래프 엔진(메커니즘): hexAdjacent(6방향) · neighborIds(무방향) · canReachClear/liveReachable(방문지 회피·재방문 불가) · reachableFromEntry · validateFloor/validateRun(인접 변 검증·고립노드). 순수·결정론. (구 genMap 폐기)
    types.ts        런 도메인 타입(leaf): RunPhase·RewardOption·RunState·NodeStatus·RunView
    rewards.ts      genRewards(강화/학습 3택1) · damagingSkills (순수 생성; 적용은 run.ts)
    run.ts          오케스트레이터: createRun(seed,roster,runDef) · enterNode(clear→completeFloor) · completeFloor(층종료/다음층, 구 advanceAct) · resolveBattleEnd · chooseReward · setActiveSkill · movePartyMember
    helpers.ts      공유 변이(leaf): curFloor · node · healParty(+partyHpChange) · completeNode(미방문 이웃·재방문 불가·막힌노드 비활성; **onResolve 레이어 발동**) · upgradeOwned · learnOwned · **runInstantLayers(즉시 데코 레이어 gold/heal/grantStatus/text — Phase A, enterNode=onEnter·completeNode=onResolve)**
    layers.ts       ▸코어 레이어 시퀀서(Phase A/B): startCore/stepCore/advanceCore/finishCore — core[] 순서 실행(데코 즉시, combat/reward/shop/event 블록). 복귀: combat→resolveBattleEnd·reward→chooseReward·shop→leaveShop·event→chooseEncounterOption이 advanceCore. **스타터 DI 레지스트리(registerLayerStarter)** — shop/event 시작은 run.ts가 주입(사이클 차단). run 미import. yain 전 노드 core화
    shop.ts         상점(7.2): generateShop(레이어 offers 저작 진열 구체화 ?? 절차생성, keepGenerated 병행) · buyShopOffer · leaveShop
    encounter.ts    인카운터(7.2): applyOutcome · chooseEncounterOption
    items.ts        장착(4.3): equipItem/unequipItem(maxHp 재계산) · genItemOffers(상점)/itemRewardOptions(보상) · 인벤토리 왕복
    save.ts         런 이어하기 직렬화(순수): serializeRun/deserializeRun (Rng→{__rng:state} 치환·복원)
    passives.ts     모험(run) 스코프 특성/패시브 디스패처: fireRunTrigger(노드/골드/파티HP 트리거·재진입 가드). compileRules 재사용
    view.ts         getRunView (RunState → RunView; party[].pos 노출)
    index.ts        ▸배럴
  ai.ts             ▸배럴(파사드): export * from ai/index
  ai/
    policy.ts       chooseAction (프로파일 우선 → 공유 그리디 fallback; 결정론, rng 미사용)
    profile.ts      applyProfile (AiProfile 우선순위 룰 해석: skillKinds·evalCond·baseScore·weightBonus)
    index.ts        ▸배럴
  tests/            ▸코어 결정론 테스트 모음(파사드 경유 공개 API). 루트엔 파사드+프리미티브만 남김
    testutil.ts       테스트 공용 헬퍼(playToEnd·forceTurn)
    invariants/       ▸불변식 assertion 모듈(INVARIANTS-FROM-CLAUDE-CODE.md). 순수·무throw, 위반 목록 반환.
                      types.ts(Violation·Violations·summarize) · combat.ts(checkCombatInvariants A~K/J 관측충실) ·
                      run.ts(checkRunInvariants L~P) · index.ts 배럴
    harness/          ▸검증 harness. stressRun.ts(stressRun — 시드결정 무작위 합법행동으로 런 전체 구동·매 step 불변식 검사·
                      크래시/교착 가드·정책 random|ai-allies|ai·richActions·rngTrace(매 step rng상태 기록, 포팅 differential 보조) 옵션·phase 커버리지. "stress run"=검증용 무작위 한 판, 게임 캠페인 모드와 무관) ·
                      richActions.ts(enumerateRichActions — getLegalActions(targetUid)이 못 내는 targetCell·빈칸 AoE 앵커·free-cell(cells) 형태까지 열거, 명령공간 확대) ·
                      selfConsistency.ts(stressTrace·tracesMatch·battleTrace — 같은 시드 2회=동일 로그) · canonical.ts(canonicalJson/canonicalLog — 정렬키·정수·undefined생략 직렬화, TS↔Rust 바이트동일 계약 [`SERIALIZATION-CONTRACT.md`]) · vector.ts(recordVector/replayVector — 행동열 RunAction[] 기록·재생, record→replay 바이트동일 = Rust differential 오라클 [`PORTING.md`]) · index.ts 배럴
    golden/           ▸골든 이벤트 로그 코퍼스. corpus.ts(computeManifest — run×정책×시드×rich + 전투 픽스처의 canonical 트레이스 SHA 매니페스트) · manifest.json(동결 골든, 커밋됨)
    stress.test.ts    무작위 스트레스 런(전 런×정책×시드 크래시·교착·위반 0 + rich 행동 자극 + phase 커버리지)
    golden.test.ts    골든 코퍼스 회귀(동결 manifest와 SHA 비교 — 침묵 로그 드리프트 검출. 갱신=npm run golden:update)
    self-consistency.test.ts 결정론 자기일치(스트레스 런/전투 트레이스 동일 + 시드 의존성)
    port-vector.test.ts  행동 벡터 record→replay 바이트동일(differential 오라클, P0-1)
    data-export.test.ts  data.generated.json ↔ TS data 드리프트 게이트(P0-4)
    data-refs.test.ts    데이터 ID 참조 무결성(dangling 금지, DATA-SERIALIZATION-CONTRACT §6, P0-5)
    save-roundtrip.test.ts 세이브 왕복 항등(O1/O2 — serialize∘deserialize·Rng 보존·복원 후 동일 전개)
    invariants.test.ts 불변식 검사기 직접 검증 + L8 회귀(종료 시 reachable=[])
    engine.test.ts    전투 흐름(결정론·종료·명중·합법·SPD·대기)
    interrupt.test.ts 끼어들기(연격·버프출처·대상끼어들기·웹 경로)
    status.test.ts    상태이상(빙결·공포·관통·불사·재생)
    formation.test.ts 포메이션 총량보존·보스전 적용·데미지 미리보기
    area.test.ts      면적/타겟팅(재배치·AoE 모양·자유선택·빈칸앵커·쉴드→HP)
    ai.test.ts        AI 우선순위 룰 정책(prefer/target/조건·동점 결정론)
    passives.test.ts  특성/패시브 룰 엔진(트리거·조건·효과·모험 스코프)
    map.test.ts       층-그래프 검증(도달성·분기·toFloor 무결성)
    run.test.ts       런 맵/흐름/진형(결정론·연결성·완주 루프·진형 편성·노드 적override)
    run-progression.test.ts 육성/상점(보상 강화·학습 다운그레이드·구매·RunView·인카운터)
    run-meta.test.ts  영속/메타/다층(세이브 왕복·숙련도 게이팅·액트 진행)
    equip.test.ts     장착(스탯/데미지/쉴드 보정·equip 왕복)
```
> 테스트 배치: **코어=`core/tests/`에 모음**(파사드 경유 통합), **단일 모듈 단위테스트는 코로케이트**(`web/hexgeo.test.ts`·`web/editor/ops.test.ts`·`web/editor/editor-data.test.ts`[템플릿/store/스키마 정합성 W]). `node --test` 자동 디스커버리(`*.test.ts`) — 새 파일은 목록 갱신 불필요. 에디터 정합성 불변식(U/V/W)은 ops·hexgeo·editor-data 테스트가 커버.

## rust/ (TS→Rust 포팅, Phase 1 — PORTING.md)

```
rust/                Cargo workspace (크레이트 의존그래프 = 레이어 단방향 컴파일강제)
  Cargo.toml         workspace (members: spr-types, spr-data, spr-core)
  spr-types/         타입·프리미티브: rng.rs(mulberry32 u32 바이트동일) · canonical.rs(정렬키 직렬화=TS canonicalJson, ?Sized) · map.rs · data.rs(Pos/Character/StatusDef/FormationLayout) · skills.rs(Skill/SkillEffect/AreaShape) · passives.rs(Trigger/Condition/Effect/PassiveRule/TraitDef) · combat.rs(Unit/GameState/GameEvent/Action/CompiledRule)
  spr-data/          (→types) data.generated.json include_str 로드 + canonical 라운드트립 게이트 + 접근자(characters/skills/statuses/traits/standard_formation/demo_encounter)
  spr-core/          (→types,data) 게임 엔진 전체: util·graph · 전투(battle·damage·status·formation·targeting·skills·interrupt·passives/·flow·observation·session) · ai(choose_action) · run/(types·data[RunData]·helpers·passives[run스코프]·rewards·items·layers[시퀀서]·shop·encounter·run[orchestration]·view[RunView]·session[RunSession]). tests: differential(40벡터)·ai-corpus·full-run·rewards·grown-battle
app/                 Tauri2 데스크톱 셸 (워크스페이스 밖 — 게이트 영향 0). main.rs #[command]: 전투(create_session/battle_step/observation) + **풀게임 14종(run_create/view/enter_node/choose_reward/leave_shop/buy/encounter/move/set_active/equip/unequip/battle_step/ai_step/obs)** → spr_core Session/RunSession 래핑. 구동: 터미널1 npm run dev + 터미널2 `cd app && npx tauri dev`. `?core=rust`(전투)·`?core=rust&full=1`(풀게임)
```
> `npm run check`가 rust/ 존재 시 `cargo test` 게이트 실행(app/ 제외 — 독립 워크스페이스). **전 게임로직(전투+AI+런) TS↔Rust 바이트동일** — 풀 런 differential(맵·전투·보상·상점·인카운터·런패시브·성장·층전환). 상세: PORTING.md §7.

## data / view 파일

| 파일 | 레이어 | 책임 | 핵심 export |
|---|---|---|---|
| `src/data/statuses.ts` | data | 상태이상 정의(거동 데이터) | `STATUS_DEFS` |
| `src/data/skills.ts` | data | 스킬(위치마스크·쿨타임·명중·효과) | `SKILLS` |
| `src/data/characters.ts` | data | 캐릭터(고유 스탯 + learnset + `traitIds`) | `CHARACTERS` |
| `src/data/traits.ts` | data | **특성(상시 패시브 룰 묶음)** — `TraitDef`. 캐릭터가 traitIds로 참조 | `TRAITS` |
| `src/data/ai.ts` | data | **AI 행동결정 정책(우선순위 룰)** — `AiProfile`. 캐릭터가 aiProfileId로 참조(적/자동플레이) | `AI_PROFILES` |
| `src/data/encounters.ts` | data | 전투 배치 + **노드 타입별 적 구성(`NODE_ROSTERS`)** + 보스/포메이션 override | `DEMO_ENCOUNTER` · `NODE_ROSTERS` · `Encounter`/`Placement` |
| `src/data/events.ts` | data | 인카운터 이벤트(7.2) — 제목·텍스트·선택지(확정/도박)·결과(heal/hurt/gold/강화/학습) | `ENCOUNTER_EVENTS` · `EncounterEvent`/`EncounterOutcome` |
| `src/data/runs/*.json` | data | **저작 런(7장)** — 헥스 무방향그래프 맵·층 그래프. 진실=레포 JSON(에디터가 편집·내보내기·**repo 자동 기록 F3**). `RunDef` | (JSON) |
| `src/data/runs/runs.generated.ts` | data | **자동 생성 레지스트리(F3)** — dev-write 미들웨어가 `*.json` 스캔해 통째로 재생성(키=각 json id). 직접 편집 금지 | `RUNS` |
| `src/data/runs/index.ts` | data | 런 레지스트리 **파사드** — `runs.generated.ts`의 `RUNS` 재노출 + `DEFAULT_RUN` + 본거지 편성 배치 `rosterFromIds` | `RUNS` · `DEFAULT_RUN` · `rosterFromIds` |
| `src/data/data.generated.json` | data | **데이터 JSON 번들(파생, P0-4)** — `scripts/export-data.ts`가 TS data(items/skills/characters/traits/ai/statuses/…)를 canonical JSON으로 방출. TS=타입 authoring 소스, 이건 파생(Rust serde 로드). `npm run data:export` 재생성 + `data-export.test` 드리프트 게이트. 직접 편집 금지 | (JSON) |
| `src/data/formations.ts` | data | 포메이션 열보너스 배치(총량보존, 6장) | `STANDARD_FORMATION` |
| `src/web/meta.ts` | web | **영구 메타**(레벨/XP + 편성 로스터, 별도 세이브 `spr_meta_v1`) — `grantWin`(전투 승리 XP)·`masteryMap`/`masteryInfo`(허브)·`getRoster`/`setRoster`(편성 선택 영구) | `grantWin` · `masteryMap` · `masteryInfo` · `getRoster` · `setRoster` |
| `src/data/items.ts` | data | 장착 아이템(4.3) — 무기(dmgFlat·crit) / 방어구(hp·쉴드획득). `ItemDef`는 content.ts | `ITEMS` · `ITEM_POOL` |
| `src/cli/play.ts` | cli | 대화형/`--demo` 터미널 드라이버 | (엔트리) |
| `src/cli/ascii.ts` | cli | ASCII 보드 렌더(뷰 — core 아님) | `renderAscii` |
| `src/web/main.ts` | web | 웹 엔트리·**앱 상태기계**(title↔hub↔editor↔run, `appState`/`runActive`/`pauseOpen`)+런 컨트롤러·전투 루프(`render`/`renderBattle`/`driveBattle`/`battleStep`)·앱 액션(`restart`/`openPause`)·`AppCtx` 조립·부팅·keydown. 입력 핸들러는 `handlers/`로 분리. 편성=`hub.ts`·영속=`save.ts`·오버레이=`overlay.ts`·에디터=`editor/`·테스트플레이=`testRun` | (엔트리) |
| `src/web/handlers/` | web | **입력 핸들러 그룹(글루 분리)** — `ctx.ts`(`AppCtx`: 공유 가변상태 getter[`getRun`/`isBusy`]+앱 액션 주입) · `battle.ts`(`makeBattleHandlers` — 스킬·타겟팅·취소·스킵·시트·일시정지) · `run.ts`(`makeRunHandlers` — 노드·보상·스킬출전·상점·인카운터·파티·집) · `index.ts` 배럴. 핸들러는 ctx로만 상태 접근(재할당은 main), 상호참조는 앱 액션으로 평탄화. shell 핸들러는 main 잔류 | `makeBattleHandlers` · `makeRunHandlers` · `AppCtx` |
| `src/web/nodeMeta.ts` | web | 노드 종류 표시(아이콘/이름) — 런렌더·에디터 공용 | `TYPE_ICON` · `TYPE_NAME` · `CATALOG_TYPES` |
| `src/web/editor/` | web | **런 에디터 GUI**(구조 에디터) — 헥스 기하는 `../hexgeo.ts`(web 공용 SoT, 아래 행) 사용 · `store.ts`(드래프트 localStorage·repo 병합·blankRun·JSON 내보내기·**F3 `saveToRepo`**=dev fetch POST→실패 시 다운로드 폴백) · `ops.ts`(노드/변/층 순수 변이·`addNode`/`addNodeFromTemplate`(템플릿 복제 배치)/`moveNode`·`autoConnectAdjacent`·`adjacentPairs`·**F2: `setNodeLabel`**) · **`templates.ts`(노드 템플릿 라이브러리 localStorage — `saveTemplate`/`listTemplates`/`deleteTemplate`/`getTemplate`. 저작 노드(타입+라벨+core: 적 배치·레이어·룰) 스냅샷을 런 경계 넘어 재사용)** · `controller.ts`(목록↔편집 상태·핸들러) · `editorRender.ts`(목록) · `editView.ts`(SVG 단일 렌더: 격자 path·노드 폴리곤·벽이 hexgeo 공유 → 완벽 벌집. 테두리=별도 하이라이트 레이어(시작 파랑/클리어 초록 z2·선택 노랑 군집외곽 z5, 클리핑 없음). **포인터 기반 드래그**(공용 `drag.ts`)·다중선택(Ctrl·Ctrl+A·빈칸 해제)·일괄 이동/삭제·고정 뷰포트 카메라·벽 호버/클릭. **사이드바 카탈로그 2종: 노드 타입(`data-nt`→`onPlaceNode`) + "📋 내 템플릿"(`data-tpl`→`onPlaceTemplate` 복제 배치, ✕→`onDeleteTemplate`).** **F1: clear 노드 "다음 층" 드롭다운(toFloor) · 층 그래프 뷰포트(블럭 다이어그램 — 층=박스, clear→toFloor=방향 화살표, 입장 ★, 박스 클릭=편집·입장 지정·추가/삭제; BFS 레벨 좌→우 배치; **고정 크기 뷰포트=휠 줌·빈배경 드래그 팬·줌버튼**) · 선택 clear→대응 화살표 노랑 하이라이트**) · `nodePanel.ts`(**F2: 노드 메타 사이드바 — 라벨 입력만**, 적 배치·레이어는 노드 에디터) · **`nodeEditView.ts`+`layerSchema.ts`(Phase E: 노드 더블클릭[onUp 직접 감지]→전용 화면, **3슬롯(onEnter/core/onResolve) 레이어 리스트 추가/삭제/순서** + 스키마 구동 폼. FieldSpec 타입 number/text/bool/select(optionsFrom chars·statuses)/roster. onEnter/onResolve=DECO_KINDS. **헤더 "📋 템플릿으로 저장"→`onSaveTemplate`**)** · **`battlefieldEditor.ts`(combat 레이어 전장 그리드 — 적 4×4 카탈로그 드래그 배치/이동/제거 + 아군 읽기전용, `drag.ts` 재사용)** · **`ruleEditor.ts`+`ruleSchema.ts`(Phase E4: 트리거 룰 when/if/then 조립 GUI, 화자/기준 owner 픽커)** · **`eventEditor.ts`(Phase D: event 레이어 인라인 인카운터 저작 — 제목·본문·선택지(라벨 + 확정/🎲도박 모드: 도박=성공률+성공/실패 outcome))** · **`shopEditor.ts`(shop 레이어 진열 저작 — 품목 아이템/회복/스킬학습 + 비용, keepGenerated 토글, `ShopOfferDef`)**. **헤더 런/현재층 제목 인라인 편집(`onSetRunName`/`onSetFloorName` — 기존 name 필드) · 두 뷰포트 사이 드래그 스플리터(`ed-vsplit`→`onSplit`, 노드 맵 높이 조절·층 영역 flex-fill, 편집 중 보존).** **F3: "💾 repo에 저장" 버튼(목록 카드 + 편집 헤더) → `onSaveToRepo`(파일명 prompt → `saveToRepo`).** `validateRun`/`hexAdjacent` 재사용 | `createEditor` · `renderEditor` |
| `src/web/hub.ts` | web | **본거지 편성 컨트롤러**(`createHub`) — playable 풀에서 1~4명 선택(영구) 캡슐화 + 선택 로스터로 런 생성. `makeRun`·`data`·`toggle` | `createHub` |
| `src/web/save.ts` | web | **런 이어하기 영속화**(`spr_save_v1`) — 순수(run 인자). `saveRun`·`loadRun`·`clearSave` | `saveRun` · `loadRun` · `clearSave` |
| `src/web/shell.ts` | web | **게임 흐름 셸** — 타이틀·본거지(집)·일시정지 화면. 본거지=캐릭터 편성 선택 그리드(playable 풀 1~4명 토글, 숙련도 표시) / 런 중=현재 파티+이어하기. 런 바깥 | `renderTitle` · `renderHub` · `renderPause` · `ShellHandlers` |
| `src/web/overlay.ts` | web | **오버레이 컨트롤러**(`createOverlay`) — 맵=파티 편성 / 전투=단독 캐릭터 시트. `buildSheetData`·`buildBattleSheet`·`renderOverlay` + 시트/파티뷰 핸들러. main이 `{app,ui,getRun,render}` 주입 | `createOverlay` |
| `src/web/render.ts` | web | **전투 렌더** — 영속 셸(svg·header·battlelayout) 1회 생성 후 **존 갱신**(.battlemain/.battleside). **.battleleft는 TimelinePanel이 소유**(통짜 재렌더서 분리). 셀 타겟팅·SVG 화살표. renderApp(…, panel) | `renderApp` · `avatarHtml` |
| `src/web/battle/shared.ts` | web | 공용 소도구(esc·r1·ck·avatarHtml) + UI 타입(Ui·Handlers·TgtCtx) | — |
| `src/web/battle/unitCard.ts` | web | 그리드 캐릭터 카드(아바타·쉴드바(체력바 위 좌측정렬)·HP바·HP·상태칩) | `unitCard` |
| `src/web/battle/status.ts` | web | 상태이상 칩 + 펼침 팝오버(거동설명·스택·지속·다음변화·**출처**, 호버/포커스) | `statusChips` · `describeStatus` |
| `src/web/battle/skillDesc.ts` | web | 스킬 데이터→정돈 설명(쿨·명중·피해/사정권·AoE 규칙/특징 칩) | `skillCardBody` · `skillInline` · `areaRule` |
| `src/web/battle/passiveDesc.ts` | web | 특성/패시브 룰 → 한글 한 줄(when·if→then). charSheet 특성 섹션·패시브 칩용 | `describeRule` · `describeSkillPassives` |
| `src/web/battle/actions.ts` | web | 행동 패널(균일 스킬 카드 4개 / 타겟팅 프롬프트) | `actionPanel` |
| `src/web/battle/timelinePanel.ts` | web | **행동서열 패널(영속·모드)** — `rolling`(중앙 확장 SPD 주사위→±→서열) → `dock()`(같은 행 FLIP 슬라이드로 좌측 레일) → `live`(전투 타임라인: 완료✓/현재▶/끼어들기). roundIntro+timeline 통합. `.battleleft`에 영속 마운트 | `createTimelinePanel` · `RollView` |
| `src/web/battle/{events,arrow}.ts` | web | 이벤트→로그 한 줄 / 캐스터→타겟 눈금 화살표 | `formatEvent` · `drawArrow` |
| `src/web/hexgeo.ts` | web | **헥스 기하 SoT(web 공용 — 에디터+플레이어 맵)**: `cornerOffsets(size)`(스케일 파라미터화 꼭짓점)·`hexCorners`/`hexPoints`/`hexEdge`·`EDGE_DIRS`/`edgeDirIndex`(방향↔변)·`ccx`/`ccy`·`gridPathStr`·`pixelToAxial`. `hexgeo.test`로 인접=변(꼭짓점 2개) 공유 + 벽 기하 검증 | (geom) |
| `src/web/runRender.ts` | web | **맵/보상/결과** 화면 렌더 + 헥스 노드 + 파티 요약(클릭→시트). **맵=고정 뷰포트(`mapview`)+공용 `attachCamera`(휠 줌·드래그 팬, 층 바뀌면 리셋·현재 노드 중앙). 열린 길(연결선)은 비표시(reachable 발광으로). 벽(인접·미연결 노드쌍=막힌 길)은 `.mwalls` SVG로 표시(에디터와 동일 개념·`hexgeo` 기하 공유, SIZE=46)** | `renderRunScreen` |
| `src/web/camera.ts` | web | **공용 뷰포트 카메라 `attachCamera`** — 고정 viewport 안 field를 translate+scale(휠 줌·드래그 팬·줌버튼/리셋, 영속). 에디터 노드 맵·층 그래프 + 인게임 맵 공유 | `attachCamera` |
| `src/web/charSheet.ts` | web | **캐릭터 시트** — 능력치표(원본→현재 델타)·3 장착칸(장착·교체·해제+인벤토리 픽커)·보유 스킬(맵=활성4 토글, 전투=읽기전용). `sheetBody`+`wireSheet`로 분리 → 전투 단독 모달(`renderCharSheet`)·파티뷰 상세 pane 공용 | `renderCharSheet` · `sheetBody` · `wireSheet` · `SheetData` |
| `src/web/drag.ts` | web | **공용 포인터 드래그**(`beginPointerDrag`) — 네이티브 HTML5 DnD 대체. 커서 따라오는 `.drag-avatar`·`elementFromPoint` 드롭 라우팅·클릭 폴백. 에디터·파티편성 공용 | `beginPointerDrag` |
| `src/web/partyView.ts` | web | **파티 편성(통합 파티뷰, 모달)** — 3칼럼: 좌 4×4 진형 보드(포인터 드래그 배치/교대) / 중 선택 캐릭 상세(charSheet 인라인) / 우 장착 인벤토리. 드래그=`drag.ts` 포인터(고스트 없음). 맵 전용 | `renderPartyView` · `PartyViewData` |
| `src/web/rustBattle.ts` | web | **전투 엔진 검증 하네스(P1-13)** — `?core=rust\|ts` 부팅 진입(main.ts 분기, 기존 게임 무수정). `selectBattleBackend`로 데모 전투를 **실제 `unitCard`** 로 렌더 + 관측 `legalActions` 버튼 행동 + 자동플레이(first-legal). 관측이 TS와 바이트 동일이라 카드 UI 그대로 재사용 | `mountRustBattle` |
| `src/web/rustRun.ts` | web | **풀 게임 Rust 하네스(P2-7)** — `?core=rust&full=1` 진입. 전체 로그라이크를 Rust `RunSession`(IPC `run_*` 커맨드)으로 구동: 맵(reachable 노드)·보상·상점·인카운터·전투(unitCard 그리드, 적턴 AI 자동). getRunView 렌더 | `mountRustRun` |
| `src/web/coreAdapter.ts` | web | **코어 백엔드 어댑터(P1-13 피처플래그)** — `selectBattleBackend()`: `?core=rust`+Tauri 런타임=Rust(IPC invoke `create_session`/`battle_step`), 아니면 TS(인메모리). 두 백엔드 `{create(seed),step(action)}→{eventDelta,observation}` 동형(spr-core Session과 동일). 전투(데모) 육안 differential 검증용 | `selectBattleBackend` · `BattleBackend` |
| `src/web/style.css` | web | 다크 테마 스타일 + **게임셸 리셋**(상단: 브라우저 제스처/크롬 제거 — overscroll·touch-action·tap-highlight·`:focus-visible`·커스텀 스크롤바·number 스피너. CLAUDE "웹 렌더링 티 금지" B) | — |
| `index.html` · `vite.config.ts` | web | Vite 진입/설정 (`npm run dev`). **F3 dev-write 미들웨어**(`apply:"serve"` 전용 — `POST /api/save-run` → `src/data/runs/{fileId}.json` 기록 + `runs.generated.ts` 재생성, 빌드 무영향) | `devWriteRuns` |

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
| 특성/패시브 룰 발동(when/if/then) | **전투**: `combat/passives/`(각 전투 훅이 `fireTrigger` 인라인 → `Unit.rules`). **모험**: `run/passives.ts fireRunTrigger`(enterNode=nodeEnter·completeNode=nodeClear·advanceAct=actStart·resolveBattleEnd=goldGain·healParty=partyHpChange). **활성(출전) 스킬 passives + 캐릭 traitIds(항상)** = 양쪽 공통(`compileRules`). 결정론·재진입 가드 |
| 모험 패시브 버프 계승 | `Effect grantRunStatus` → `RunState.pendingStatuses[charId]` → 다음 `enterNode` 전투 생성 시 `combat/state.ts` allyStates `startStatuses`로 주입 후 1회 소비 |
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
| 헥스 인접 무방향그래프 맵·도달성·검증 (7.1) | `run/graph.ts`: `hexAdjacent`·`neighborIds`·`liveReachable`(재방문 불가)·`validateRun` (메커니즘=엔진) |
| 맵 데이터화(저작 런) (7.1) | `data/runs/*.json` `RunDef`/`FloorDef`/`MapNode`/`MapEdge`(`types/map.ts`) · `data/runs/index.ts RUNS` · `createRun(seed,roster,runDef)` |
| 클리어 노드 = 층 종료 / 보스=길목 | `run/run.ts`: `enterNode`(clear→`completeFloor`) · 다중 보스/클리어 갈림길(아무 클리어 진입=완료) |
| 런 에디터(런 CRUD·헥스 편집·층 패널·검증·테스트플레이) | `web/editor/`(store·ops·controller·editorRender·editView) · 타이틀 진입(`shell.ts` onEditor) · `validateRun`/`hexAdjacent` 재사용 · `createRun(draft)` 테스트플레이 |
| 노드 진입·해소·전투생성·승패 (7장) | `run/run.ts`: `enterNode`(콘텐츠=레이어 시퀀서 일원화, clear만 구조)/`resolveBattleEnd` · `run/layers.ts nodeCore`(인라인 core ?? `data/nodeCores.ts defaultCore(type)`) |
| 런 이어하기 영속화 (셸) | `run/save.ts` `serializeRun`/`deserializeRun`(순수, Rng=state만) · 웹 `main.ts` localStorage(`spr_save_v1`, render마다 저장·승패/포기 시 삭제·부팅 복원) |
| 다층(층 그래프) 진행 (7.3) | `RunDef.entryFloorId`·clear `toFloor`(분기) · `run/run.ts` `completeFloor(clear)`(toFloor로 분기·50%회복·toFloor 없으면 won) · `graph.ts validateRun`(층-그래프 도달성·승리 클리어) · `RunView.floor`/`totalFloors` · 웹 "층 N/M" · 무방향 변 선 |
| 보상 3택1 생성·적용 (4.5) | `run/rewards.ts`: `genRewards` · `run/run.ts`: `chooseReward` |
| 육성: 스킬 보유풀/활성선택/강화티어 (4.2/4.6) | `PartyMemberState.ownedSkillIds`/`activeSkillIds` · `Skill.nextTierId`(데이터 티어) · `run/run.ts`: `setActiveSkill`·`chooseReward`(강화=id교체/학습=풀추가) · `combat/state.ts` makeUnit가 활성 4 사용 |
| 전용기/범용기 + learnset (4.6) | `Skill.exclusiveTo`(전용기 소유자, 없으면 범용기 `u_*`) · `Character.skillIds`=learnset(포켓몬식, 학습 가능 여부) · 범용기는 여러 learnset 공유(예 `u_guard`=kim·shin·cho) · 게이팅=`run/rewards.ts` genRewards가 learnset에서 추첨 |
| 장착 아이템 (4.3) | `ItemDef`(content.ts)·`data/items.ts` `ITEMS` · `PartyMemberState.equipped`+`RunState.inventory` · `combat/state.ts` makeUnit가 비-HP 스탯 합산+`Unit.equipDmgFlat`/`equipShieldGainAdd` · `damage.ts`/`skills.ts` read훅 · `run/items.ts` equip/오퍼 · 웹=`charSheet.ts` 장착칸. 지닌물건=후속 |
| 아군 진형 편성 (6장) | `PartyMemberState.pos`(열=진형 보너스) · `run/run.ts` `movePartyMember`(맵전용 이동/교대) · `combat/formation.ts` 열 총량÷인원 분배 · 웹=`partyView.ts` 드래그앤드롭 보드 |
| 상점·인카운터 + 골드 (7.2) | `RunState.gold`(전투승리/인카운터 획득) · 상점=`generateShop`+`buyShopOffer`(강화권/범용기/회복, 골드)·`leaveShop` · 인카운터=`data/events.ts` 이벤트 추첨+`chooseEncounterOption`(확정/도박, 생존보장) · 웹: runRender `shopScreen`/`encounterScreen` |
| 적 구성(노드별, 데이터) | `data/encounters.ts`: `NODE_ROSTERS` (run.ts가 타입 키로 조회) · **노드별 override**=`MapNode.roster`(`enterNode`가 타입 기본보다 우선; F2) |
| 결정론 휴리스틱 AI (그리디 fallback) | `ai/policy.ts`: `chooseAction`/`greedy` |
| 적 전용 AI 패턴(우선순위 룰 프로파일) | `data/ai.ts` `AI_PROFILES` + `Character.aiProfileId` → `ai/profile.ts` `applyProfile`(인터프리터) · `core/types/ai.ts` 스키마 |

## 미구현 → 들어갈 자리 (☐, 부록 B)

| 기능 | 예정 위치 |
|---|---|
| **런 에디터 — F-시리즈 완료** (E1–E3 구조 + F1 분기 층 그래프 + F2 노드 메타 + F3 dev-write + F4 허브 런 선택 모두 구현, `src/web/editor/`) | 후속 후보: 상점/인카운터 노드 메타·웨이브(전투 노드 연속 파)·노드 보상 override 등(필요 시 신규 슬라이스) |
| 메타/본산/기억회랑 (5장) | 신규 `core/meta/` (런 위 레이어) |
| 상점/인카운터 본구현 (현재 즉시해소 stub) | `core/run/` (커지면 비전투 해소를 `run/nodes.ts`로 분리) |
| 웹 렌더러 고도화(스프라이트/애니메이션) | `src/web/` (현재 v2: DOM 카드 + 피격 플래시 + 로그 재생) |
