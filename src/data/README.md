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

## 작업 흐름

1. 데이터 파일 수정 (이 폴더).
2. `npm run dev` → 브라우저에서 즉시 확인(HMR). 단일 캐릭/소수 파티로 테스트하려면 본거지 편성에서 1~4명 선택.
3. `npm run check` → 타입·테스트·회귀 게이트 통과 확인.
4. 새 메커니즘이 필요하면 위 "요청하는 법"대로 엔지니어에게.
