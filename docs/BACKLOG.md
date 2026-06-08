# BACKLOG — 실행 슬라이스 백로그 (자동 루프 SoT)

> **이 문서 = 자동 슬라이스 루프가 따라가는 순서표.** 위→아래로 **각 슬라이스마다 `/slice-plan`(진입·분류) → 구현 → `/slice-wrap`(게이트+문서+커밋)** 을 반복한다. 의존 순서 고정. 🛑 **끝점**에 도달하면 멈추고 사용자 검토를 기다린다(그 아래는 검토 후 별도 결정).
>
> **결정 전제 (2026-06, 사용자 확정)**: ① 범위 = **런1 수직슬라이스**(유년·성장 ep1~8 완전 플레이) ② 접근 = **데이터-온리 근사 v1**(새 엔진 프리미티브 금지 — 근사로 표현) ③ 순서 = **콘텐츠 교체 먼저**.
> **설계 입력**: [`Yainsidae/gamedata/run01-youth.md`](Yainsidae/gamedata/run01-youth.md) (이 백로그의 모든 수치·캐릭·노드 출처). 엔진 경계·노드/스킬/전직 스키마 = [`game-design/`](game-design/)·[`CODE-MAP.md`](CODE-MAP.md).

## 🔒 전역 규칙 (루프가 매 슬라이스 지킴)
- **모두 `[데이터-온리]`** — `web/src/content/*`만 수정. 엔진(`engine/spr-core`)·스키마(`types/*`·`spr-types`) **변경 금지**. 콘텐츠 필드를 정말 추가해야 하면 그건 프리미티브 갭 → **STOP·보고**(이 백로그 밖).
- 기존 콘텐츠(yain 런·kim/shin/… placeholder)는 **건드리지 않는다**(런1은 가산). 기존 골든 불변.
- 각 슬라이스 종료 = `npm run check` green + `npm run data:export`(콘텐츠 변경 시) + 한 줄 커밋. 푸시는 사용자 지시 시만.
- 근사·이연 갭은 아래 § 근사 규약을 따른다(엔진 프리미티브를 만들지 말 것).

## § 근사 규약 (데이터-온리로 표현 — 엔진 변경 회피)
| 원작/설계 의도 | v1 데이터-온리 근사 | 이연된 프리미티브 갭(나중) |
|---|---|---|
| `blind`(명중률 직접 감소) | **`weaken`로 대체** | blind 상태이상 |
| 동료 **런 중 합류**(개코·정진영 2층 가입) | ~~로스터 사전포함~~ → **E2 `partyChange` 레이어로 정식 구현**(근사 폐기, 사용자 승인) | (해소됨) |
| 캠페인 = 주인공 단신 강제(허브 자유편성 금지) | ~~없음~~ → **E1 캠페인 모드 + RunDef.mode로 정식 구현**(사용자 승인) | (해소됨) |
| 회중시계 키아이템(분실 페널티) | `item` + `grantStatus` 데코 / event 선택지 플래그 | (없음 — 근사로 충분) |
| 잠입/스텔스(전투 회피) | **event 선택지 + 조건부 combat 스킵** | (없음 — stealth 노드 불요) |
| 영구 스탯 훈련 노드 | `grantStatus` 데코(장기 지속 버프) | 런 영속 스탯 상승 |
| 나석주 의거(목격 비전투) | `text`/`event` 노드(전투 미사용) | (없음) |
| 불굴 `indomitable`(1회 재기) | **`undying` 상태 + 패시브**(when:death→heal, trait 1회 조건) | (근사 충분) |
| 민심·summon | **런1 미사용**(해당 없음) | (런2~서 등장 — 그때 판정) |

---

## 진행 현황 (자동 루프, 2026-06)
- ✅ **S1~S9 완료**(데이터-온리, 커밋 `c7ebeca`·`537baa8`·`7ca3f2d`): 상태이상 점검 · 스킬19 · 특성2 · 전직 트리 · 캐릭9 · AI4 · 런 맵(3층 13노드) · 엔진 부팅·완주 회귀 테스트(`run1_youth_boots_and_completes`, 시드1·42 패닉 없이 종료). `npm run check` green.
- ⏳ **E1~E3 (엔진+웹, 사용자 승인 2026-06)** — 런1 충실도(캠페인 단신 강제 + 런 중 파티 변동). 데이터-온리 한정 **해제**(이 슬라이스들은 엔진 변경 허용). 아래 § E.
- ⏳ **S10 = 끝점**: E3 후 웹 **실플레이**(헤드리스 불가 → 사람 검토). 자동 루프는 여기서 정지.

