# 데이터 직렬화 계약 (DATA-SERIALIZATION-CONTRACT)

> **목적**: 디자이너 데이터(items/skills/characters/traits/ai/statuses/…)를 TS↔Rust가 **동일하게** 읽기
> 위한 계약. 이벤트 로그 계약([`SERIALIZATION-CONTRACT.md`](SERIALIZATION-CONTRACT.md))의 **데이터 판**.
> serde 왕복만으론 부족 — 판별자·정수 스케일·배열 순서·ID 참조를 명문화한다(Codex 적대검토 (c)).
>
> **진실원**: TS 콘텐츠 모듈(`web/src/content/*`, 타입 authoring). **파생**: `web/src/content/data.generated.json`(`npm run data:export` → 엔진 serde 로드). **런 그래프**는 별도(`web/src/content/runs/*.json`).

---

## 1. 번들 구조 (`data.generated.json`)

canonical JSON 객체. 최상위 키(정렬순) = 데이터 맵:
`aiProfiles · characters · demoEncounter · encounterEvents · items · nodeRosters · skills · standardFormation · statuses · traits`.
각 맵은 `{ [id]: Def }`(또는 배열). 스키마는 `src/core/types/{content,passives,ai}.ts`·`src/core/types/map.ts`.

## 2. canonical 규칙 (이벤트 계약과 동일)

① 객체 키 lexicographic 정렬 ② 수치 정수만(P0-2 후 데이터에 float 0 — `Number.isInteger` 강제) ③ undefined 값 키 생략(absent ≠ null) ④ 문자열 UTF-8 표준 이스케이프 ⑤ 공백 없음. → Rust `BTreeMap`+`i64`+`#[serde(skip_serializing_if="Option::is_none")]`로 동일 바이트.

## 3. union 판별자 (Rust `#[serde(tag="…")]`)

| 타입 | 판별 키 | 변종 |
|---|---|---|
| `SkillEffect` (content) | `kind` | damage·applyStatus·applyStatusSelf·cleanse·shield·heal·move |
| `Condition` (passives) | `c` | hpPct·hasStatus·missingStatus·chance·atRow·atCol·isFrontline·nodeTypeIs·goldAtLeast … |
| `Effect` (passives) | `do` | damage·heal·shield·applyStatus·move·grantInterrupt·statMod·healByDamage·reflectByDamage·removeStatus·castSkill·modCooldown·showDialog·goldDelta·healParty·grantRunStatus·modSpeedRoll·rerollSpeed |
| `Trigger` (passives `when`) | `on` | turnStart·turnEnd·onHit·damaged·death·skillUsed·speedRoll·nodeEnter … |
| `AiCondition` (ai) | `c` | selfHpPct·allyHpPctBelow·enemyHpPctBelow·selfHasStatus·…·outnumbered·allyCount |
| `Layer` (map) | `kind` | combat·reward·shop·event·gold·heal·grantStatus·text |
| `ShopOfferDef` (map) | `kind` | buyItem·heal·learn |
| `EncounterOutcome` (events) | `kind` | nothing·heal·hurt·gold·upgradeRandom·learnUniversal |
| `RewardOption`·`ShopOffer` (run) | `kind` | upgradeSkill·learnSkill·item·heal / upgrade·learn·buyItem·heal |

## 4. 수치 스케일 (정수 — [`NUMERIC-POLICY.md`](NUMERIC-POLICY.md))

- **퍼센트(×100)**: `critMultiplier`(150=×1.5)·`critMultiplierAdd`·`damageDealtMult`(50=×0.5)·아이템 `mods.critMultiplier`(30=+0.3).
- **확률 퍼센트(0~100)**: `critChance`·`accuracy`·`evasion`·`chance`(조건/도박)·`pct`(회복/피해/흡혈/반사 — 전부 정수 퍼센트, 50=50%).
- **정수 그대로**: hp·dmgFlat·amount·stacks·duration·speedMin/Max·cost·tier·deltaCol·gold.
- Rust: 전부 `i64`(또는 `i32`). f64 금지.

## 5. 배열 = 의미 순서 (순서 보존 필수)

`skill.effects`(적용 순서) · `passive.then`(효과 순서) · `passive.if`(AND) · `profile.rules`(우선순위 위→아래) · `character.skillIds`(learnset·기본 활성 앞 4) · `encounter.choices` · 노드 `core[]`(시퀀스) · roster 배치. Rust는 `Vec`로 순서 보존(재정렬 금지).

## 6. ID 참조 무결성 (게이트: `data-refs.test`)

모든 id 참조는 대상 맵에 실재해야 한다(dangling 금지). Rust 로드 시 동일 검증 권장.

| 참조 필드 | 위치 | 대상 맵 |
|---|---|---|
| `skillIds[]` | character | skills |
| `traitIds[]` | character | traits |
| `aiProfileId` | character | aiProfiles |
| `nextTierId` | skill | skills |
| `exclusiveTo` | skill | **characters** |
| `statusId` | effect(applyStatus*)·condition(hasStatus/missingStatus)·aiCondition(selfHasStatus 등) | statuses |
| `skillId` | effect(castSkill) | skills |
| `charId` | nodeRosters·demoEncounter 배치 | characters |
| `itemId` | shop buyItem | items |

## 7. absent vs null

optional 필드(`?`)는 **부재**(키 없음)로 직렬화(③). `null`은 명시적 값일 때만(현 데이터엔 거의 없음). Rust: `Option<T>` + `skip_serializing_if`.

## 7.5. 스키마 드리프트 가드 (게이트: `web/scripts/schema-drift.ts`)

TS·Rust 스키마는 **둘 다 손글씨**(TS `contract/types/*` ↔ Rust `spr-types/*`). 두 언어 간 자동 단일소스(코드젠)는 ts-rs 마찰(bigint·import 확장자·유니온 약화)로 비용 과다 → **드리프트를 자동 검출**하는 가드로 갈음.
- **규약**: Rust 구조체는 **저작되는 모든 콘텐츠 필드를 선언**한다 — 엔진이 안 써도(프론트 전용 `playable`/`icon`/`name`/`desc` 등도 `#[serde(default)]`로 선언). 미선언 = serde가 말없이 무시 = 엔진이 그 필드를 영영 못 봄.
- **가드**: `npm run check`가 `data.generated.json`의 각 콘텐츠 필드가 대응 Rust 구조체에 선언됐는지 검사(없으면 FAIL). 필수 필드·태그 enum 변종은 이미 engine `cargo test`가 타입 역직렬화로 잡으므로, 이 가드는 **조용히 무시되는 optional 필드**를 보완.

## 8. 비범위

- **런 그래프**(`runs/*.json`)는 자체 검증(`validateRun`) — 이 계약과 별도.
- AI 프로파일 점수 `weight`의 소비(profile.ts `*0.1`)는 f64지만 데이터값(weight)은 정수 — 점수 계산은 differential 무관(행동 재생, [`NUMERIC-POLICY.md`](NUMERIC-POLICY.md) §3.5).
