# 코드 매핑 (CODE-MAP)

> **목적**: "어떤 코드 파일이 무슨 역할인지"를 한눈에. 작업 전 이 문서를 읽어 맥락을 잡고,
> 의미 있는 슬라이스를 완료하면 이 문서를 **반드시 갱신**한다. (규칙: `CLAUDE.md`)
>
> 게임 규칙 자체는 여기 적지 않는다 → [`DOC-INDEX.md`](DOC-INDEX.md)가 그 SoT.

---

## 🗺️ 워크스페이스 한눈에 (폴리글랏 Tauri 앱)

이 프로젝트는 **두 언어**가 한 데스크톱 앱을 이룬다 — 네이티브 그래픽 엔진이 없어 GUI는 웹으로 두고, 게임 로직만 Rust로.

```
┌─ engine/ ──────────────────┐        ┌─ web/ (TS — 브라우저/웹뷰가 실행) ──┐
│ ★ 게임 엔진 (결정론 코어) │        │  src/ui/       플레이어 GUI (렌더)   │
│   spr-types ← 타입·RNG    │        │  src/content/  콘텐츠(스킬·캐릭·런…) │
│   spr-data  ← 콘텐츠 로더  │        │  src/contract/ 프론트↔엔진 계약     │
│   spr-core  ← 전투·AI·런   │        └────────────────────────────────────┘
└───────────┬──────────────┘                         ▲
            │                                         │ 렌더(이벤트 델타·뷰)
   IPC 커맨드 │ ┌─ desktop/ (Tauri2 데스크톱 셸) ─┐ invoke│
            └▶│  src/main.rs = 세션 API 다리     │◀───────┘
              │  (run_create·battle_step …)     │
              └─────────────────────────────────┘
```

**한 판의 흐름**: 플레이어 입력 → `web/src/ui`(GUI) → `invoke("run_…")` → `desktop/src/main.rs`(IPC) → `engine/spr-core`(엔진이 상태 변이) → **이벤트 델타 + 뷰** 반환 → `web/src/ui`가 렌더. **전체 게임 상태·로직은 Rust가 소유**, 웹은 그리기만.

| 디렉터리 | 언어 | 역할 | 빌드/툴체인 |
|---|---|---|---|
| **`engine/`** | Rust | **★ 게임 엔진** — 전투·AI·런 오케스트레이션·세이브. 결정론·순수(IO 0). | Cargo workspace (`spr-types ← spr-data ← spr-core`) |
| **`desktop/`** | Rust | **Tauri2 셸** — 엔진을 IPC 커맨드로 노출(세션 API). 프론트↔엔진 다리. | 별도 Cargo 패키지(워크스페이스 밖 → `cargo test` 게이트 가벼움) |
| **`web/src/ui/`** | TS | **플레이어 GUI** — 타이틀·허브·맵·전투·오버레이·에디터. Rust를 IPC로 구동. | Vite (`tsconfig.web.json`, DOM) |
| **`web/src/content/`** | TS | **콘텐츠** — 스킬·캐릭·아이템·특성·런. `npm run data:export` → JSON → Rust 로드. | `tsconfig.json` (no-DOM) |
| **`web/src/contract/`** | TS | **계약** — 프론트↔엔진 공유 타입 스키마 + 순수 유틸(hex graph). 엔진 아님. | `tsconfig.json` (no-DOM) |

> **왜 둘로 갈리나 (engine/ vs web/)**: `web/`은 TS/웹 툴체인(vite·tsc·npm) 소유, `engine/`는 Cargo 소유 — 한 트리에 `.ts`와 `.rs`를 섞으면 빌드 루트·`target/`·language server가 충돌. 그래서 **언어/툴체인별로 최상위 분리**(역할명: engine·desktop·web). **"core"는 하나 = `engine/spr-core`**. (`web/src/contract`는 옛 `src/core`가 엔진 은퇴 후 개명된 계약 레이어, 엔진 아님.)
>
> **단방향 의존**: Rust = `spr-data → spr-types ← spr-core`(Cargo가 순환 금지 = 컴파일 강제). TS = `data → contract ← web`. 프론트는 엔진을 **IPC로만** 호출(직접 import 불가 — 언어가 다름).

