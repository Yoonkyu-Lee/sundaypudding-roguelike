# 불변식 카탈로그 — 리포 코드 리뷰 기반 (INVARIANTS-FROM-REPO)

> **작성 방식**: `src/core/` 코드를 직접 읽고, 실제로 강제되(거나 되어야 하)는 규칙을 도출.
> **용도**: Claude Code 세션이 독립적으로 만든 `INVARIANTS-FROM-CLAUDE-CODE.md` 와
> **교차 검증**하기 위한 기준 목록. 누락·과잉·해석 차이를 찾는 데 쓴다.
>
> **검사 시점 표기**: `step` = 매 행동 후 / `round` = 라운드 경계 / `event` = 이벤트 생성 시 /
> `run` = 런/전투 종료 시 / `action` = step 입력 검증 시.
>
> **심각도**: `CRIT` = 위반 시 게임 상태 손상(결정론/세이브 위협) / `NORM` = 규칙 위반이나 복구 가능.

---

## A. 유닛 상태 무결성

| ID | 심각도 | 규칙 (술어) | 근거 | 시점 |
|---|---|---|---|---|
| A1 | CRIT | 모든 유닛 `hp ≥ 0` (음수 불가) | `damage.ts`: `target.hp = Math.max(0, target.hp - toHp)`; `effects.ts` heal `Math.min(hpMax, …)` | step |
| A2 | CRIT | 모든 유닛 `hp ≤ hpMax` | heal: `Math.min(tgt.hpMax, tgt.hp + amt)` | step |
| A3 | NORM | `shield ≥ 0` (쉴드 음수 불가) | `dealRawDamage`: `target.shield -= toShield` where `toShield ≤ shield` (absorbable 계산) | step |
| A4 | CRIT | `alive === false` ⟺ `hp ≤ 0` (단 불사로 1 생존한 경우 hp=1, alive=true) | `dealRawDamage`: died 판정 + undying 예외 | step |
| A5 | NORM | 죽은 유닛은 `hp === 0` 유지(부활 이벤트 없는 한) | death 후 hp 변경 경로 없음 | step |

## B. 죽음 / 생존 / 불사

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| B1 | CRIT | 죽은 유닛은 정규 턴을 받지 않음(서열 커서가 스킵) | `turnOrder.ts advance`: `if (!u.alive) continue` | step |
| B2 | NORM | 죽은 유닛은 타임라인(roundOrder)에서 **제거되지 않고 잔존**(회색 표시) | `advance` 주석 "칸은 타임라인에 남음" | round |
| B3 | CRIT | 불사(undying) 보유 시 치명타 포함 어떤 피해로도 `hp`가 0 이하로 떨어지면 1로 보정, 그 step에 죽지 않음 | `dealRawDamage`: `if (hp<=0 && hasStatus undying) hp=1; saved=true` | step |
| B4 | NORM | `death` 이벤트는 유닛당 생애 1회(중복 사망 로그 없음) | died 판정이 `!saved && hp<=0`, alive 토글 후 재진입 없음 | event |

## C. 턴 / 라운드 서열

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| C1 | CRIT | 한 라운드에서 각 **생존 유닛은 정확히 1회 정규(normal) 턴**을 받는다 | `startRound`: aliveUnits 1:1 entries 생성 | round |
| C2 | CRIT | 커서(cursor)는 라운드 내에서 **단조 증가**(되돌아가지 않음) | `advance`: `state.cursor++` only | step |
| C3 | CRIT | 서열 정렬은 `ACTION_CONST/speed` 오름차순, **동점은 uid 사전순**(결정론 tiebreak) | `startRound` entries.sort | round |
| C4 | CRIT | `speed = max(1, roll + speedMod)` (속도 하한 1) | `startRound` SpeedRoll 계산 | round |
| C5 | CRIT | 끼어들기(interrupt) 칸은 **정규 턴에서만** 발생 | `flow.ts step`: `if (entry.kind === "normal")` 가드 | step |
| C6 | CRIT | 끼어들기 칸은 현재 커서 **바로 뒤(cursor+1)** 에 삽입, subjects 순서 보존 | `interrupt.ts insertInterrupts`: 역순 splice at cursor+1 | step |
| C7 | CRIT | 끼어들기 턴은 **연쇄 끼어들기를 일으키지 않음**(끼어들기 중 interrupt 미발생) | C5 가드(normal만) | step |
| C8 | NORM | 끼어들기 턴에서는 쿨다운 감소·주기효과·지속시간 차감이 **일어나지 않음** | `onNormalTurnStart/End`는 normal에서만 호출 | step |
| C9 | CRIT | 타임라인 소진 시 새 라운드 시작(또는 roundEnd 효과로 전투 종료) | `advance`: cursor ≥ length → startRound | round |