## E. 캠페인 모드 + 파티 변동 (엔진 — 런1 충실도, 사용자 승인)
> 결정: ① **허브 = 진입점 메뉴**(런 목록·로스터는 **캠페인 모드 입장 후** 노출) ② **`RunDef.mode` 필드**(에디터에서 캠페인/기타 플래그, 모드별 런 필터) ③ **`partyChange` 레이어**(노드에 합류/이탈 심음).

### E1a ✅ — RunDef.mode 필드 `[엔진 프리미티브 추가]` (커밋 64ec6e8)
- **무엇**: `RunDef.mode: "campaign" | …`(향후 기본/종결). TS `types/map.ts` + Rust `spr-types/map.rs`(serde, #[serde(default)]). yain·run1 = `"campaign"`. 에디터 런 메타에 mode 셀렉트.
- **수용**: 드리프트 가드·typecheck·cargo 통과. 모드별 런 필터 근거 확보. *(동시에 김두한 아바타 골든 RED 복구.)*

### E1b ✅ — 허브 재구성(진입점 → 캠페인 런 선택) `[웹 기능]` (커밋 36a92ba)
- **무엇**: `hub.ts`/`shell.ts`/`rustRun.ts` — 허브 = **진입점 메뉴**(📜 캠페인 · 🗺 에디터 · (일반/챌린지 회색)). 캠페인 진입 → `mode==="campaign"` 런 목록 → 선택 시 **그 런의 고정 로스터로 시작**(자유 편성 picker 제거, `run_create_def`로 런 자체 roster 사용). 게임-티 금지 준수.
- **수용**: 허브에 캠페인 외 진입점 정리, 캠페인 들어가야 런목록 노출, 런 선택=주인공 강제 시작. ✅

### E2 ✅ — partyChange 레이어 `[엔진 프리미티브 추가]` (커밋 31921fd)
- **무엇**: `Layer::PartyChange { add?: charId[], remove?: charId[] }`(데코=즉시). `RunState.party` 동적 변경 — add=새 `PartyMemberState` 생성(skillIds·rootJob·mastery0·빈 진형 슬롯 배치), remove=charId 제외. 세이브 왕복. `create_run`의 멤버 생성 로직을 `build_party_member` 헬퍼로 추출·재사용. 에디터 `layerSchema`에 등록(csv 필드). 결정론 테스트(합류·이탈·세이브).
- **수용**: 노드에서 파티 증감 동작, 진형 충돌 없음, 세이브 왕복 보존, cargo 테스트 green. ✅

### E3 ✅ — run1 재배선(단신→합류) `[데이터-온리]` (커밋 90eda36)
- **무엇**: run1 `roster = [kim_young]`(단신) + `mode:"campaign"`. `f2_join`에 `partyChange add:[gaekko, jin]`. (유태권 한시 동료는 선택 — v1 생략.) 부팅 테스트가 동적 파티로 완주 확인.
- **수용**: 런1이 소년두한 단신 시작 → 2층서 개코·정진영 합류로 플레이. `run1_youth_boots_and_completes` green(단신 시작·캠페인 모드·합류 발화 검증). ✅

## 📋 슬라이스 순서 (런1 수직슬라이스)

### S1 — 상태이상 점검
- **무엇**: 런1이 쓰는 상태이상(bleed·might·edge·weaken·paralyze·taunt·regen·undying)이 `statuses.ts`에 다 있는지 확인. `blind`는 `weaken`로 근사(추가 X). 누락분만 데이터 추가.
- **파일**: `web/src/content/statuses.ts` · **의존**: 없음 · **수용**: 필요한 상태 전부 존재, `data:export`·드리프트 가드 통과. (대개 무변경 검증 슬라이스.)

### S2 — 런1 적·NPC 캐릭터
- **무엇**: `wangcho`(보스, HP50~56·돌던지기/나뭇가지/군림)·`beggar_thug`(HP14~18)·`miwa`(commander·고문/추격)·`detective`(HP24~30·수갑/곤봉)·`kaneyama`(coward·하인호출/탐욕)·`jp_student`(HP16·집단구타, 4인)·(`thug` 재사용). `playable` 미설정, `aiProfileId` 지정. 수치=gamedata.
- **파일**: `characters.ts` · **의존**: S1 · **수용**: 참조 무결성(스킬·ai), `data:export`.

### S3 — 런1 플레이어 캐릭터
- **무엇**: `kim_young`(소년두한, HP40~46·crit25/×1.6·`rootJobId`·traitIds[indomitable])·`gaekko`(HP22·evasion13·후열 교란)·`jin`(HP28·중열 보조딜). `playable:true`.
- **파일**: `characters.ts` · **의존**: S4·S5·S6(참조). 실제 작성은 S4~S6 직후 배선 — **순서상 S6 뒤에 배치 가능**(아래 주). · **수용**: hub 선택 풀 노출, 참조 OK.

### S4 — 런1 스킬
- **무엇**: `young_punch`(+강화 `young_punch2`)·`young_kick`(crit시 might 패시브)·`young_dash_kick`(move+damage, classReq1)·`young_dantian`(궁극, edge 선행+damage20, classReq1)·`gaekko_dung`(damage+weaken)·`gaekko_taryeong`(self taunt)·`jin_stab`(acc95)·`jin_aid`(heal+regen)·`wangcho_stone/branch/rule`·`jp_gang_beat`(인접수↑ self might 패시브)·`miwa_torture`(damage+paralyze)·`miwa_pursuit`(area weaken). 전부 effect: damage/applyStatus/shield/heal/move + when/if/then.
- **파일**: `skills.ts` · **의존**: S1 · **수용**: 모든 스킬 effect/passive 타입 OK, 강화 체인·classReq 필드 정상, `data:export`.

### S5 — 런1 특성·패시브
- **무엇**: `indomitable`(undying 기반 1회 재기 — when:death if:1회 then:heal/undying)·`qi_focus`(전직 패시브, when:turnStart→edge 축적). `growth`/`jp_gang_beat`은 노드 보상·스킬 패시브로(trait 아님).
- **파일**: `traits.ts` · **의존**: S1 · **수용**: 룰 when/if/then 파싱 OK, jobs/캐릭이 참조.

### S6 — 런1 전직 트리
- **무엇**: `kim_young` 직업 트리 — 0차(소년두한)→1차(무도가, n9 classChange). 1차 `grantsTraitIds:[qi_focus]`, `classReq`로 `young_dash_kick`·`young_dantian` 보상 해금.
- **파일**: `jobs.ts` · **의존**: S4·S5 · **수용**: jobs 참조 OK, classChange 노드(S8)와 차수 일치.

### S7 — 런1 AI 프로파일
- **무엇**: 적 AI 프로파일 중 없는 것 추가(`commander`·`coward`·`swarm` 등; `guardian`·`skirmisher`는 기존). 데이터-온리(우선순위 룰).
- **파일**: `ai.ts` · **의존**: S2 · **수용**: 모든 적 `aiProfileId` 해소, 결정론(rng 미사용).

### S8 — 런1 맵 (run1-youth.json)
- **무엇**: 3층 노드 시퀀스(gamedata 맵 구성 그대로). 근사 규약 적용: 잠입=event 선택지+조건부 combat, 시계=item/grantStatus·플래그, 훈련=grantStatus(장기), 동료=로스터 사전포함, 나석주=text/event, n9=classChange 노드. roster=소년두한(+개코·정진영 사전포함).
- **파일**: `web/src/content/runs/run1-youth.json` + `runs/runs.generated.ts`(import 추가) · **의존**: S2~S7 · **수용**: `validateRun` 통과, 헥스 인접·도달성 OK.

### S9 — 데이터 익스포트 + 엔진 로드 검증
- **무엇**: `npm run data:export` → `npm run check`(드리프트·cargo). 런1을 엔진이 로드·자동전투로 완주하는지 확인(필요 시 `full_run`류 수동 점검 또는 임시 자동플레이).
- **파일**: (생성물) `data.generated.json` · **의존**: S8 · **수용**: `npm run check` green, 런1 부팅·완주 무오류.

### S10 — 웹: 런1 선택·실플레이  🛑 **끝점**
- **무엇**: hub 런 목록에 run1 노출(RUNS 등록 확인), 단신/파티 시작·3층 완주를 `npm run dev` **실플레이**로 검증(전투·전직 화면·이벤트·보스 렌더, 게임-티 금지 준수). generic 뷰로 커버되면 프론트 추가 최소.
- **파일**: 필요 시 `web/src/ui/hub.ts` 등 · **의존**: S9 · **수용**: 런1 처음~끝 플레이 가능. **→ 여기서 STOP. 사용자 검토 요청.**

---

## 🛑 끝점 이후 (검토 후 별도 결정 — 루프는 여기서 진행하지 않음)
- 런1 플레이 피드백 → 밸런스·연출 보강.
- 런2~8 콘텐츠(같은 패턴: gamedata/runNN → 캐릭/스킬/맵). 런2부터 **민심·summon 근사 또는 프리미티브 갭 판정** 필요.
- ROADMAP 엔진 기능 #2(숙련도→스킬풀)·#3(종결모드)·#4(연출)·#5(에디터).
- 이연된 프리미티브 갭(blind·런중 합류·런 영속 스탯·민심 게이지·summon) 도입 여부 일괄 재검토.