---

## 1. `engine/` — 게임 엔진 (★ 게임 로직 전부 여기)

```
engine/                Cargo workspace. cargo test = differential 회귀 게이트(npm run check가 구동)
  spr-types/src/     타입·프리미티브 (serde derive 허용)
    rng.rs             시드 PRNG(mulberry32, u32 — TS 바이트동일) + serde(세이브)
    canonical.rs       정렬키 직렬화(=TS canonicalJson, ?Sized) — 이벤트 로그 바이트계약
    combat.rs          전투 런타임: Unit·StatusInstance·CompiledRule·QueueEntry·SpeedRoll·GameState·GameEvent·Action
    party.rs           PartyMemberState·Equipped·PendingStatus (세이브 직렬화 대상)
    map.rs             런 맵: RunDef·FloorDef·MapNode·MapEdge·NodeLayers·Layer·NodeRule·EncounterEvent
    data.rs            데이터 스키마: Pos·Character·StatusDef·ItemDef·FormationLayout·Placement
    skills.rs          Skill·SkillEffect·AreaShape
    passives.rs        패시브 DSL: Trigger·Condition·Effect·PassiveRule·TraitDef
    ai.rs              AI 정책 스키마: AiProfile·AiRule·AiCondition
  spr-data/src/lib.rs  data.generated.json include_str 로드 + canonical 라운드트립 게이트 + 접근자(chars/skills/statuses/traits/items/ai/formations/runs)
  spr-core/src/        ★ 엔진 메커니즘 (순수·결정론, 무작위=state.rng만)
    battle.rs          makeUnit·createBattle(+성장변종 create_battle_grown·equip_bonus·make_unit_grown) · 라운드/턴 서열(start_round·advance·on_normal_turn)·승패(check_win)
    flow.rs            step (행동 1회 처리 오케스트레이터 — 정규 턴 진행·끼어들기 삽입)
    damage.rs          computeDamage·dealRawDamage (치명타·곱연산·쉴드→HP·공포·관통·불사)
    status.rs          applyStatusInstance·tickPeriodic (DoT/HoT 부여·틱)
    formation.rs       getFormationBonus (열보너스 총량보존)
    targeting.rs       validTargets·reachableColumns·computeAreaCells·areaTargets·computeHitChance·getLegalActions
    skills.rs          resolveSkill·resolveAnchorUid·applySelf/TargetEffects·moveUnit
    interrupt.rs       predictInterruptSubjects·insertInterrupts (끼어들기)
    observation.rs     buildObservation·UnitView·StatusView (관측 = 프론트/AI 1급 인터페이스)
    preview.rs         previewDamage·previewDamageParts·previewHpLoss (타겟팅 미리보기)
    passives/          특성·패시브 룰 디스패처(when/if/then): compile·conditions·effects·dispatch·ctx
    ai.rs              chooseAction (프로파일 우선 → 그리디 fallback; f64 스코어 TS패리티)
    util.rs            graph.rs  cross-cutting QUERY · 헥스 인접 무방향그래프(hexAdjacent·liveReachable·validateRun)
    session.rs         Session (전투 데모 세션 API — battle_step/observation)
    run/               ★ 런 오케스트레이션 (전투 위 레이어)
      types.rs           RunState·RewardOption·ShopOffer (런 상태)
      data.rs            RunData (데이터맵 1회 로드 번들)
      run.rs             createRun·enterNode·completeFloor·resolveBattleEnd·chooseReward·setActive·moveParty
      jobs.rs            전직(4.7): class_change(트리 간선·차수·패시브 누적)·class_options · choose/skip_class_change(classChange 레이어 해소→advance_core). 상태=PartyMemberState.{job_id,class_tier,job_trait_ids}·RunState.class_change_remaining. 뷰=RunView.classChange
      layers.rs          코어 레이어 시퀀서(데코 즉시·combat/reward/shop/event/classChange 블록)
      helpers.rs         curFloor·healParty·completeNode·upgradeOwned·learnOwned·runInstantLayers(gold/heal/grantStatus/text/partyChange)·build_party_member(create_run·partyChange add 공유)·empty_slot(진형 빈칸)
      rewards.rs         genRewards(+전직 보상 풀 4.7)·unlockedTier·ownsUpgradeLine·reward_gate_ok(숙련도 masteryReq + 전직 classReq 게이트, shop 공유)
      items.rs           equipItem·unequipItem·genItemOffers (장착)
      shop.rs            generateShop·buyShopOffer·leaveShop
      encounter.rs       applyOutcome·chooseEncounterOption
      passives.rs        fireRunTrigger (모험 스코프: nodeEnter/nodeClear/goldGain/partyHpChange)
      view.rs            getRunView (RunState → RunView DTO)
      save.rs            serialize_run/deserialize_run (RunState 전 트리 serde — 세이브/이어하기)
      session.rs         ★ RunSession (풀 게임 세션 API — desktop/이 IPC로 래핑하는 진입점)
    tests/             differential(40벡터)·ai-corpus·full-run(yain 3시드)·rewards·grown-battle·save-roundtrip — 전부 TS 골든과 바이트동일
```
> **결정론 하드룰**(CLAUDE 🦀): 정수전용(f64 금지 — hpPct·AI스코어만 deferred)·`IndexMap`/`Vec`(삽입순서, BTreeMap 금지)·`std::time`/`thread_rng` 금지·모듈 전역 가변상태 금지. **TS 골든 엔진은 `archive/ts-core`+tag `ts-golden-oracle`에 보관** — 골든 재생성·differential은 거기 체크아웃 필요.