## D. 데미지 / 쉴드

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| D1 | CRIT | 최종 데미지 `≥ 0` (음수 데미지 불가) | `computeDamage`: `Math.max(0, Math.round(dmg))` | step |
| D2 | CRIT | 피해는 **쉴드 먼저, 그다음 HP** 순서로 적용 | `dealRawDamage` 구조 | step |
| D3 | CRIT | 관통(pierce) 보유 공격자는 쉴드를 무시하고 HP에 직접 | `applyTargetEffects`: `ignoreShield: hasStatus(actor,"pierce")` | step |
| D4 | NORM | 공포(fear) N스택: 쉴드가 `mult=max(1,N)` 배로 잠식되나 **HP로 가는 효율은 불변** | `dealRawDamage`: absorbable/toShield 계산 | step |
| D5 | CRIT | 무적(invincible) 대상은 모든 피해 0(쉴드·HP 불변) | `dealRawDamage` 초입 분기 | step |
| D6 | NORM | `finalAmount ≤ 0` 또는 죽은 대상이면 피해 적용 no-op | `dealRawDamage` 가드 | step |
| D7 | NORM | 미리보기(previewHpLoss/previewDamage)는 실제 적용과 **동일 수식**(분기 공유) | preview 함수가 computeDamage 재사용 | (테스트) |

## E. 상태이상

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| E1 | CRIT | `duration ≤ 0` 또는 `stacks ≤ 0` 인 상태는 제거 | `onNormalTurnEnd`: filter `duration>0 && stacks>0` | step |
| E2 | CRIT | 지속시간 차감은 **정규 턴 종료에만**(끼어들기 제외) | `onNormalTurnEnd`에서만 `s.duration--` | step |
| E3 | NORM | DoT 트리거 시점 고정: 화상=turnEnd, 중독=turnStart, 출혈=onAction | `statuses.ts` defs + tickPeriodic 호출처 | step |
| E4 | NORM | 출혈(onAction)은 정규+끼어들기 **모든 행동**에서 발동 | `flow.ts step`: `tickPeriodic(…, "onAction")` 무조건 | step |
| E5 | NORM | 정화(cleanse)는 **버프(buff=true)만 남기고** 제거 | `applyTargetEffects` cleanse: filter `buff` | step |
| E6 | NORM | speedMod 부호: 양수=서열 앞, 음수=뒤(마비=-3) | `statuses.ts` + C4 | round |
| E7 | NORM | 빙결(actionDenial) 유닛의 정규 턴은 강제 skip(reason="frozen") | `flow.ts step` skip 분기 | step |

## F. 타겟팅 / 이동

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| F1 | CRIT | 이동 후 col은 **0..3 범위**로 클램프 | `moveUnit`: `clamp(col+delta, 0, 3)` | step |
| F2 | CRIT | 같은 편 두 유닛은 **같은 칸을 점유할 수 없음**(이동 충돌 시 이동 취소) | `moveUnit`: samePos 점유 검사 후 return | step |
| F3 | NORM | 목적지가 현재 칸과 같으면 이동 no-op(이벤트 없음) | `moveUnit`: `if (newCol===col) return` | step |
| F4 | NORM | 이동은 이동 효과(move) 보유 스킬/효과로만 발생 | skills/effects의 move 케이스만 moveUnit 호출 | step |

## G. 합법성 / step 입력

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| G1 | CRIT | 쿨다운 중이거나 빙결인 스킬 행동은 **거부(throw)** | `flow.ts step`: illegal action 검사 | action |
| G2 | CRIT | 알 수 없는 skillId는 거부(throw) | `step`: `if (!skill) throw` | action |
| G3 | NORM | 스킬 사용 즉시 쿨다운이 `skill.cooldown`으로 설정 | `step`: `actor.cooldowns[id] = skill.cooldown` | step |
| G4 | NORM | `phase !== inProgress` 또는 `current` 없으면 step은 no-op | `step` 초입 가드 | action |
| G5 | NORM | 쿨다운은 정규 턴 시작마다 1씩 감소(0 하한) | `onNormalTurnStart`: `if (cd>0) cd--` | step |

## H. 런 진행 (그래프 / 노드)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| H1 | CRIT | 이동은 **미방문 이웃으로만**(재방문 불가, 전진만) | `graph.ts liveReachable`: `!visited.has(n)` | step |
| H2 | CRIT | 모든 활성(도달 가능) 노드는 어떤 clear 노드로 **도달 가능**해야(아니면 비활성) | `canReachClear` 기반 liveReachable | step |
| H3 | CRIT | 변(edge)은 **헥스 인접 노드끼리만**(검증) | `validateFloor`: hexAdjacent 검사 | (검증) |
| H4 | CRIT | entry에서 어떤 clear에도 연결 안 되면 검증 실패 | `validateFloor` | (검증) |
| H5 | NORM | 클리어 노드 진입 = 층 종료(toFloor 분기 또는 게임 클리어) | `run.ts completeFloor` | step |
| H6 | NORM | 노드 core 시퀀스: 데코=즉시, combat/reward/shop/event=블록 후 advanceCore 복귀 | `layers.ts stepCore` | step |

