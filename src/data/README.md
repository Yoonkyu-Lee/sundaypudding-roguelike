# 디자이너 가이드 — `src/data/`

이 폴더가 **콘텐츠**다. 엔진(`rust/spr-core`)은 여기 적힌 값을 **해석만** 한다(`npm run data:export` → JSON → Rust 로드).
핵심 원칙: **메커니즘 = 엔진, 값 = 데이터.** 아래 "할 수 있는 것"에 해당하면 **이 폴더 파일만 고치면** 된다(엔진 코드 안 건드림).

> 작성 스키마(타입)의 진실은 [`src/contract/types/content.ts`](../contract/types/content.ts) — 각 필드의 정확한 의미가 주석으로 달려 있다. 규칙·수치 맥락은 [`docs/GAME-DESIGN.md`](../../docs/GAME-DESIGN.md).

## 📑 목차

**시작하기**
- [파일별 무엇을 만드나](#파일별-무엇을-만드나)
- [✅ 디자이너가 혼자 할 수 있는 것 (데이터-온리)](#-디자이너가-혼자-할-수-있는-것-데이터-온리)
  - [현재 프리미티브 카탈로그](#현재-프리미티브-카탈로그-엔진이-이미-해석--이걸-조합한다)
- [🔧 디자이너 혼자 못 하는 것 (엔진 요청)](#-디자이너-혼자-못-하는-것-엔진-개발-필요--엔지니어에게-요청)
  - [요청하는 법 (프리미티브 갭)](#요청하는-법-프리미티브-갭)

**📖 사전 — 필드·타입 레퍼런스** ([절 머리](#-사전--필드타입-레퍼런스))
- [캐릭터 `characters.ts`](#캐릭터-charactersts--character)
- [스킬 `skills.ts`](#스킬-skillsts--skill)
- [스킬 효과 `SkillEffect`](#스킬-효과--원자-단위-skilleffects--skilleffect)
- [면적 모양 `AreaShape`](#면적-모양-skillarea--areashape)
- [상태이상 `statuses.ts`](#상태이상-statusests--statusdef)
- [장착 아이템 `items.ts`](#장착-아이템-itemsts--itemdef)
- [포메이션 `formations.ts`](#포메이션-formationsts--formationlayout)
- [런 / 맵 `runs/*.json`](#런--맵-runsjson--rundef)
- [AI 프로파일 `ai.ts`](#ai-프로파일-aits--aiprofile)

**🎛 효과 설계 — 액티브 · 패시브 · 특성** ([절 머리](#-효과-설계--액티브--패시브--특성))
- [스코프: 전투 vs 모험 전체](#-스코프-하나의-전투-vs-모험-전체-반드시-구분)
- [Trigger 카탈로그 (`when`)](#trigger-카탈로그-when)
- [Condition 카탈로그 (`if`)](#condition-카탈로그-if--and-결합)
- [Effect 카탈로그 (`then`)](#effect-카탈로그-then)

- [작업 흐름](#작업-흐름)

## 파일별 무엇을 만드나

| 파일 | 콘텐츠 |
|---|---|
| `characters.ts` | 캐릭터 — 스탯(HP/속도/회피/명중/치명)·`skillIds`(learnset)·`avatar`·`playable` |
| `skills.ts` | 스킬 — 타겟·쿨타임·명중·사정권·면적·**능동 효과(`effects[]`)** + **패시브(`passives[]`)**·`active` 태그·강화 티어 체인 |
| `traits.ts` | **특성** — 캐릭터를 정의하는 상시 패시브 룰 묶음(`TraitDef`). 캐릭터가 `traitIds`로 참조 |
| `ai.ts` | **AI 프로파일** — 적/자동플레이의 행동결정 정책(우선순위 룰, `AiProfile`). 캐릭터가 `aiProfileId`로 참조 |
| `statuses.ts` | 상태이상 — 표준 거동 필드 조합(지속피해/회복·행동봉쇄·배율 등) |
| `items.ts` | 장착 아이템 — 능력치 보정·무기 데미지·방어구 쉴드 |
| `formations.ts` | 포메이션 — 열별 보너스 총량(공격/방어) |
| `runs/*.json` | **런/맵**(`RunDef`) — 시작 파티 + 층(floor) 그래프(노드 + 방향 간선). 런 에디터 GUI로 저작(곧) |
| `encounters.ts` | 노드별 적 배치(전투 구성) |
| `events.ts` | 인카운터 이벤트(선택지·결과) |

## ✅ 디자이너가 혼자 할 수 있는 것 (데이터-온리)

- **캐릭터 추가/수정**: `characters.ts`에 엔트리 추가. `playable: true`를 붙이면 **본거지 편성 화면에 자동 등장** → 바로 골라서 테스트/밸런싱.
- **스킬 제작**: 아래 **프리미티브 카탈로그**의 효과·필드를 **조합**해서. 데미지+상태이상+이동+쉴드 등 조합 자유. 강화 티어는 `nextTierId` 체인으로.
- **상태이상 제작**: `StatusDef`의 거동 필드를 켜서(지속피해·재생·행동봉쇄·데미지 배율/가산·쉴드 잠식·관통·불사·도발·SPD 감소 등).
- **아이템·포메이션·맵·모드·적 배치·인카운터**: 각 스키마대로 값만.
- **밸런싱**: 모든 수치(데미지·HP·명중·쿨타임·가중치·보상 등)는 데이터라 자유 조정.
- **learnset / 강화 트리 / 전용기·범용기 구분**: `skillIds`·`nextTierId`·`exclusiveTo`로.
- **적 AI 성향 제작**: `ai.ts`에 `AiProfile`(우선순위 룰) 추가 → 캐릭터에 `aiProfileId` 지정. 힐러/암살자/탱커 등 패턴을 코드 없이.

### 현재 프리미티브 카탈로그 (엔진이 이미 해석 — 이걸 조합한다)

- **SkillEffect**(`skills.ts effects[]`): `damage` · `applyStatus` · `applyStatusSelf` · `shield` · `heal` · `cleanse` · `move`(밀치기/돌진)
- **AreaShape**(`area`): `single` · `row` · `col` · `square`(radius) · `cross`(radius) · `all` · `free`(N칸 자유선택)
- **Skill 필드**: `cooldown` · `accuracy` · `alwaysHit` · `usableFrom`(시전 칸) · `targetCells`(타겟 칸) · `reach`(근접 사정권) · `grantsInterrupt`/`grantsInterruptTo`(끼어들기 부여) · `tier`/`nextTierId` · `exclusiveTo`
- **StatusDef 거동**: `dot`(지속피해) · `hot`(재생) · `actionDenial`(행동봉쇄) · `damageDealtMult` · `dmgDealtFlat` · `critChanceAdd`/`critMultiplierAdd` · `shieldShred`(쉴드 잠식) · `pierce`(쉴드 무시) · `undying`(불사) · `invincible`(무적) · `taunt`(도발) · `speedMod`(SPD 보정, +상승/−하락) · `grantsInterrupt`
- **ItemDef**: 능력치 `mods`(hp/회피/명중/치명/속도) · `dmgFlat`(무기) · `shieldGainAdd`(방어구)
- **맵/런**: `RunDef`(entryFloorId + 층 그래프) · `FloorDef`(nodes + 무방향 edges) · `MapNode`(type·q·r 헥스·toFloor?·roster?·label?) · `MapEdge`(맞닿은 헥스끼리만) · `clear` 노드=목표 · 재방문 불가 이동
- **AiProfile**(`ai.ts`): `rules[]` 우선순위 룰 — `if`(조건) · `prefer`(스킬 종류) · `target`(타겟 선호) · `weight`(보조 가중치). 캐릭터 `aiProfileId`로 연결

## 🔧 디자이너 혼자 못 하는 것 (엔진 개발 필요 → 엔지니어에게 요청)

기존 프리미티브 **조합으로 표현이 안 되면** 새 엔진 메커니즘(=프리미티브)이 필요하다. 예:

- **새 스킬 효과 종류** — 위 SkillEffect 목록에 없는 동작(예: 흡혈/생명력 흡수, 다단 히트, 즉사, 소환, 대상 위치 교환, 스택 소비형 효과, 조건부 효과).
- **새 상태이상 거동** — 위 StatusDef 필드로 못 만드는 것(예: "맞을 때마다 반사 피해", "턴마다 스택 증가", "특정 효과 면역").
- **새 면적/타겟팅 규칙** — `AreaShape`·`reach`·칸 마스크로 표현 안 되는 것(예: 대각선, 관통 직선, 사거리 기반 원거리).
- **새 턴 순서 규칙** — 라운드제 SPD 외(예: 콤보·연계 턴, 행동값 ATB).
- **AI 정책 어휘 확장** — `AiProfile`의 기존 `prefer`/`target`/`AiCondition`/`weight` 목록으로 표현 안 되는 새 결정 기준(예: "쉴드 가진 적 회피", "특정 스킬 콤보 순서"). 목록에 있으면 데이터-온리.
- **새 노드/맵 거동, 사운드** 등 시스템 레벨.

### 요청하는 법 (프리미티브 갭)

엔지니어에게 **무엇이** 필요한지, **기존 무엇으로 안 되는지** 한 줄로 적어 요청한다. 예:
> "스킬에 **흡혈**(가한 피해의 X%를 회복)이 필요. 기존 `damage`+`heal`은 *가한 피해량*을 못 참조해서 조합으로 불가. → 새 SkillEffect 종류."

엔진에 프리미티브가 추가되면 그때부터 그 효과도 **데이터로** 자유롭게 쓸 수 있다.

---

## 📖 사전 — 필드·타입 레퍼런스

스키마의 진실은 [`core/types/content.ts`](../core/types/content.ts)이지만, 아래에 디자이너가 쓸 모든 필드를 정리한다. (`?` = 선택 필드, 생략 가능)

### 캐릭터 (`characters.ts` → `Character`)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` | string | 고유 ID (객체 키와 동일하게) |
| `name` | string | 표시 이름 |
| `avatar?` | string | 이모지(`"🧢"`) 또는 이미지 경로(`"/avatars/x.webp"`) |
| `hp` | number | 최대 체력 |
| `speedMin` / `speedMax` | number | SPD 주사위 범위(매 라운드 이 사이로 굴려 행동 서열 결정) |
| `evasion` | number | 회피 — 상대 명중에서 차감 |
| `accuracy` | number | 명중 가산(기본 0) |
| `critChance` | number | 치명타 확률 % |
| `critMultiplier` | number | 치명타 피해 배수 (예: 1.5) |
| `skillIds` | string[] | learnset(보유 가능 스킬 풀). **앞 4개**가 시작 보유/활성 |
| `playable?` | boolean | `true`면 본거지 편성 후보(아군). 적/잡몹은 생략 |

### 스킬 (`skills.ts` → `Skill`)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` / `name` | string | ID / 표시 이름 |
| `target` | `"enemy"` \| `"ally"` \| `"self"` | 대상 진영 |
| `cooldown` | number | 재사용 대기(그 유닛의 턴 수). `0`=매 턴 |
| `accuracy` | number | 스킬 내장 명중. 최종 명중 = 공격자 명중 + 이 값 − 타겟 회피 |
| `alwaysHit?` | boolean | 필중(명중 공식 무시) |
| `usableFrom?` | `Pos[]` | 시전 가능한 *내* 칸. 생략=어디서나 |
| `targetCells?` | `Pos[]` | 타겟 가능한 *대상* 칸. 생략=점유된 아무 칸 |
| `reach?` | number | 근접 사정권: 최전열(살아있는 적 최소 열)부터 **연속 n칸**만 타격. `targetCells`보다 우선 |
| `area?` | `AreaShape` | 면적(아래). 생략=`single` |
| `effects` | `SkillEffect[]` | **효과 조합**(아래). 한 스킬 = 여러 효과 |
| `grantsInterrupt?` | number | 이 스킬이 부여하는 끼어들기 횟수 |
| `grantsInterruptTo?` | `"self"` \| `"target"` | 끼어들기 주체(기본 `self`. `target`=대상 아군에게=서포트) |
| `tier?` | number | 강화 단계(표시용, 기본 1) |
| `nextTierId?` | string | 다음 티어 스킬 id. 보상 "강화"가 이걸로 교체. 없으면 최종 티어 |
| `exclusiveTo?` | string | 전용기 소유 charId. 생략=범용기(여러 캐릭 learnset 공유) |

### 스킬 효과 — 원자 단위 (`Skill.effects[]` → `SkillEffect`)

한 스킬의 `effects`는 아래 종류를 **순서대로 나열**(예: 피해 → 상태이상 → 이동).

| `kind` | 추가 필드 | 효과 |
|---|---|---|
| `"damage"` | `amount: number` | 상수 피해(쉴드 먼저, 그다음 HP) |
| `"applyStatus"` | `statusId, stacks, duration` | 대상에 상태이상 부여 |
| `"applyStatusSelf"` | `statusId, stacks, duration` | 대상과 별개로 **시전자**에 상태이상 |
| `"shield"` | `amount: number` | 쉴드(덤 HP) 부여 |
| `"heal"` | `amount: number` | 체력 회복 |
| `"cleanse"` | (없음) | 대상의 디버프(비버프 상태) 전부 제거 |
| `"move"` | `who: "self"\|"target"`, `deltaCol: number` | 열 이동(재배치). `deltaCol` 음수=전진(0열 방향), 양수=후퇴 |

> `statusId`는 `statuses.ts`에 정의된 상태이상 ID. `stacks`=중첩 수, `duration`=지속 턴.

### 면적 모양 (`Skill.area` → `AreaShape`)

선택한 앵커 칸 기준으로 영향 칸을 정함(바닥에 표시).

| `kind` | 추가 필드 | 영향 범위 |
|---|---|---|
| `"single"` | — | 앵커 1칸(기본) |
| `"row"` | — | 앵커가 속한 **행** 전체 |
| `"col"` | — | 앵커가 속한 **열** 전체 |
| `"square"` | `radius` | 앵커 중심 (2·radius+1)² 정사각 |
| `"cross"` | `radius` | 앵커 + 직교 인접 radius칸(십자) |
| `"all"` | — | 대상 진영 전체 |
| `"free"` | `count` | 자유 인접 N칸 직접 선택(인터랙티브) |

### 상태이상 (`statuses.ts` → `StatusDef`)

`id`·`name`·`icon`은 필수. 나머지 **거동 필드**를 켜서 효과를 만든다(여러 개 조합 가능).

| 필드 | 타입 | 거동 |
|---|---|---|
| `buff?` | boolean | 이로운 효과 표시 구분(기본 false=디버프) |
| `dot?` | `{ trigger, dmgPerStack }` | 지속 피해(화상/중독/출혈) |
| `hot?` | `{ trigger, healPerStack }` | 지속 회복(재생) |
| `actionDenial?` | boolean | 행동 봉쇄(빙결) |
| `damageDealtMult?` | number | 주는 피해 **곱**배율(동상 0.5) |
| `dmgDealtFlat?` | number | 주는 피해 **합**보정(+공위증 / −약화) |
| `critChanceAdd?` | number | 치명 확률 가산 % |
| `critMultiplierAdd?` | number | 치명 배수 가산 |
| `shieldShred?` | boolean | 쉴드 잠식(들어온 피해 1이 쉴드를 스택만큼 깎음) |
| `pierce?` | boolean | 쉴드 무시(보유 유닛 공격이 HP 직접) |
| `undying?` | boolean | 사망 방지(HP 0 이하로 안 죽음) |
| `invincible?` | boolean | 무적(모든 피해 0) |
| `taunt?` | boolean | 도발(적 공격 집중 — AI 참조) |
| `speedMod?` | number | SPD 보정(부호 있음): **양수=상승**(서열 앞), **음수=하락**(서열 뒤). 가속/마비 |
| `grantsInterrupt?` | boolean | 보유 유닛이 정규 턴에 행동하면 끼어들기 발생(신속) |

**`trigger`**(`dot`/`hot` 발동 시점): `"turnStart"`(턴 시작) · `"turnEnd"`(턴 종료) · `"onAction"`(정규+끼어들기 모든 행동).

### 장착 아이템 (`items.ts` → `ItemDef`)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` / `name` | string | ID / 이름 |
| `slot` | `"weapon"` \| `"armor"` \| `"held"` | 무기 / 방어구 / 지닌물건 |
| `icon?` | string | 표시 아이콘(이모지) |
| `mods?` | `{ hp?, evasion?, accuracy?, critChance?, critMultiplier?, speedMin?, speedMax? }` | 능력치 합산 보정(장착/해제 시) |
| `dmgFlat?` | number | (무기) 데미지 스킬에 공격 상수 +N(합연산) |
| `shieldGainAdd?` | number | (방어구) 받는 쉴드 획득량 +N |
| `tier?` / `nextTierId?` | number / string | 강화 체인(스킬과 동형) |

### 포메이션 (`formations.ts` → `FormationLayout`)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` | string | ID |
| `columns` | `ColumnBonus[]` | 인덱스=열(0~3). 각 열의 보너스 **총량**(그 열 유닛들에 분배=총량보존) |

`ColumnBonus` = `{ attackPower?: number, defensePower?: number }`.

### 런 / 맵 (`runs/*.json` → `RunDef`)

런 하나 = 시작 파티 + **층(floor) 그래프**. 각 층은 **헥스 인접 무방향그래프**(노드 + 맞닿은 헥스끼리의 무방향 변)이고, 층끼리는 **클리어 노드의 `toFloor`**로 이어진다(없으면 그 클리어=승리). `entryFloorId`가 시작 층. 맵은 손으로 짠 JSON이 진실 — **타이틀 화면의 「🗺 런 에디터」**로 드래그드롭 저작 → 배포본 만들기 두 길: **(A dev, 권장)** `npm run dev`에서 「💾 repo에 저장」 → dev-write 미들웨어가 `{fileId}.json`을 이 폴더에 쓰고 `runs.generated.ts`(레지스트리)를 자동 재생성한다(둘 다 git 커밋). **(B)** 「내보내기」로 `{id}.json` 다운로드 → 수동으로 이 폴더에 넣고 커밋(레지스트리는 다음 dev 저장 때 또는 직접 갱신). (JSON을 직접 손으로 써도 됨. `runs.generated.ts`는 **자동 생성 — 직접 편집 금지**. 절차생성 `MapGenConfig`/`genMap`은 폐기)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` / `name` / `desc?` | string | ID / 이름 / 설명 |
| `useMastery` | boolean | 숙련도 보상 게이팅. `false`면 전 tier 개방 |
| `roster` | `{ charId, pos }[]` | 기본 시작 파티(`pos` = `{ row, col }`) |
| `entryFloorId` | string | 시작 층 id |
| `floors` | `FloorDef[]` | 층 집합(순서 무의미 — `entryFloorId`·`toFloor`로 탐색) |

**`FloorDef`** = `{ id, name?, entryNodeId, nodes: MapNode[], edges: MapEdge[] }`
**`MapNode`** = `{ id, type: NodeType, q, r, toFloor?, roster?, label? }` — `q,r`은 **렌더 위치**(위상 아님), `toFloor`=clear 전용 다음 층 id, `roster`=전투 노드 적 구성 override(`{charId,pos}[]`; 없으면 타입 기본 `NODE_ROSTERS[type]`), `label`=표시명(예: "두목 호위대"; 맵·에디터 노드 위에 타입명 대신 표기)
**`MapEdge`** = `{ from, to }` — **무방향 변**. **맞닿은(인접) 헥스끼리만** 연결 가능(전부 켜면 곧 "맞닿으면 이동"). 방향 없음.

**`NodeType`**: `"start"`(입장) · `"battle"` · `"elite"` · `"boss"`(길목) · `"shop"` · `"encounter"` · `"rest"` · `"clear"`(목표 마커 — 진입 시 층 종료).

규칙: ① 입장(`entryNodeId`)에서 **맞닿은 길**을 따라 **클리어 노드**에 도달하면 층 완료(보스는 강적이지만 길목). **재방문 불가**(지나온 칸 잠김 → 전진만). ② 갈림길로 보스/클리어 여러 개 → **아무 클리어든 진입하면 완료**. ③ **클리어 노드의 `toFloor`**가 다음 층(없으면 그 클리어=런 승리) — 여러 클리어가 다른 층을 가리키면 **층 분기**. ④ 변은 **맞닿은 헥스끼리만**, 모든 노드는 입장과 연결+클리어 도달; **층 그래프**는 `entryFloorId`에서 전 층 도달+승리 클리어(toFloor 없는) ≥1 (엔진 `validateRun`이 저장 시 검증). ⑤ **노드별 적 구성**: 전투 노드(`battle`/`elite`/`boss`)에 `roster`를 주면 그 노드만의 적으로 전투(없으면 타입 기본). 같은 `battle`이라도 노드마다 다른 적을 둘 수 있다. **라벨**: 어느 노드든 `label`로 표시명 지정.

**에디터 조작**: **광활한 육각 격자**(엑셀식) 어디든 카탈로그를 **드래그**해 배치, 배치된 노드는 **드래그로 이동**(커서를 따라오는 오브젝트). 노드 **클릭**=선택(**Ctrl**=다중, **Ctrl+A**=전체, 빈칸 클릭=해제) → **Del** 일괄 삭제(입장 제외). 선택군은 함께 이동. 시작=파랑·클리어=초록·선택=노랑 테두리(부위 강조). **인접하면 기본 연결**, 두 칸 사이 변에 **호버(점선)→클릭(실선 벽)**으로 차단/연결(연결됨=선 없음, 벽=어두운 빨강). 뷰포트 고정 — **휠=줌**, **휠(가운데) 드래그=이동**.

> **좌표 `Pos`** = `{ row: number, col: number }`. **열(col) 0 = 최전방**, 열이 클수록 후방.

### AI 프로파일 (`ai.ts` → `AiProfile`)

적(과 자동플레이)이 **턴마다 합법 행동 중 무엇을 고를지** 정하는 우선순위 룰. 캐릭터에 `aiProfileId: "healer"`처럼 지정하면 작동(없으면 공유 그리디 = 최저 HP·최고 명중·도발 우선).

```ts
healer: {
  id: "healer", name: "헌신",
  rules: [
    { if: [{ c: "allyHpPctBelow", v: 60 }], prefer: "heal", target: "lowestHpAlly" }, // 위급 아군 치료
    { prefer: "damage", target: "lowestHpEnemy" },                                    // 아니면 공격(fallback)
  ],
},
```

**해석 규칙**: 룰을 **위→아래** 본다. `if` 조건이 모두 참이고 그 `prefer` 종류의 합법 행동이 실제로 있으면 → 그 룰로 결정(끝). 아니면 다음 룰. 끝까지 안 맞으면 **공유 그리디**로 떨어진다. (결정론 — 무작위 없음, 동점은 행동 인덱스 앞)

| 자리 | 값 |
|---|---|
| `prefer` | `damage` · `heal` · `shield` · `applyStatus` · `cleanse` · `any` (스킬 `effects`에 그 종류가 있으면 매칭) |
| `target` | `lowestHpEnemy` · `highestHpEnemy` · `lowestHpAlly` · `frontmostEnemy` · `backmostEnemy` · `self` · `anyEnemy` · `anyAlly` |
| `if` (`AiCondition`, AND) | `selfHpPct{cmp,v}` · `allyHpPctBelow{v}` · `enemyHpPctBelow{v}` · `selfHasStatus{statusId}` · `selfMissingStatus{statusId}` · `enemyHasStatus{statusId}` · `round{cmp,v}` · `outnumbered` · `allyCount{cmp,v}` |
| `weight` (보조 정렬) | `backlineTarget` · `frontlineTarget` · `lowHpTarget` · `hitChance` · `critChance` (각 숫자 — 클수록 그 성향↑) |

> 예) 암살자 = `{ prefer:"damage", target:"lowestHpEnemy", weight:{ backlineTarget:6, lowHpTarget:2 } }` → 뒷열·저체력 적을 우선 저격. 탱커 = `{ if:[{c:"selfHpPct",cmp:"lt",v:45}], prefer:"shield", target:"self" }`를 1순위로.

---

## 🎛 효과 설계 — 액티브 · 패시브 · 특성

게임의 효과는 **세 자리** 중 하나에 들어간다. 효과 어휘(피해/회복/상태부여…)는 공유하지만 **작동 방식·적용 조건**이 다르다:

| 종류 | 어디에 | 언제 발동 | 형식 |
|---|---|---|---|
| **액티브** | `skills.ts` `effects[]` | 플레이어가 전투 스킬창에서 **선택** | `SkillEffect`(타겟·명중·치명·면적은 스킬이 입힘) |
| **패시브** | `skills.ts` `passives[]` | 그 스킬을 **출전(활성 4)**하면 상시 | `PassiveRule`(when/if/then) |
| **특성(trait)** | `traits.ts` + `characters.ts traitIds` | 캐릭터가 가지면 **항상** | `PassiveRule`(when/if/then) |

- **액티브**는 **무조건 피해/명중·쿨타임·타겟팅 정보**가 있어야 함(스킬 파이프라인이 명중·치명·면적 처리). **패시브/특성**은 트리거에 반응하며 효과가 **스스로 target을 지정**.
- **`active` 태그**: 스킬 기본 `active`(스킬창 노출). `active:false`=순수 패시브(스킬창 비노출, 출전 슬롯엔 편성 가능). `effects`+`passives` 둘 다 = **하이브리드**.
- **패시브 발동 = 출전 기준**(중요): 스킬을 활성 4슬롯에 **편성해야** 그 패시브가 작동(보유만으론 X). 순수 패시브 스킬도 슬롯을 차지. **특성은 편성 무관, 항상.**

```ts
PassiveRule = { when: Trigger, if?: Condition[], then: Effect[], maxPerTurn?, maxPerBattle? }
// when 시점에, if 조건이 모두 참이면(없으면 항상), then 효과를 순서대로 실행.

// 하이브리드 예: 능동 강타 + "크리 시 출혈" 패시브 (출전해야 패시브 작동)
{ id:"kim_punch", name:"종로의 주먹", target:"enemy", cooldown:0, accuracy:90, effects:[{kind:"damage",amount:14}],
  passives:[{ when:{on:"onHit",as:"attacker",crit:true}, then:[{do:"applyStatus",statusId:"bleed",stacks:1,duration:2,target:"subject"}] }] }
// 특성 예(traits.ts, 항상 작동): 적 처치 시 자가 회복
{ id:"bloodlust", name:"피의 갈망", rules:[{ when:{on:"kill"}, then:[{do:"heal",amount:8,target:"self"}] }] }
```

### ⏱ 스코프: 하나의 전투 vs 모험 전체 (반드시 구분)
when/if/then 룰은 **두 스코프**로 갈린다 — 트리거가 스코프를 결정하고, 한 룰은 한 스코프에만 속한다:
- **전투 스코프(한 전투 안)** — 턴/라운드/주사위/명중/피해/회복/상태/이동/사망. 소유자=전투 유닛.
- **모험 스코프(런 전체)** — 노드 진입/클리어·액트 시작·골드 획득·파티 HP·다음 전투 계승. 소유자=파티원.

> 디자인 적절성은 디자이너 판단: 스킬 패시브는 **웬만하면 전투 스코프**(출전해야 켜지므로), 모험 전반 효과는 주로 **특성**으로.

### Trigger 카탈로그 (`when`)
**전투 스코프**(소유자=전투 유닛). `self`=룰 소유자 / `subject`=이벤트 상대(피격자·턴 주체 등) / `target`=현재 행동 대상.

| `on` | 발동 시점 | 옵션 |
|---|---|---|
| `battleStart` · `roundStart` · `roundEnd` | 전투/라운드 경계 | — |
| `turnStart` · `turnEnd` | 턴 시작/종료 | `who?: self\|ally\|enemy\|any`(기본 self) |
| `everyNTurns` | 소유자 N번째 턴마다 | `n` |
| `interruptStart` | 끼어들기 턴 시작 | — |
| `speedRoll` | 주사위 굴릴 때 | (효과는 `modSpeedRoll`/`rerollSpeed`만) |
| `beforeAction` · `skillUsed` | 행동 직전 / 스킬 사용 | `who?` · `skillId?` |
| `onMove` · `enterCell` | 이동 / 특정 칸 진입 | `who?` · `row?`/`col?` |
| `onHit` · `onMiss` | 명중 / 빗나감 | `as?: attacker\|target` · `crit?` |
| `dealtDamage` · `damaged` | 가해 / 피격 | — |
| `kill` · `death` | 처치 / 사망 | `death.who?` |
| `onHeal` · `onShieldGain` | 회복 / 쉴드 획득 | `onHeal.as?` |
| `statusApplied` · `statusTick` | 상태 부여 / 지속 발동(on-bleed) | `statusId?` · `as?` |
| `battleEnd` | 전투 종료 | `result?: win\|lose` |

**모험(run) 스코프**(소유자=파티원, 전투 밖 사건). `self`=룰 소유 파티원 / `allAllies`=파티 전체.

| `on` | 발동 시점 | 옵션 |
|---|---|---|
| `nodeEnter` · `nodeClear` | 노드 진입 / 클리어 | `nodeType?`(battle/elite/boss/shop/rest/encounter) |
| `actStart` | 액트 시작(다음 층) | — |
| `goldGain` | 골드 획득(전투 승리 등) | — |
| `partyHpChange` | 파티 회복/피해 | `dir?: heal\|hurt` |

### Condition 카탈로그 (`if` — AND 결합)
전투 스코프: `hpPct(who,cmp,v)` · `round(cmp,v)` · `selfTurnCount(cmp,v)` · `everyN(n,of)` · `firstTurn` · `hasStatus(who,statusId,minStacks?)` · `missingStatus(who,statusId)` · `atColumn/atRow(who,cmp,v)` · `atCell(who,row,col)` · `isFrontline(who)` · `sideCount(side,cmp,v)` · `outnumbered` · `subjectCharId(charId)` · `subjectSide(side)` · `wasCrit` · `damageAtLeast(v)` · `skillIs(skillId)` · `chance(pct)`.
모험 스코프: `nodeTypeIs(nodeType)` · `goldAtLeast(v)` · `hpPct(self)` · `chance(pct)`.
`cmp` = `lt`·`lte`·`eq`·`gte`·`gt`.

### Effect 카탈로그 (`then`)
대상 `target`: `self`·`subject`·`target`·`allAllies`·`allEnemies`·`otherAllies`(자신 제외)·`otherEnemies`(대상 제외)·`randomEnemy`·`randomAlly`.

| `do` | 효과 |
|---|---|
| `damage` / `heal` / `shield` `{amount,target}` | 피해 / 회복 / 쉴드 |
| `applyStatus` `{statusId,stacks,duration,target}` | 상태이상 부여 |
| `cleanse {target}` · `removeStatus {statusId,target}` | 디버프 전체 정화 / 특정 상태 1종 제거 |
| `move {deltaCol,target}` | 이동(음수=전진) |
| `healByDamage {pct,target}` | 흡혈 — 가한 피해 pct% 회복(`dealtDamage`/`onHit` 트리거) |
| `reflectByDamage {pct,target}` | 비율 반사 — 받은 피해 pct% 피해(`damaged` 트리거, target=subject=공격자) |
| `grantInterrupt {count,target}` | 끼어들기 부여 |
| `statMod {stat,delta,target}` | 전투 동안 스탯 누적 보정(accuracy/evasion/critChance/critMultiplier/speedMin/speedMax) |
| `modCooldown {skillId?,delta,target}` | 쿨다운 가감 |
| `modSpeedRoll {delta}` · `rerollSpeed` | 주사위 가산 / 재굴림 (`speedRoll` 트리거 전용) |
| `goldDelta {amount}` | (모험) 골드 가감 |
| `healParty {pct}` | (모험) 파티 비율 회복 |
| `grantRunStatus {statusId,stacks,duration,target}` | (모험) **다음 전투 시작 시** 부여(계승, 1회) |
| `castSkill {skillId}` | **액티브 스킬 자동 시전** — 명중·사정권·면적·치명은 그 스킬 정의대로(타겟 자동). "WHEN(패시브)이 HOW(액티브)를 발동" |

> **⚠️ `castSkill` 재귀 방지 규칙(강제)**: `castSkill`의 대상은 **`passives`가 없는 leaf(순수 액티브) 스킬만** 허용. `passives`를 가진 스킬을 castSkill 대상으로 쓰면 **`npm run check`가 커밋을 막는다**(패시브→스킬→패시브→… 무한 중첩 차단). 즉 자동공격용 스킬은 명중/피해/사정권만 있는 순수 액티브로 따로 만들고, 그걸 패시브가 트리거. (교차 연쇄는 엔진 깊이·재진입 가드가 추가로 차단.)

> **주의**: `statMod`은 누적되고 자동 만료가 없다 → **`battleStart` 1회**나 `maxPerBattle:1`로만 쓰고, 매 턴 갱신형 버프는 **`applyStatus`(버프 상태이상)**로. 무한 연쇄(피격→피해→피격…)는 엔진이 깊이·재진입으로 막지만, `maxPerTurn`/`maxPerBattle`로 의도된 한도를 두는 게 좋다.

### 못 하는 것 → 엔진 요청
위 카탈로그에 없는 시점·조건·효과(예: 흡혈=가한 피해 비례 회복, 반사 비율, 특정 효과 면역, 진영 광역 브로드캐스트)는 **새 엔진 프리미티브**가 필요 → "요청하는 법"대로 엔지니어에게.

---

## 작업 흐름

1. 데이터 파일 수정 (이 폴더).
2. `npm run dev` → 브라우저에서 즉시 확인(HMR). 단일 캐릭/소수 파티로 테스트하려면 본거지 편성에서 1~4명 선택.
3. `npm run check` → 타입·테스트·회귀 게이트 통과 확인.
4. 새 메커니즘이 필요하면 위 "요청하는 법"대로 엔지니어에게.