## 2. `desktop/` — Tauri2 셸 (IPC = 세션 API)

```
desktop/src/main.rs   #[tauri::command]: 전투 데모(create_session·battle_step·observation)
                  + 풀게임 RunSession 커맨드 — run_create[/roster/def]·view·enter_node·choose_reward·leave_shop·buy·
                    encounter·move·set_active·equip·unequip·battle_step·ai_step·battle_obs·battle_init·battle_view·
                    battle_targeting·sheet_data·save·load → spr_core::RunSession 래핑(상태=Mutex)
```
> **개발 구동**: 터미널1 `npm run dev`(vite, web/) + 터미널2 `cd desktop && cargo build && ./target/debug/spr-app.exe`(debug=dev모드, devUrl=localhost:5173). `desktop/`은 워크스페이스 밖이라 `cargo test`(engine/) 게이트에 영향 0.
> **프로덕션 단일 exe**: `cd web && npm run build`(→web/dist) → `cd ../desktop && ../web/node_modules/.bin/tauri build --no-bundle`(→`target/release/spr-app.exe`, 프론트 임베드, 서버 불필요). ⚠️ `cargo build --release`는 dev모드(localhost)로 빌드됨 — prod는 **`tauri build` CLI만**. `beforeBuildCommand`는 cwd 이슈로 비활성(프론트 선행 빌드).

---

## 3. `web/src/ui/` — 프론트엔드 GUI (Rust를 IPC로 구동)

