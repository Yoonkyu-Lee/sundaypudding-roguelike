# 이벤트 로그 직렬화 계약 (SERIALIZATION-CONTRACT)

> **목적**: TS↔Rust 포팅 시 "같은 시드+행동 → **바이트 동일** 이벤트 로그"를 보장하기 위한 직렬화 계약.
> JS `JSON.stringify`는 키를 **삽입 순서**로 내고 Rust serde는 **선언/정렬 순서**로 내므로, 자동으로는 어긋난다.
> 이 계약을 양쪽이 지키면 `GameEvent[]`의 직렬화가 바이트 단위로 일치한다.
>
> **구현(TS)**: [`src/core/tests/harness/canonical.ts`](../src/core/tests/harness/canonical.ts) `canonicalJson`/`canonicalLog`.
> 골든 코퍼스([`golden/`](INVARIANTS.md))·self-consistency가 이 직렬화로 비교.

---

## 1. canonical JSON 규칙 (5)

1. **객체 키 = lexicographic(코드포인트) 오름차순.** 삽입 순서 무시. (Rust: `BTreeMap` 또는 정렬 후 직렬화.)
2. **수치 = 정수만.** 소수점·지수·`-0`·`NaN`·`Infinity` 없음. `5`(O), `5.0`/`5e0`(X). 비정수/비유한은 **계약 위반 → 오류**.
3. **undefined 값 키는 생략.** (optional 필드 부재 = 키 없음. `null`과 구분.)
4. **문자열 = JSON 표준 이스케이프 + UTF-8.** (`"`, `\`, 제어문자만 이스케이프. 비-ASCII는 그대로.)
5. **공백 없음.** 구분자 `,`/`:` 사이 공백 0.

> TS `canonicalJson`은 ②를 `Number.isInteger`로 강제(위반 시 throw) → 부동소수 회귀를 즉시 검출.
> 슬라이스1(포메이션 정수화) 이후 전투 이벤트 로그 수치는 **전부 정수**라 이 계약이 성립한다([`NUMERIC-POLICY.md`](NUMERIC-POLICY.md)).

## 2. `GameEvent` 필드 (전부 정수 수치 — `src/core/types/runtime.ts`)

| `t` | 필드(타입) |
|---|---|
| roundStart | round:int, order:QueueEntry[], rolls:SpeedRoll[] |
| turnStart | uid, kind("normal"\|"interrupt") |
| skillUsed | uid, skillId, targetUid?(생략 가능) |
| miss | uid, targetUid, chance:int |
| hit | uid, targetUid, chance:int, crit:bool |
| damage | targetUid, base:int, final:int, toShield:int, toHp:int |
| heal / shieldGain | targetUid, amount:int |
| statusApplied | targetUid, statusId, stacks:int, duration:int |
| statusTick | targetUid, statusId, dmg:int |
| cleanse | targetUid |
| move | uid, from:Pos, to:Pos |
| interrupt | uid |
| skip | uid, reason("noUsableSkill"\|"frozen"\|"chosen") |
| death | uid |
| dialog | speaker?(생략 가능), text |
| battleEnd | phase("allyWin"\|"enemyWin") |

보조: `QueueEntry{uid, kind, speed:int}` · `SpeedRoll{uid, speedMin:int, speedMax:int, roll:int, speedMod:int, speed:int}` · `Pos{row:int, col:int}`.

## 3. Rust 포팅 측 재현 지침

- 수치는 **`i64`(또는 `i32`)** 로. 부동소수 금지(NUMERIC-POLICY 옵션 B로 분수 제거됨).
- 직렬화: `serde_json` + 키 정렬(필드를 알파벳 순 선언하거나 `BTreeMap`로 직렬화). optional 필드는 `#[serde(skip_serializing_if = "Option::is_none")]`로 ③ 충족.
- 문자열·이스케이프는 `serde_json` 기본이 JSON 표준과 동일(②④⑤).
- 검증: 같은 시드+행동 시퀀스로 Rust 로그를 canonical 직렬화 → TS 골든 매니페스트 SHA와 대조(differential harness).

## 4. 비범위(포팅 시점)

- **RNG 상태 트레이스**(소비 순서·횟수 일치): `stressRun`의 `rngTrace` 옵션으로 구현됨(매 step 후 `b.rng.state` 기록, 기본 off). 포팅 differential 시 로그 불일치를 "RNG 발산 vs 로직 발산"으로 국소화.
- 32비트 wrapping 산술(`rng.ts`)·`Math.round` 잔존 지점(R1 damage·R8 회복비율)의 정확 복제는 포팅 시 검증.
- 이 계약은 **이벤트 로그**(`GameEvent[]`) 한정. RunState 세이브 직렬화는 별도(`run/save.ts`, `{__rng}` 마커).
