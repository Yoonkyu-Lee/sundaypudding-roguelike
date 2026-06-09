# BACKLOG — 런2~8 에픽 (풀 충실 노선)

> **결정(2026-06, 사용자 확정)**: run2~8을 **풀 충실**로 — 데이터-온리 근사가 아니라 **엔진 프리미티브를 추가**한 뒤 제작. 승인된 프리미티브 2종: ① **런 자원 게이지(민심류)** ② **summon(전투 중 임시 아군)**.
> 출처 = [`Yainsidae/gamedata/run02~08`](Yainsidae/gamedata/). 각 런의 프리미티브 갭은 gamedata 말미에 정리돼 있음.

## 🔧 엔진 프리미티브 (런 제작 전 선행)

### R1 ✅ — 런 자원 게이지 (민심·명예·토사구팽…) `[엔진 프리미티브 추가]`
> 완료: 스키마(Rust spr-types + TS contract)·엔진(modify_resource·resourceMods·requires 게이팅)·뷰 노출·에디터 resource 레이어·프론트 게이지+선택지 비활성·결정론 테스트(`resource_gauge_modify_clamp_save_and_view`). yain 골든 무변(자원 비면 생략). check green.
**무엇**: 전투 밖에 존재하는 **런-영속 명명 자원** + 노드/전투/이벤트 훅. run2 민심·run3 명예·run7 토사구팽·run8에 재사용.
- **스키마**(`spr-types`): `RunDef.resources: ResourceDef[]`(`{id,name,min,max,initial,icon?}`). `Layer::Resource{id,delta}`(데코=즉시). `EncounterOutcome::Resource{id,delta}`. `EncounterChoice.requires?: {resourceId,cmp,value}`(게이팅). `Layer::Combat`에 `resourceMods?: ResourceMod[]`(`{resourceId,cmp,value,side,statusId,stacks,duration}`).
- **상태**(`RunState.resources: IndexMap<String,i64>`): create_run서 def.resources로 초기화. `modify_resource`(클램프+이벤트로그+트리거).
- **해소**: run_instant_layers=Resource 레이어 / encounter=resource outcome + requires 게이팅 / start_combat=resourceMods 충족 시 side에 pending status 주입(민심高→아군 버프, 심리전→적 fear).
- **노출**: RunView.resources(게이지). 프론트=골드 옆 자원 칩/바 + 미충족 선택지 비활성.
- **검증**: drift 가드(TS↔Rust) + 결정론(변경·클램프·세이브왕복·전투 모디파이어·게이팅) + data:export.

### R2 ✅ — summon (전투 중 임시 아군) `[엔진 프리미티브 추가]`
> 완료: `SkillEffect::summon` + `Unit.summoned/expiresRound` + `GameState.summon_templates`(전투 생성 시 아군 스킬 스캔 사전빌드) + `summon_units`(빈 슬롯·만료) + 라운드 시작 만료 제거. 다음 라운드 서열 자동 합류. 결정론 테스트(`summon_creates_temp_ally_joins_next_round_then_expires`). 골든 무변(미사용 필드 직렬화 생략). TS contract(SkillEffect·GameEvent)·drift·check green.
**무엇**: `SkillEffect::Summon{charId,count?,duration?}` — 전투 중 빈 슬롯에 임시 유닛 생성(N턴/전투 한정). run2 개코 거지패·세력 증원.
- **스키마**: `SkillEffect`에 summon 추가(`spr-types/skills`). 임시 유닛 표식(`Unit.summoned`/`expiresAtTurn`).
- **전투 모듈**(`spr-core/battle`): 유닛 삽입(턴순서 재계산)·AI 구동·만료/전투종료 제거. 관측(`buildObservation`)에 소환 유닛 포함.
- **검증**: 결정론(소환·만료·턴순서·세이브) + differential 회귀 골든.

## 🎬 런 콘텐츠 (R1·R2 후, run1 패턴 = 캐릭→스킬→트레잇→잡→AI→맵→export→boot)

- **R-run2** ✅ — 종로 입성·주먹 패권(9~29화). 민심 게이지·summon(개코 거지패)·환영부활(트레잇)·구마적 결전(민심 resourceMods)·왕발 심리전(민심 gte 70→적 paralyze)·짝코 무혈복속(requires 게이팅). 단신→6인 파티, 3층 18노드. 캐스트/스킬/특성/전직=커밋 7d1fc78, 맵+boot=이 커밋. `run2_jongno_boots_and_completes` green.
- **R-run3** ✅ — 일제말 항일. 명예·의지 자원·1대다 각성·고문 의지전. (커밋 05584c0)
- **R-run4** ✅ — 해방·좌우 대결. 전향·다이너마이트·비극 이탈. (9e29421)
- **R-run5** ✅ — 사형·전쟁기. 부활·권총 양식충돌·동대문 상견례. (02cd254)
- **R-run6** ✅ — 동대문 패권·정치. 무력화(blind=weaken·투옥=freeze)·이정재 디버프전. (ca86383)
- **R-run7** ✅ — 자유당 폭정·몰락. 토사구팽 게이지(양날)·머릿수 동원(summon). (ee9ba0b)
- **R-run8** ✅ — 4.19·최후. 4층 비극형·정당성·고문 버티기·똥통 투척. (c7da985)

> **에픽 완료(2026-06)**: R1·R2 프리미티브 + run2~8 콘텐츠 전부. 모든 캠페인 런 `campaign_runs_boot_and_complete` green. 스킬 139·캐릭터 다수. 새 프리미티브 갭(spare·즉사·phase·survival승리·morale·후계계승)은 전부 데이터-온리 근사로 우회(사용자 "이대로" 방침).

각 런 종료 = `npm run check` green + boot 테스트(`runN_boots_and_completes`) + 커밋. 새 메커니즘엔 결정론 단위 테스트.

## 🛑 진행 메모
- R1 → R2 → run2 → … 순. 프리미티브는 결정론·differential 안전망 필수(엔진 하드룰: 정수전용·IndexMap·RNG계약).
- 커밋마다 `[엔진 프리미티브 추가]`/`[데이터-온리]` 분류 명시.