| 파일 | 책임 | 핵심 export |
|---|---|---|
| `main.ts` | 웹 엔트리(부팅) — `mountRustRun(app, 42)`만. 게임/에디터/허브/전투/일시정지/세이브 전체는 `rustRun`이 구동 | (엔트리) |
| `rustRun.ts` | **풀 게임 컨트롤러** — 전체 프로그램(타이틀·허브·에디터·런·전투·일시정지) 상태기계를 Rust `RunSession`(IPC `run_*`)으로. 전투: 2단계 타겟팅+HP예고(`run_battle_targeting`)+끼어들기 고스트+주사위 연출(`playDice`/`run_battle_init`). 오버레이=`rustOverlay` 위임. 세이브=`run_save`/`run_load`+localStorage(`spr_rust_save_v1`) | `mountRustRun` · `playDice` · `persist` |
| `rustOverlay.ts` | **시트/편성 오버레이** — 맵=파티편성(`renderPartyView`)/전투=캐릭터시트(`renderCharSheet`). 원시데이터=IPC `run_sheet_data`(SheetBundle), 정적보강(base/특성/패시브설명)은 프론트. 변이=`run_equip/unequip/set_active/move` | `createRustOverlay` · `SheetBundle` |
| `render.ts` | **전투 렌더** — 영속 셸(svg·header·battlelayout) 1회 생성 후 존 갱신. `renderAppObs`(관측+스킬바+로그)·`renderBattleZones`(GameState 비의존)·`computeTgtFromObs`(타겟팅, IPC `prev`로 미리보기 주입) | `renderAppObs` · `renderBattleZones` |
| `runRender.ts` | **맵/보상/상점/인카운터/전직(4.7)/결과** 렌더 + 헥스 노드 + 파티 요약. 전직=`classChangeScreen`(파티원·갈래 카드 + 건너뛰기, 인게임 모달 스타일). 맵=고정 뷰포트(`attachCamera` 줌·팬)·벽(`hexgeo` 기하 공유) | `renderRunScreen` |
| `shell.ts` | **게임 흐름 셸** — 타이틀·허브(진입점 메뉴: 캠페인·📖도감·에디터→캠페인 런 목록)·일시정지·오류 오버레이. 런 바깥. `HubMode`=menu/campaign | `renderTitle` · `renderHub` · `renderPause` · `renderError` · `ShellHandlers` · `HubMode` |
| `hub.ts` | **허브 컨트롤러** — 캠페인 런 목록(`mode==="campaign"` 필터)·선택 런 고정 로스터 노출. 캠페인 시작=`run_create_def`(주인공 강제). 자유 편성(toggle/pool)은 비캠페인 모드용 휴면 | `createHub` · `Hub.selectedRunDef` |
| `charDex.ts` | **캐릭터 도감(charDex)** — 우측 캐릭 목록(해금=밝게/미해금=🔒 어두운 프로필), 좌측 스펙카드+특성+전직 트리+스킬 트리(`skillCardBody` 재사용, 본 스킬만 공개·나머지 '?'). 메타만 읽음(순수 표시). CSS 접두사 `.cdx-`(char-deX) | `renderCharDex` · `CharDexHandlers` |
| `meta.ts` | **영구 메타**(레벨/XP + 편성 로스터 + **해금 캐릭(unlocked)·본 스킬(seenSkills)**, 별도 세이브 `spr_meta_v1`) — `grantWin`·`masteryInfo`·`getRoster`/`setRoster`·`unlockChars`·`markSkillsSeen`·`unlockedCharSet`·`seenSkillSet`. (숙련도 게이트=보류, useMastery:false) | `grantWin` · `unlockChars` · `markSkillsSeen` |
| `rustRun.ts` | **풀 게임 셸/디스패치**(IPC) — 타이틀/허브/도감/에디터/런(비전투) + 부팅·키보드. 전투 루프는 `rustBattle`로 위임. 공유 가변상태=`st`(view/cur/busy/logEvents/tgtInfo, 참조 공유) | `mountRustRun` |
| `rustBattle.ts` | **전투 서브컨트롤러**(rustRun 분리) — IPC 전투 루프(주사위 연출·AI 자동·step·타겟팅) + `battleHandlers`. 부모 `st`+콜백(`BattleCtx`)으로 구동 | `createBattleController` · `BattleState`/`BattleCtx` |
| `runProgress.ts` | **런 진행 기록(CDX)** — `playableRunCast`·`recordRunProgress`(파티 스킬 도감 공개+승리 시 출연진 해금). 순수 함수 | `recordRunProgress` |
| `charSheet.ts` | **캐릭터 시트** — 능력치(원본→현재 델타)·3 장착칸·보유 스킬. 전투 모달·파티뷰 상세 공용 | `renderCharSheet` · `sheetBody` · `wireSheet` |
| `partyView.ts` | **파티 편성(모달)** — 진형 보드(드래그 배치) + 캐릭 상세 + 장착 인벤토리 | `renderPartyView` |
| `camera.ts` | **공용 뷰포트 카메라** — 휠 줌·드래그 팬·줌버튼. 에디터/인게임 맵 공유 | `attachCamera` |
| `drag.ts` | **공용 포인터 드래그** — 네이티브 DnD 대체(`.drag-avatar`·`elementFromPoint`·클릭 폴백) | `beginPointerDrag` |
| `hexgeo.ts` | **헥스 기하 SoT(web 공용)** — 꼭짓점·변·방향↔변·픽셀↔축. 인접=변(꼭짓점2) 공유. `hexgeo.test` | (geom) |
| `nodeMeta.ts` | 노드 종류 표시(아이콘/이름) — 런렌더·에디터 공용 | `TYPE_ICON` · `TYPE_NAME` |
| `battle/areaGeo.ts` | 면적 스킬 기하(순수): `computeAreaCells`(앵커+AreaShape→칸) — 타겟팅 풋프린트 표시용 | `computeAreaCells` |
| `battle/shared.ts` | 공용 소도구(esc·ck·avatarHtml) + UI 타입(Ui·Handlers·TgtCtx·SkillBarEntry) | — |
| `battle/unitCard.ts` | 그리드 캐릭터 카드(아바타·쉴드/HP바·상태칩) | `unitCard` |
| `battle/status.ts` | 상태이상 칩 + 펼침 팝오버(거동·스택·출처) | `statusChips` · `describeStatus` |
| `battle/skillDesc.ts` | 스킬 데이터→설명(쿨·명중·피해/사정권·AoE) | `skillCardBody` · `skillInline` |
| `battle/passiveDesc.ts` | 특성/패시브 룰 → 한글 한 줄(when·if→then) | `describeRule` · `describeSkillPassives` |
| `battle/actions.ts` | 행동 패널(스킬 카드 4 / 타겟팅 프롬프트) | `actionPanel` |
| `battle/timelinePanel.ts` | **행동서열 패널** — `rolling`(SPD 주사위→서열) → `dock` FLIP → `live`(타임라인). `.battleleft` 영속 마운트 | `createTimelinePanel` · `RollView` |
| `battle/{events,arrow}.ts` | 이벤트→로그 한 줄 / 캐스터→타겟 화살표 | `formatEvent` · `drawArrow` |
| `editor/` | **런 에디터 GUI**(디자이너 도구) — 헥스 구조 에디터. store(드래프트·F3 repo저장)·ops(노드/변/층 변이)·controller·editView(SVG)·battlefieldEditor(combat 전장)·ruleEditor(트리거 룰)·eventEditor·shopEditor·layerSchema/ruleSchema(스키마 폼). 테스트플레이=`run_create_def` IPC. `validateRun`/`hexAdjacent`(contract) 재사용 | `createEditor` · `renderEditor` |
| `editor/jobEditor.ts` | **전직 트리 에디터**(⑤-a, 개발자 도구) — `jobs.json` 저작 GUI. 3열(트리 목록·차수 컬럼 트리·인스펙터), 노드 CRUD·이름/차수/부여특성/advancesTo 편집. charDex 티어 BFS 재사용. 저장=`POST /api/save-jobs`. 루트↔캐릭 매핑은 읽기전용(`rootJobId`=characters.ts 미이주) | `createJobEditor` |
| `editor/itemEditor.ts` | **아이템 에디터**(⑤-b, 개발자 도구) — `items.json`(`{items,pool}`) 저작 GUI. 2열(슬롯별 목록·인스펙터). 폼 위주: 이름/아이콘/슬롯/dmgFlat/shieldGainAdd/tier/mods(7스탯)/nextTierId/풀 토글, CRUD. 저장=`POST /api/save-items` | `createItemEditor` |
| `editor/skillEditor.ts` · `skillEffectSchema.ts` | **스킬 에디터**(⑤-c, 개발자 도구) — `skills.json` 저작 GUI. 좌: 필터+exclusiveTo 그룹 목록(139). 우: 스칼라(target/cooldown/accuracy/reach/tier/exclusiveTo/nextTierId/alwaysHit/active…)·area(AreaShape)·effects[](SkillEffect 8종, `skillEffectSchema` 스펙)·**passives[]**(rulesEditor). 저장=`POST /api/save-skills`(빈 passives 직렬화 생략) | `createSkillEditor` · `SKILL_EFFECT_SPECS` |
| `editor/ruleFields.ts` · `rulesEditor.ts` | **룰 에디터 공유 인프라.** ruleFields=FieldSpec→입력 컨트롤 프리미티브(ctrl/specForm/fieldVal, ruleEditor·rulesEditor 공유). rulesEditor=**owner 없는 자립 PassiveRule[] 에디터**(스킬 passives·특성 rules 공용, ruleSchema 카탈로그). 전투-레이어 룰(owner 있음)은 `ruleEditor.ts` | `rulesEditorHtml` · `bindRulesEditor` |
| `style.css` | 다크 테마 + **게임셸 리셋**(브라우저 제스처/크롬 제거 — CLAUDE 웹-티 금지 B) | — |
| `index.html` · `vite.config.ts` | Vite 진입/설정. **dev-write 미들웨어**(`POST /api/save-run` → `runs/{id}.json` + 레지스트리 재생성 · `/api/save-jobs`·`/api/save-items`·`/api/save-skills` → 각 `{jobs,items,skills}.json` 통째 기록) | `devWriteRuns`·`devWriteJobs`·`devWriteItems`·`devWriteSkills` |