## I. 경제 / 메타

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| I1 | CRIT | 골드 `≥ 0` (음수 불가) | `shop.ts buyShopOffer`: `if (gold < cost) return` 후 차감 | step |
| I2 | NORM | 구매 시 정확히 `cost`만큼 차감 + 항목 제거(재구매 방지) | `buyShopOffer`: 차감 + filter 제거 | step |
| I3 | NORM | 골드 부족 시 구매 no-op(차감·적용 없음) | `buyShopOffer` 가드 | step |
| I4 | NORM | 숙련도 tier 게이팅: 보유 숙련도 초과 tier 스킬은 상점/보상 진열에서 제외 | `shop.ts` tierOk | step |
| I5 | NORM | 전투 후 파티 HP가 런 상태로 반영(전투 사이 유지) | `resolveBattleEnd`: 파티 HP 동기화 | step |

## J. 종료성 / 결정론

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| J1 | CRIT | 모든 스트레스 런은 **유한 스텝 내** won/lost 도달(교착 없음) | `autoRun` guard(400)/bg(600) 패턴 | run |
| J2 | CRIT | **같은 시드 + 같은 행동 시퀀스 → 동일 이벤트 로그**(자기 일치) | Rng(seed) 단일 출처, Math.random 금지 | run |
| J3 | CRIT | 무작위 선택도 시드 결정적: 같은 스트레스 런 시드 → 같은 선택열 | 스트레스 런 러너가 state.rng(또는 별도 시드 rng) 사용 | run |
| J4 | CRIT | 스트레스 런 전체에서 크래시/패닉/throw **0건** | (측정 지표) | run |

---

## K. 수치 반올림 지점 (ULP 함정 — 포팅 시 정확 복제 대상)

> TS↔Rust 로그 일치를 위해 **반올림이 일어나는 모든 지점**을 목록화. 정수화 재설계 시 우선 검토.

| ID | 위치 | 연산 | 위험 |
|---|---|---|---|
| K1 | `computeDamage` | `Math.round(dmg)` (곱연산 동상·crit 후) | double 곱셈 후 반올림 — Rust f64 일치 필요 |
| K2 | `getFormationBonus` (총량보존 분배) | `총량 / 열원수` → 분수(`+4/3`) | 분배·합산 순서·반올림 시점 |
| K3 | `dealRawDamage` (공포) | `Math.floor(shield / mult)` | floor 경계 |
| K4 | heal/shield 효과 | `Math.round(eff.amount + def)` | 포메이션 def 분수 더한 후 반올림 |
| K5 | `healByDamage`/`reflectByDamage` | `Math.round(damage * pct / 100)` | 비율 반올림 |
| K6 | `ascii.ts round1` 등 표시 | 표시용(로그 비교엔 무관) | 표시 전용 — 비교 대상 아님 확인 |

**권고(검토 필요)**: K2가 가장 위험. 포메이션 분배를 **정수 누적(예: 총량을 정수로 두고 나눗셈 대신
몫·나머지 분배)** 으로 재설계하면 부동소수점 의존을 제거할 수 있음. 세션이 타당성 평가.

---

## L. 교차 검증 시 확인할 질문 (세션 산출물과 대조)

1. **누락**: 세션이 A~K 중 빠뜨린 카테고리/규칙이 있는가?
2. **과잉**: 세션이 불변식이라 본 것 중, 실제로는 "구현 세부"여서 비교 대상이 아닌 것은?
   (예: 함수 호출 순서, 내부 캐시) — §2.1 경계 위반 여부.
3. **해석 차이**: 같은 규칙을 다르게 술어화했는가? (특히 불사·공포·끼어들기 연쇄 등 미묘 케이스)
4. **근거 충돌**: 세션이 든 근거(파일:함수)가 이 문서와 다르면, 코드를 재확인.
5. **심각도 합의**: CRIT/NORM 분류가 일치하는가? (결정론·세이브 위협 = CRIT)
6. **검사 시점**: step / round / event / run 매핑이 일치하는가?
7. **수치 정책**: K(반올림 지점) 목록이 양쪽에서 동일한가? 정수화 권고에 동의하는가?

---

## M. 알려진 미해결 / 추가 조사 필요 (세션이 코드로 확정할 것)

- **상태이상 스택 상한**이 있는가? (applyStatusInstance의 중첩 규칙 — 본 리뷰에서 미확인)
- **쉴드 상한/지속 규칙** (설계 부록 B "쉴드 상세 미정") — 현재 코드상 무한 누적 여부 확인.
- **statMod 누적의 하한/상한** (예: 음수 speed 보정이 speed를 1 미만으로? → C4가 막는지 재확인).
- **applyStatusSelf vs applyStatus** 이중 적용 방지(광역 시 self 1회) — skills.ts 주석 근거 검증.
- **AI 정책(chooseAction)의 결정론** — 무작위 스트레스 런과 별개로, AI 경로도 시드 결정적인지.
