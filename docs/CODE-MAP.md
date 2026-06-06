# 코드 매핑 (CODE-MAP)

> **목적**: "어떤 코드 파일이 무슨 역할인지"를 한눈에. 작업 전 이 문서를 읽어 맥락을 잡고,
> 의미 있는 슬라이스를 완료하면 이 문서를 **반드시 갱신**한다. (규칙: `CLAUDE.md`)
>
> 게임 규칙 자체는 여기 적지 않는다 → [`GAME-DESIGN.md`](GAME-DESIGN.md)가 그 SoT.

## 레이어 개요

```
src/
  contract/ ← 프론트↔엔진 계약(타입 스키마) + 순수 유틸(graph). 엔진 아님. (옛 core, TS 엔진 은퇴로 개명)
  data/     ← 데이터 주도 콘텐츠. 엔진은 이걸 "해석"만. (8.6/8.8) — 디자이너 가이드: src/data/README.md
  web/      ← 웹 렌더러(플레이어 GUI). Rust 엔진을 Tauri IPC로 구동 + 이벤트 로그 재생 (8.5)
rust/       ← ★ 게임 엔진(spr-types←spr-data←spr-core). 결정론·순수. 무작위=state.rng만.
app/        ← Tauri2 셸(IPC 커맨드 = 세션 API).
```

**단방향 의존:** `data → contract(types) ← web(프론트)` (TS측) / `spr-data → spr-types ← spr-core`(Rust 엔진). 프론트는 엔진을 **IPC로만** 호출.
**엔진(rust/spr-core)·contract는 console/DOM/IO 0.** IO는 web/(프론트)·app/(Tauri)에서만.
타입 레벨: `tsconfig.json`(contract/data, DOM lib 없음) vs `tsconfig.web.json`(웹, DOM lib).

## 모듈 트리 (배럴 = 공개 API, 소비자는 배럴만 import)

```
src/contract/         ← **프론트↔Rust 엔진 계약**(옛 src/core, TS 엔진 은퇴로 개명). IPC/데이터 타입 + 순수 유틸만. 엔진=rust/spr-core.
  rng.ts            시드 PRNG 타입(RunState.rng 참조용 — 런타임 무작위는 Rust) → Rng
  types.ts          ▸배럴: export type * from types/{content,passives,ai,map,runtime} — 프론트·데이터·Rust(export)가 공유하는 계약 스키마
  types/
    content.ts      디자이너 스키마(데이터 계약): Side·Pos·StatusDef(+거동필드)·SkillEffect·
                    AreaShape·SkillTarget·Skill(+active/passives)·FormationLayout·Character(+traitIds/aiProfileId)
    passives.ts     특성/패시브 룰 스키마: PassiveRule·Trigger·Condition·Effect·TraitDef·EffTarget·StatKey
    ai.ts           AI 행동결정 정책 스키마: AiProfile·AiRule·AiCondition·SkillKindPref·TargetPref·AiWeightKey
    map.ts          헥스 인접 무방향그래프 맵 스키마: RunDef·FloorDef·MapNode(q,r·toFloor?·roster?·label?·**layers?·core?**)·MapEdge. **combat 레이어가 rules?(NodeRule=PassiveRule+owner) 소유 — 페이즈별 대사, owner(side+charId)로 self=배치 개체 지정**. **DecoratorLayer(gold/heal/grantStatus/text)·InteractiveLayer(combat[roster/rosterPreset/boss]/reward/shop/event)·Layer·NodeLayers(onEnter/onResolve)**. NodeType는 content(+clear). yain 전 노드=core 이전 완료(type=표시용 잔존)
    runtime.ts      엔진 상태: StatusInstance·Unit·PartyMemberState·TurnKind·QueueEntry·
                    Action·Phase·GameEvent·GameState·UnitView·LegalAction·Observation
  run.ts            ▸배럴(파사드): export * from run/index
  run/
    graph.ts        헥스 인접 무방향그래프 유틸(순수): hexAdjacent(6방향) · neighborIds · canReachClear/liveReachable · reachableFromEntry · validateFloor/validateRun(인접 변 검증·고립노드). **에디터·런화면이 소비**(그래프 검증/렌더). 엔진 무관 순수 기하
    types.ts        런 도메인 DTO 타입(leaf): RunPhase·RewardOption·ShopOffer·RunState·NodeStatus·RunView
    index.ts        ▸배럴(graph + 타입만)
```
> **TS 엔진은 Rust 마이그레이션 완료 후 은퇴** — 전투·AI·런 오케스트레이션·골든/differential 하네스·CLI 전부 제거. `archive/ts-core` 브랜치 + `tag ts-golden-oracle`에 **재실행 가능 상태로 보관**(신규 메커니즘을 TS-선구현→differential로 검증하려면 체크아웃). 현 엔진 = `rust/spr-core`. 단위테스트는 `web/`에 코로케이트(hexgeo·editor).

## rust/ (TS→Rust 포팅, Phase 1 — PORTING.md)