## 4. `web/src/content/` — 콘텐츠 (디자이너 영역, → JSON export → Rust 로드)

| 파일 | 책임 | 핵심 export |
|---|---|---|
| `statuses.ts` | 상태이상 정의(거동 데이터) | `STATUS_DEFS` |
| `skills.ts` | 스킬(위치마스크·쿨·명중·효과) | `SKILLS` |
| `characters.ts` | 캐릭터(고유 스탯 + learnset + `traitIds` + `rootJobId`) | `CHARACTERS` |
| `jobs.ts` | **전직 직업 트리**(4.7) — 캐릭 전속. 전직=패시브 부여+차수 스킬해금. 분기 차이=패시브뿐 | `JOBS` |
| `traits.ts` | 특성(상시 패시브 룰 묶음) — 캐릭터가 traitIds 참조(전직 패시브 포함) | `TRAITS` |
| `ai.ts` | AI 행동결정 정책(우선순위 룰) — 캐릭터가 aiProfileId 참조 | `AI_PROFILES` |
| `items.ts` | 장착 아이템(무기 dmgFlat·crit / 방어구 hp·쉴드) | `ITEMS` · `ITEM_POOL` |
| `encounters.ts` | 전투 배치 + 노드 타입별 적 구성(`NODE_ROSTERS`) | `DEMO_ENCOUNTER` · `NODE_ROSTERS` |
| `events.ts` | 인카운터 이벤트(제목·텍스트·선택지·결과) | `ENCOUNTER_EVENTS` |
| `formations.ts` | 포메이션 열보너스 배치(총량보존) | `STANDARD_FORMATION` |
| `runs/*.json` | **저작 런** — 헥스 그래프 맵·층. 진실=레포 JSON(에디터 편집·F3 repo기록). `RunDef` | (JSON) |
| `runs/index.ts` | 런 레지스트리 파사드 — `RUNS` + `DEFAULT_RUN` + `rosterFromIds` | `RUNS` · `DEFAULT_RUN` |
| `data.generated.json` | **데이터 JSON 번들(파생)** — `npm run data:export`가 TS data를 canonical JSON으로 방출 → Rust serde 로드. 직접 편집 금지 | (JSON) |

