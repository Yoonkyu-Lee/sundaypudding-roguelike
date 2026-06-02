# 디자이너 가이드 — `src/data/`

이 폴더가 **콘텐츠**다. 엔진(`src/core/`)은 여기 적힌 값을 **해석만** 한다.
핵심 원칙: **메커니즘 = 엔진, 값 = 데이터.** 아래 "할 수 있는 것"에 해당하면 **이 폴더 파일만 고치면** 빌드·실행된다(엔진 코드 안 건드림).

> 작성 스키마(타입)의 진실은 [`src/core/types/content.ts`](../core/types/content.ts) — 각 필드의 정확한 의미가 주석으로 달려 있다. 규칙·수치 맥락은 [`docs/GAME-DESIGN.md`](../../docs/GAME-DESIGN.md).

## 파일별 무엇을 만드나

| 파일 | 콘텐츠 |
|---|---|
| `characters.ts` | 캐릭터 — 스탯(HP/속도/회피/명중/치명)·`skillIds`(learnset)·`avatar`·`playable` |
| `skills.ts` | 스킬 — 타겟·쿨타임·명중·사정권·면적·효과(`effects[]`)·강화 티어 체인 |
| `statuses.ts` | 상태이상 — 표준 거동 필드 조합(지속피해/회복·행동봉쇄·배율 등) |
| `items.ts` | 장착 아이템 — 능력치 보정·무기 데미지·방어구 쉴드 |
| `formations.ts` | 포메이션 — 열별 보너스 총량(공격/방어) |
| `maps.ts` | 맵 생성 설정(`MapGenConfig`)·액트 구성(`ACTS`) — 깊이·노드 가중치·분기 |
| `modes.ts` | 게임 모드(`GameMode`) — 시작 로스터·액트·숙련도 사용 여부 |
| `encounters.ts` | 노드별 적 배치(전투 구성) |
| `events.ts` | 인카운터 이벤트(선택지·결과) |

## ✅ 디자이너가 혼자 할 수 있는 것 (데이터-온리)

- **캐릭터 추가/수정**: `characters.ts`에 엔트리 추가. `playable: true`를 붙이면 **본거지 편성 화면에 자동 등장** → 바로 골라서 테스트/밸런싱.
- **스킬 제작**: 아래 **프리미티브 카탈로그**의 효과·필드를 **조합**해서. 데미지+상태이상+이동+쉴드 등 조합 자유. 강화 티어는 `nextTierId` 체인으로.
- **상태이상 제작**: `StatusDef`의 거동 필드를 켜서(지속피해·재생·행동봉쇄·데미지 배율/가산·쉴드 잠식·관통·불사·도발·SPD 감소 등).
- **아이템·포메이션·맵·모드·적 배치·인카운터**: 각 스키마대로 값만.
- **밸런싱**: 모든 수치(데미지·HP·명중·쿨타임·가중치·보상 등)는 데이터라 자유 조정.
- **learnset / 강화 트리 / 전용기·범용기 구분**: `skillIds`·`nextTierId`·`exclusiveTo`로.

### 현재 프리미티브 카탈로그 (엔진이 이미 해석 — 이걸 조합한다)

- **SkillEffect**(`skills.ts effects[]`): `damage` · `applyStatus` · `applyStatusSelf` · `shield` · `heal` · `cleanse` · `move`(밀치기/돌진)
- **AreaShape**(`area`): `single` · `row` · `col` · `square`(radius) · `cross`(radius) · `all` · `free`(N칸 자유선택)
- **Skill 필드**: `cooldown` · `accuracy` · `alwaysHit` · `usableFrom`(시전 칸) · `targetCells`(타겟 칸) · `reach`(근접 사정권) · `grantsInterrupt`/`grantsInterruptTo`(끼어들기 부여) · `tier`/`nextTierId` · `exclusiveTo`
- **StatusDef 거동**: `dot`(지속피해) · `hot`(재생) · `actionDenial`(행동봉쇄) · `damageDealtMult` · `dmgDealtFlat` · `critChanceAdd`/`critMultiplierAdd` · `shieldShred`(쉴드 잠식) · `pierce`(쉴드 무시) · `undying`(불사) · `invincible`(무적) · `taunt`(도발) · `speedDown` · `grantsInterrupt`
- **ItemDef**: 능력치 `mods`(hp/회피/명중/치명/속도) · `dmgFlat`(무기) · `shieldGainAdd`(방어구)
- **맵**: `MapGenConfig`(rows·startWidth·firstRowType·nodeWeights·branch)

## 🔧 디자이너 혼자 못 하는 것 (엔진 개발 필요 → 엔지니어에게 요청)

기존 프리미티브 **조합으로 표현이 안 되면** 새 엔진 메커니즘(=프리미티브)이 필요하다. 예:

- **새 스킬 효과 종류** — 위 SkillEffect 목록에 없는 동작(예: 흡혈/생명력 흡수, 다단 히트, 즉사, 소환, 대상 위치 교환, 스택 소비형 효과, 조건부 효과).
- **새 상태이상 거동** — 위 StatusDef 필드로 못 만드는 것(예: "맞을 때마다 반사 피해", "턴마다 스택 증가", "특정 효과 면역").
- **새 면적/타겟팅 규칙** — `AreaShape`·`reach`·칸 마스크로 표현 안 되는 것(예: 대각선, 관통 직선, 사거리 기반 원거리).
- **새 턴 순서 규칙** — 라운드제 SPD 외(예: 콤보·연계 턴, 행동값 ATB).
- **새 노드/맵 거동, 적 전용 AI 패턴, 사운드** 등 시스템 레벨.

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
| `speedDown?` | number | SPD 감소(라운드 서열 뒤로 — 마비/둔화) |
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

### 맵 생성 (`maps.ts` → `MapGenConfig`, 액트별 배열)

| 필드 | 타입 | 의미 |
|---|---|---|
| `rows` | number | 선택 층 깊이(보스 제외) |
| `startWidth` | `[min, max]` | 시작 행 너비 범위 |
| `firstRowType` | `NodeType` | 첫 행 고정 타입(보통 `"battle"`) |
| `nodeWeights` | `Partial<Record<NodeType, number>>` | 행1+ 노드 타입 추첨 가중치 |
| `branch` | `{ keepQChance, extraSameChance, extraLeftChance }` | 자식 분기 확률 %(각 부모) |

**`NodeType`**: `"start"` · `"battle"` · `"elite"` · `"shop"` · `"encounter"` · `"rest"` · `"boss"`. (`start`·`boss`는 생성기가 자동 배치, 나머지는 `nodeWeights`로 추첨)

### 게임 모드 (`modes.ts` → `GameMode`)

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` / `name` | string | ID / 이름 |
| `desc?` | string | 설명 |
| `roster` | `{ charId, pos }[]` | 기본 시작 파티(`pos` = `{ row, col }`) |
| `acts` | `MapGenConfig[]` | 액트별 맵(다층) |
| `useMastery` | boolean | 숙련도 보상 게이팅 사용. `false`면 전 tier 개방 |

> **좌표 `Pos`** = `{ row: number, col: number }`. **열(col) 0 = 최전방**, 열이 클수록 후방.

---

## 작업 흐름

1. 데이터 파일 수정 (이 폴더).
2. `npm run dev` → 브라우저에서 즉시 확인(HMR). 단일 캐릭/소수 파티로 테스트하려면 본거지 편성에서 1~4명 선택.
3. `npm run check` → 타입·테스트·회귀 게이트 통과 확인.
4. 새 메커니즘이 필요하면 위 "요청하는 법"대로 엔지니어에게.