```
rust/                Cargo workspace (크레이트 의존그래프 = 레이어 단방향 컴파일강제)
  Cargo.toml         workspace (members: spr-types, spr-data, spr-core)
  spr-types/         타입·프리미티브: rng.rs(mulberry32 u32 바이트동일) · canonical.rs(정렬키 직렬화=TS canonicalJson, ?Sized) · map.rs · data.rs(Pos/Character/StatusDef/FormationLayout) · skills.rs(Skill/SkillEffect/AreaShape) · passives.rs(Trigger/Condition/Effect/PassiveRule/TraitDef) · combat.rs(Unit/GameState/GameEvent/Action/CompiledRule)
  spr-data/          (→types) data.generated.json include_str 로드 + canonical 라운드트립 게이트 + 접근자(characters/skills/statuses/traits/standard_formation/demo_encounter)
  spr-core/          (→types,data) 게임 엔진 전체: util·graph · 전투(battle·damage·status·formation·targeting·skills·interrupt·passives/·flow·observation·preview·session) · ai(choose_action) · run/(types·data[RunData]·helpers·passives[run스코프]·rewards·items·layers[시퀀서]·shop·encounter·run[orchestration]·view[RunView]·save[직렬화]·session[RunSession]). tests: differential(40벡터)·ai-corpus·full-run·rewards·grown-battle·save-roundtrip
app/                 Tauri2 데스크톱 셸 (워크스페이스 밖 — 게이트 영향 0). main.rs #[command]: 전투(create_session/battle_step/observation) + **풀게임 RunSession 커맨드(run_create[/roster/def]·view·enter_node·choose_reward·leave_shop·buy·encounter·move·set_active·equip·unequip·battle_step·ai_step·battle_obs·battle_init·battle_view·battle_targeting·sheet_data·save·load)** → spr_core Session/RunSession 래핑. 구동: 터미널1 npm run dev + 터미널2 `cd app && npx tauri dev`. `?core=rust`(전투)·`?core=rust&full=1`(풀게임)
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
| `src/web/main.ts` | web | 웹 엔트리(부팅) — `mountRustRun(app, 42)`만. 게임/에디터/허브/전투/일시정지/세이브 전체는 `rustRun`이 Rust 세션(IPC)으로 구동. 제품 셸=Tauri | (엔트리) |
| `src/web/nodeMeta.ts` | web | 노드 종류 표시(아이콘/이름) — 런렌더·에디터 공용 | `TYPE_ICON` · `TYPE_NAME` · `CATALOG_TYPES` |
| `src/web/editor/` | web | **런 에디터 GUI**(구조 에디터) — 헥스 기하는 `../hexgeo.ts`(web 공용 SoT, 아래 행) 사용 · `store.ts`(드래프트 localStorage·repo 병합·blankRun·JSON 내보내기·**F3 `saveToRepo`**=dev fetch POST→실패 시 다운로드 폴백) · `ops.ts`(노드/변/층 순수 변이·`addNode`/`addNodeFromTemplate`(템플릿 복제 배치)/`moveNode`·`autoConnectAdjacent`·`adjacentPairs`·**F2: `setNodeLabel`**) · **`templates.ts`(노드 템플릿 라이브러리 localStorage — `saveTemplate`/`listTemplates`/`deleteTemplate`/`getTemplate`. 저작 노드(타입+라벨+core: 적 배치·레이어·룰) 스냅샷을 런 경계 넘어 재사용)** · `controller.ts`(목록↔편집 상태·핸들러) · `editorRender.ts`(목록) · `editView.ts`(SVG 단일 렌더: 격자 path·노드 폴리곤·벽이 hexgeo 공유 → 완벽 벌집. 테두리=별도 하이라이트 레이어(시작 파랑/클리어 초록 z2·선택 노랑 군집외곽 z5, 클리핑 없음). **포인터 기반 드래그**(공용 `drag.ts`)·다중선택(Ctrl·Ctrl+A·빈칸 해제)·일괄 이동/삭제·고정 뷰포트 카메라·벽 호버/클릭. **사이드바 카탈로그 2종: 노드 타입(`data-nt`→`onPlaceNode`) + "📋 내 템플릿"(`data-tpl`→`onPlaceTemplate` 복제 배치, ✕→`onDeleteTemplate`).** **F1: clear 노드 "다음 층" 드롭다운(toFloor) · 층 그래프 뷰포트(블럭 다이어그램 — 층=박스, clear→toFloor=방향 화살표, 입장 ★, 박스 클릭=편집·입장 지정·추가/삭제; BFS 레벨 좌→우 배치; **고정 크기 뷰포트=휠 줌·빈배경 드래그 팬·줌버튼**) · 선택 clear→대응 화살표 노랑 하이라이트**) · `nodePanel.ts`(**F2: 노드 메타 사이드바 — 라벨 입력만**, 적 배치·레이어는 노드 에디터) · **`nodeEditView.ts`+`layerSchema.ts`(Phase E: 노드 더블클릭[onUp 직접 감지]→전용 화면, **3슬롯(onEnter/core/onResolve) 레이어 리스트 추가/삭제/순서** + 스키마 구동 폼. FieldSpec 타입 number/text/bool/select(optionsFrom chars·statuses)/roster. onEnter/onResolve=DECO_KINDS. **헤더 "📋 템플릿으로 저장"→`onSaveTemplate`**)** · **`battlefieldEditor.ts`(combat 레이어 전장 그리드 — 적 4×4 카탈로그 드래그 배치/이동/제거 + 아군 읽기전용, `drag.ts` 재사용)** · **`ruleEditor.ts`+`ruleSchema.ts`(Phase E4: 트리거 룰 when/if/then 조립 GUI, 화자/기준 owner 픽커)** · **`eventEditor.ts`(Phase D: event 레이어 인라인 인카운터 저작 — 제목·본문·선택지(라벨 + 확정/🎲도박 모드: 도박=성공률+성공/실패 outcome))** · **`shopEditor.ts`(shop 레이어 진열 저작 — 품목 아이템/회복/스킬학습 + 비용, keepGenerated 토글, `ShopOfferDef`)**. **헤더 런/현재층 제목 인라인 편집(`onSetRunName`/`onSetFloorName` — 기존 name 필드) · 두 뷰포트 사이 드래그 스플리터(`ed-vsplit`→`onSplit`, 노드 맵 높이 조절·층 영역 flex-fill, 편집 중 보존).** **F3: "💾 repo에 저장" 버튼(목록 카드 + 편집 헤더) → `onSaveToRepo`(파일명 prompt → `saveToRepo`).** `validateRun`/`hexAdjacent` 재사용 | `createEditor` · `renderEditor` |
| `src/web/hub.ts` | web | **본거지 편성 컨트롤러**(`createHub`) — playable 풀에서 1~4명 선택(영구) 캡슐화 + 선택 로스터로 런 생성. `makeRun`·`data`·`toggle` | `createHub` |
| `src/web/save.ts` | web | **런 이어하기 영속화**(`spr_save_v1`) — 순수(run 인자). `saveRun`·`loadRun`·`clearSave` | `saveRun` · `loadRun` · `clearSave` |
| `src/web/shell.ts` | web | **게임 흐름 셸** — 타이틀·본거지(집)·일시정지 화면. 본거지=캐릭터 편성 선택 그리드(playable 풀 1~4명 토글, 숙련도 표시) / 런 중=현재 파티+이어하기. 런 바깥 | `renderTitle` · `renderHub` · `renderPause` · `ShellHandlers` |
| `src/web/render.ts` | web | **전투 렌더(Rust 경로)** — 영속 셸(svg·header·battlelayout) 1회 생성 후 **존 갱신**(.battlemain/.battleside). .battleleft=TimelinePanel 소유. `renderAppObs`(관측+스킬바+로그)·`renderBattleZones`(GameState 비의존)·`computeTgtFromObs`(타겟팅, IPC `prev`로 미리보기 주입). 면적기하=`battle/areaGeo.ts` | `renderAppObs` · `renderBattleZones` |
| `src/web/battle/areaGeo.ts` | web | 면적 스킬 기하(순수): `computeAreaCells`(앵커+AreaShape→칸). 타겟팅 풋프린트 하이라이트용(구 core/combat/targeting, 코어 은퇴로 이주) | `computeAreaCells` |
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
| `src/web/rustRun.ts` | web | **풀 게임 Rust 컨트롤러(P2-7/P3)** — `?core=rust&full=1` 진입. **전체 프로그램**(타이틀·허브·에디터·런·전투·일시정지)을 Rust `RunSession`(IPC `run_*`)으로 구동, **원래 렌더러 그대로 재사용**. 전투: 2단계 타겟팅+HP손실 예고(`run_battle_targeting`)+끼어들기 고스트+라운드 주사위 연출(`playDice`/`run_battle_init`). 오버레이(시트/편성)=`rustOverlay` 위임. **세이브/이어하기**=`run_save`/`run_load` IPC + localStorage(`spr_rust_save_v1`, 부팅 복원·전투중 포함 영속). 메타(숙련도)·에디터 저작은 프론트 영속 | `mountRustRun` · `playDice` · `persist` · `openOverlay` |
| `src/web/rustOverlay.ts` | web | **Rust 경로 오버레이 컨트롤러(P3-3)** — overlay.ts의 Rust판. 맵=파티 편성(`renderPartyView`) / 전투=단독 캐릭터 시트(`renderCharSheet`). 원시 데이터=IPC `run_sheet_data`(SheetBundle: members·inventory·battleUnits), 정적 보강(base/특성/패시브 설명)은 프론트. 변이(장착/활성/진형)=`run_equip/unequip/set_active/move` → 번들·뷰 재조회 | `createRustOverlay` · `SheetBundle` |
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