## 5. `web/src/contract/` — 프론트↔엔진 계약 (타입 + 순수 유틸, 엔진 아님)

```
web/src/contract/         옛 src/core, TS 엔진 은퇴로 개명. 프론트·데이터·Rust(export)가 공유.
  types.ts            ▸배럴: export type * from types/{content,passives,ai,map,runtime}
  types/
    content.ts          디자이너 스키마: Side·Pos·StatusDef·SkillEffect·AreaShape·Skill·FormationLayout·Character
    passives.ts         패시브 룰 스키마: PassiveRule·Trigger·Condition·Effect·TraitDef
    ai.ts               AI 정책 스키마: AiProfile·AiRule·AiCondition
    map.ts              맵 스키마: RunDef·FloorDef·MapNode·MapEdge·NodeLayers·Layer·NodeRule
    runtime.ts          런타임/IPC DTO: Unit·GameState·GameEvent·Action·Observation·UnitView 등
  rng.ts              시드 PRNG 타입(RunState.rng 참조용) — 런타임 무작위는 Rust
  run.ts              ▸배럴(파사드): export * from run/index
  run/
    graph.ts            헥스 그래프 순수 유틸: hexAdjacent·neighborIds·liveReachable·validateRun. **에디터·런화면이 소비**
    types.ts            런 DTO 타입: RunPhase·RewardOption·ShopOffer·RunState·RunView
    index.ts            ▸배럴(graph + 타입만)
```

## 6. `web/scripts/` — 빌드·검증 도구 (Node, 런타임 아님)

| 파일 | 역할 |
|---|---|
| `check.ts` | **통합 게이트**(`npm run check`, pre-commit 훅) — typecheck + web test(`node --test`) + engine `cargo test`(`../engine`) + 줄수캡·계약순수성·배럴·웹-티 가드·**스키마 드리프트**·문서동기 |
| `export-data.ts` + `canonical.ts` | 콘텐츠 빌드 — `web/src/content/*` → canonical JSON(`data.generated.json`) → 엔진 로드. `npm run data:export` |
| `schema-drift.ts` | **스키마 드리프트 가드** — `data.generated.json` 콘텐츠 필드가 대응 Rust `spr-types` 구조체에 선언됐는지 검사(serde 무시 방지). 규약=Rust가 저작 콘텐츠 필드 전체 선언. 상세 DATA-SERIALIZATION-CONTRACT §7.5 |

---

## 기능 → 위치 색인 (게임 로직 = `engine/spr-core`)

| 게임 기능 (GAME-DESIGN 참조) | 위치 (`spr-core/src/…`) |
|---|---|
| 라운드/SPD 주사위 서열·정규 턴 시작종료 (2.2) | `battle.rs`: `start_round`/`advance`/`on_normal_turn` · 주사위 분해 노출 `roundStart` 이벤트 `rolls` → 웹 `timelinePanel.ts` |
| 합법 행동 열거·사정권/쿨/빙결 (8.2/2.10) | `targeting.rs`: `getLegalActions`/`validTargets` · `util.rs`: `is_frozen` |
| 명중 판정 (2.7) | `targeting.rs`: `computeHitChance` · `skills.rs`: `resolveSkill` |
| 데미지·치명타·곱연산·쉴드→HP·공포·관통·불사 (3.x) | `damage.rs`: `computeDamage`/`dealRawDamage` |
| HP손실/데미지 미리보기(타겟팅) | `preview.rs`: `previewHpLoss`/`previewDamage` (웹 표시=IPC `battle_targeting`) |
| 상태이상 부여/틱(DoT+HoT) (3.1/3.5) | `status.rs`: `applyStatusInstance`/`tickPeriodic` |
| 스킬 효과 디스패치(뎀/상태/쉴드/힐/이동/끼어들기) (3.9) | `skills.rs`: `applyTargetEffects`/`applySelfEffects` |
| 특성/패시브 룰(when/if/then) | 전투 `passives/`(dispatch·conditions·effects) · 모험 `run/passives.rs`: `fireRunTrigger` · 컴파일 `passives/compile.rs` |
| 모험 버프 계승 | `Effect::GrantRunStatus` → `RunState.pending_statuses` → 다음 `enter_node` 전투 생성 시 `battle.rs` 주입 |
| 동적 재배치 (6.4) | `skills.rs`: `moveUnit` |
| 끼어들기 예측·앵커해소·삽입 (2.11) | `interrupt.rs`: `predictInterruptSubjects`/`insertInterrupts` · `skills.rs`: `resolveAnchorUid` |
| 포메이션 열보너스·총량보존 (6.1/6.3) | `formation.rs`: `getFormationBonus` |
| 면적(AoE) 모양→칸/유닛 | `targeting.rs`: `computeAreaCells`/`areaTargets` (웹 표시 기하 = `web/battle/areaGeo.ts`) |
| 근접 동적 도달(reach, 2.4) | `targeting.rs`: `reachableColumns` → `validTargets` 필터 |
| 행동 1회 처리(턴 진행) · 승패 | `flow.rs`: `step` · `battle.rs`: `check_win` |
| 관측 빌드(JSON) (8.2) | `observation.rs`: `buildObservation` |
| 전투 생성(성장·장착·노드룰) | `battle.rs`: `createBattle`/`create_battle_grown`/`make_unit_grown`/`equip_bonus` |
| 헥스 맵·도달성·검증 (7.1) | `util.rs`/`graph.rs`: `hexAdjacent`·`liveReachable`·`validateRun` (웹 에디터=`contract/run/graph.ts` 미러) |
| 노드 진입·해소·전투생성·승패 (7장) | `run/run.rs`: `enterNode`/`resolveBattleEnd` · `run/layers.rs`(레이어 시퀀서) |
| 다층(층 그래프) 진행 (7.3) | `run/run.rs`: `completeFloor`(toFloor 분기·회복·won) |
| 보상 3택1 생성·적용 (4.5) | `run/rewards.rs`: `genRewards`·`unlockedTier` · `run/run.rs`: `chooseReward` |
| 육성: 보유풀/활성선택/강화티어 (4.2/4.6) | `PartyMemberState`(party.rs) · `run/run.rs`: `setActiveSkill`·`chooseReward` · `battle.rs` makeUnit 활성4 |
| 장착 아이템 (4.3) | `run/items.rs`: equip/오퍼 · `battle.rs` 스탯합산 · 웹=`charSheet.ts` |
| 아군 진형 편성 (6장) | `run/run.rs`: `movePartyMember` · `formation.rs` 분배 · 웹=`partyView.ts` |
| 상점·인카운터 + 골드 (7.2) | `run/shop.rs`·`run/encounter.rs` · `RunState.gold` · 웹: runRender |
| 적 구성(노드별, 데이터) | `data/encounters.ts NODE_ROSTERS` + `MapNode.roster` override → `run/run.rs` |
| 결정론 AI(프로파일 + 그리디) | `ai.rs`: `chooseAction` · `data/ai.ts AI_PROFILES` + `Character.aiProfileId` |
| 세이브/이어하기 영속화 | `run/save.rs`: `serialize_run`/`deserialize_run` · `run/session.rs`: `save_json`/`load_json` · 웹 `rustRun.ts` localStorage(`spr_rust_save_v1`) |
| 영구 메타(숙련도) | 웹 `meta.ts`(`spr_meta_v1`, 런 세이브와 분리) — 전투 승리 XP → tier 해금 |

## 미구현 → 들어갈 자리 (☐, ROADMAP)

| 기능 | 예정 위치 |
|---|---|
| 런 에디터 F-시리즈 — 완료(`web/src/ui/editor/`). 후속: 웨이브·노드 보상 override 등 | 필요 시 신규 슬라이스 |
| 메타/본산 영구성장 (5장, ROADMAP #1) | 신규 `spr-core/src/meta/` (런 위 레이어) + 웹 본산 화면. 메타 재화·해금 스키마 |
| 연출/스토리텔링 엔진 (ROADMAP #2) | `spr-core` 시퀀스 프리미티브 + 웹 연출 레이어(`web/battle/*`·`runRender`) |
| 지닌물건(held 슬롯) (ROADMAP #3) | 기존 패시브 엔진으로 표현 가능성 먼저 판정(`/slice-plan`) |
| 아이템/스킬/패시브 에디터 (ROADMAP #4) | `web/src/ui/editor/` (콘텐츠 저작 형식 JSON 이주 선결) |
