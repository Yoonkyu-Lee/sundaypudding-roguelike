# 불변식 카탈로그 — Claude Code 코드 리뷰 도출 (INVARIANTS-FROM-CLAUDE-CODE)

> **작성 방식**: `src/core/` 전 모듈 + `src/web/editor/`(저작 도구)를 8개 도메인으로 나눠 정독,
> **실제로 강제되(거나 강제되어야 하)는 규칙**만 근거(파일:함수)와 함께 도출. 기존 테스트·
> `INVARIANTS-FROM-REPO.md`를 참고하지 않고 **코드에서 독립적으로** 만들었다(오염 방지).
> 핵심 전투 흐름·서열·런 진행·끼어들기·포메이션은 작성자가 코드를 **직접 재확인**했다.
>
> **용도**: ① 불변식 assertion 모듈(`src/core/tests/invariants/`)의 명세. ② 무작위 캠페인 러너가
> 두들길 규칙. ③ 향후 Rust 포팅 시 differential harness의 비교 기준. ④ `INVARIANTS-FROM-REPO.md`와
> 교차 검증할 산출물(§ 마지막).
>
> **경계 정의(무엇을 보고 무엇을 안 보나)** — 설계 8.2 "결정 정보는 전부 observation에":
> - ✅ **비교/검사 대상**: 이벤트 로그 시퀀스(`GameEvent[]` 종류·순서·필드), Observation 노출값
>   (hp·shield·pos·statuses·cooldowns·서열·phase), 합법행동 목록, 경계 강제, 순서 보장, 자원 보존,
>   단조성, 종료성, 세이브 왕복 항등.
> - ❌ **검사 안 함**: 함수 호출 순서·변수명·메모리 레이아웃, 로그/관측에 안 남는 중간 계산.
>
> **검사 시점 표기**: `step`=매 행동 후 / `round`=라운드 경계 / `event`=이벤트 생성 시 /
> `campaign`=캠페인 종료(또는 전투/런 생성) 시 / `action`=step 입력 검증 시 / `validate`=생성·저장 게이트 /
> `op`=에디터 연산 단위 / `왕복`=직렬화·기하 round-trip.
>
> **심각도**: `CRIT`=위반 시 결정론/세이브/진행 손상(리플레이 발산) / `NORM`=규칙 위반이나 복구 가능.

---

# 목차

- **Part 1 — 전투 코어**: A 유닛 무결성 · B 죽음/불사 · C 턴/서열 · D 데미지/쉴드 · E 상태이상 ·
  F 타겟팅/이동 · G 합법성/step · H 끼어들기 · I 패시브 룰엔진 · J 관측 · K 포메이션
- **Part 2 — 런 진행**: L 그래프/도달성 · M 노드 시퀀서/진행 · N 경제·메타(상점/인카운터/보상/장착) ·
  O 세이브 왕복 · P 모험 패시브
- **Part 3 — 결정론/순수성(가로지름)**: Q RNG · R AI 정책 · S 코어 순수성 · T 종료성
- **Part 4 — 에디터 정합성(저작 도구)**: U ops 순수 변이 · V 헥스 기하 · W 템플릿/store/스키마
- **Part 5 — 수치 반올림 지점(ULP)**
- **Part 6 — 코드 리뷰로 발견한 잠재 결함/모호 지점**
- **Part 7 — `INVARIANTS-FROM-REPO.md` 교차 검증 메모**

---

# Part 1 — 전투 코어 (`src/core/combat/`)

## A. 유닛 상태 무결성

| ID | 심각도 | 규칙 (술어) | 근거 | 시점 |
|---|---|---|---|---|
| A1 | CRIT | 모든 유닛 `hp ≥ 0` | `damage.ts:dealRawDamage` `hp=Math.max(0, hp-toHp)`; `status.ts` heal `Math.min(hpMax,…)` | event |
| A2 | CRIT | 모든 유닛 `hp ≤ hpMax` | `skills.ts` heal·`status.ts` HoT `Math.min(hpMax, hp+amt)` | event |
| A3 | NORM | `shield ≥ 0` (산술 불변: `toShield ≤ shield`) | `damage.ts:dealRawDamage` absorbable=`floor(shield/mult)`, toShield≤shield | event |
| A4 | CRIT | `alive=false ⟺ (hp≤0 ∧ ¬saved)`; 불사 구제 시 `hp=1, alive=true` | `damage.ts:dealRawDamage` `died=hp<=0 && !saved` | event |
| A5 | NORM | 전투 중 `alive`는 단조 비증가(이 경로에 부활 없음) | `dealRawDamage`에만 alive→false 전이, →true 경로 없음 | event |
| A6 | CRIT | uid는 전투 내 유일·결정론(`${side[0]}${idx}_${charId}`) | `state.ts:makeUnit` | campaign |
| A7 | NORM | 생성 직후 `shield=0 ∧ 0<hp≤hpMax ∧ alive=true` | `state.ts:makeUnit` `hp:growth?.hp ?? maxHp, shield:0` | campaign |
| A8 | NORM | `activeSkillIds.length ≤ 4` | `state.ts:makeUnit` `c.skillIds.slice(0,4)` (2.3) | campaign |

> A1·A2·A4는 데미지/힐을 실제로 적용하는 `damage.ts`/`status.ts`/`skills.ts`에서 강제된다(전투 흐름 모듈엔 hp 감산 없음). A8은 `growth.activeSkillIds`가 4 초과로 주입되면 위반 가능 — 런 계층(`createRun`) 책임(→ L/N 참조).

## B. 죽음 / 생존 / 불사

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| B1 | CRIT | 죽은 유닛은 정규/끼어들기 턴을 받지 않음(`current`는 항상 alive) | `turnOrder.ts:advance` `if(!u.alive) continue` | step |
| B2 | NORM | 죽은 유닛 칸은 `roundOrder`에서 제거 안 됨(회색 잔존) | `advance` 주석 "칸은 타임라인에 남음" | round |
| B3 | CRIT | 불사(undying) 보유 시 hp≤0 도달분은 1로 보정, 그 step 사망 안 함 | `dealRawDamage` `if(hp<=0 && hasStatus undying){hp=1; saved=true}` | event |
| B4 | NORM | `death` 이벤트는 유닛당 생애 1회 | `died=hp<=0 && !saved`, alive 토글 후 재진입 없음 | event |
| B5 | NORM | 불사는 피해를 막지 않음(쉴드/HP는 정상 소모, 0 이하 도달만 1로 구제) | `dealRawDamage`(invincible과 별개 분기) | event |

## C. 턴 / 라운드 서열

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| C1 | CRIT | 라운드 시작 시 정규(normal) 엔트리 = 그 시점 생존 유닛과 1:1 | `turnOrder.ts:startRound` `aliveUnits(state).map(...)` | round |
| C2 | CRIT | 서열 정렬: `ACTION_CONST/speed` 오름차순, **동점은 uid 사전순** | `startRound` `if(av!==bv) return av-bv; return a.uid<b.uid?-1:1` | round |
| C3 | CRIT | `speed = max(1, roll+speedMod)` (속도 하한 1, 0 나눗셈 방지) | `startRound` `speed:Math.max(1, roll+speedMod)` | round |
| C4 | NORM | `sMax = max(sMin, speedMax+mod)`(rng.int 범위 역전 방지) | `startRound` | round |
| C5 | CRIT | 커서(cursor)는 라운드 내 **단조 증가**, length 도달 시에만 새 라운드 | `advance` `state.cursor++`; `cursor>=length → startRound` | step |
| C6 | NORM | `round`는 startRound마다 +1, 감소 없음(생성=0→첫 라운드 1) | `startRound` `state.round++` | round |
| C7 | CRIT | `current≠null ⇒ current === roundOrder[cursor] ∧ unitById(current).alive` | `advance` `next=roundOrder[cursor]; current=next` | step |
| C8 | CRIT | 쿨타임 **감소**(−1)는 정규 턴 시작에서만(끼어들기 제외) | `advance` `if(next.kind==="normal") onNormalTurnStart`; `onNormalTurnStart` cd−− | step |
| C9 | NORM | 모든 쿨타임 `≥ 0` | `onNormalTurnStart` `if(cd>0) cd--`(0에서 안 내림) | step |
| C10 | NORM | turnCount++·turnStart 틱·turnStart 트리거는 **정규 턴에서만** | `advance` interrupt 분기는 `interruptStart`만; `onNormalTurnStart`에 카운트 | step |
| C11 | NORM | 상태 duration 차감·turnEnd 효과는 **정규 턴 종료 + 행동자 생존** 시만 | `flow.ts:step` `if(kind==="normal" && actor.alive) onNormalTurnEnd`; `onNormalTurnEnd` 내 `if(u.alive)` | step |
| C12 | NORM | 정규 턴 종료 후 `duration≤0 ∨ stacks≤0` 상태는 제거 | `onNormalTurnEnd` `filter(s.duration>0 && s.stacks>0)` | round |

## D. 데미지 / 쉴드

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| D1 | CRIT | 최종 데미지 `≥ 0` ∧ 정수 | `damage.ts:computeDamage` `Math.max(0, Math.round(dmg))` | event |
| D2 | CRIT | 피해는 **쉴드 먼저, HP 다음**(관통/공포 외) | `dealRawDamage` 구조(shield 블록 선행) | event |
| D3 | CRIT | 관통(pierce, **공격자** 보유)은 쉴드 무시·전량 HP | `dealRawDamage` ignoreShield 분기; `skills.ts` `ignoreShield:hasStatus(actor,"pierce")` | event |
| D4 | NORM | 공포(fear) N: 쉴드 `mult=max(1,N)`배 잠식, **HP 효율 불변**(remaining는 흡수 피해량만 차감) | `dealRawDamage` absorbable/toShield 계산 | event |
| D5 | CRIT | 무적(invincible) 대상은 피해 0(hp·shield 불변), 로그 final=0 | `dealRawDamage` 초입 early-return | event |
| D6 | NORM | `!alive ∨ finalAmount≤0` ⇒ no-op(상태 불변·로그 없음) | `dealRawDamage` `if(!target.alive || finalAmount<=0) return` | event |
| D7 | NORM | 동상(frost, **공격자**) 보유 시 곱연산 ×0.5(반올림 전) | `computeDamage`; `statuses.ts` frost `damageDealtMult:0.5` | event |
| D8 | NORM | `previewDamage` = 비크리 기준 합과 동일(결정론, 분기 공유) | `damage.ts:previewDamage`(computeDamage 재사용, crit=false) | (테스트) |
| D9 | NORM | `previewHpLoss.hpLoss ∈ [0, target.hp]` | `previewHpLoss` `Math.min(target.hp, …)` | (테스트) |

## E. 상태이상

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| E1 | CRIT | `duration≤0 ∨ stacks≤0` 상태는 정규 턴 종료 후 제거(=C12) | `turnOrder.ts:onNormalTurnEnd` | round |
| E2 | CRIT | duration 차감은 **정규 턴 종료에만**(끼어들기로 안 줄어듦) | `onNormalTurnEnd`에서만 `s.duration--` | round |
| E3 | NORM | DoT 트리거 시점 고정: 화상=`turnEnd`, 중독=`turnStart`, 출혈=`onAction` | `statuses.ts` dot.trigger + `tickPeriodic` 호출처 | step/round |
| E4 | NORM | 출혈(onAction)은 **정규+끼어들기 모든 스킬 행동**에서 발동(skip 제외) | `flow.ts:step` `tickPeriodic(…,"onAction")`(kind 분기 밖) | action |
| E5 | NORM | 재생(regen) HoT=`turnEnd`, 회복 후 `hp ≤ hpMax` | `statuses.ts` hot.trigger; `status.ts` `Math.min(hpMax,…)` | round |
| E6 | NORM | 동일 트리거에서 **HoT가 DoT보다 먼저** 적용 | `status.ts:tickPeriodic` heal 루프 후 dmg 루프 | round |
| E7 | NORM | defId별 DoT/HoT는 `Σ(stacks*perStack)`로 1회 적용; 합≤0이면 무시 | `tickPeriodic` Map 누적, `continue` if amt≤0 | round |
| E8 | CRIT | DoT 처리 중 대상 사망 시 잔여 DoT 중단 | `tickPeriodic` `if(!u.alive) break` | round |
| E9 | CRIT | 죽은 유닛엔 주기 틱 미적용 | `tickPeriodic` `if(!u.alive) return` | round |
| E10 | CRIT | 정화(cleanse)는 **buff=true만 잔존**, 나머지 제거 | `skills.ts`·`passives/effects.ts` `filter(STATUS_DEFS[id].buff)` | event |
| E11 | NORM | `applyStatusInstance`는 병합 없이 **항상 새 인스턴스 push**(스택 상한 없음) | `status.ts` `target.statuses.push(inst)` | event |
| E12 | NORM | speedMod 부호: 양수=서열 앞, 음수=뒤(마비=−3) | `util.ts:statusNumSum`; `statuses.ts` paralyze `-3` | round |
| E13 | NORM | hasStatus/statusFlag는 `stacks>0` 인스턴스 보유로만 참 | `util.ts` `s.stacks>0` 필터 | event |

> **비대칭 주의**(→ Part 6): `totalStacks`/`statusNumSum`은 `stacks>0` 필터 없이 합산하나, `hasStatus`/`statusFlag`는 `stacks>0`을 요구한다. 현재 stacks<0 경로는 없으나 입력 불변식 "stacks≥0"을 둘 가치 있음.

## F. 타겟팅 / 이동

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| F1 | NORM | validTargets는 target 마스크 준수(self=actor, enemy=반대편, ally=같은편) ∧ 모두 alive | `targeting.ts:validTargets` | action |
| F2 | NORM | reach 정의 스킬의 타겟 col ∈ `reachableColumns`(전열부터 연속 reach칸) | `validTargets` `cols.has(c.pos.col)` | action |
| F3 | NORM | reachableColumns: 대상편 생존·reach>0이면 `[front..front+reach-1]`, 아니면 `[]` | `reachableColumns` | action |
| F4 | CRIT | computeAreaCells는 순수·결정론, 모든 칸 `0≤row<rows ∧ 0≤col<cols` | `targeting.ts:computeAreaCells` push 가드 | action |
| F5 | NORM | areaTargets ⊆ {alive ∧ 대상편 ∧ footprint 점유}; `area="all"`=validTargets | `areaTargets` | action |
| F6 | CRIT | computeHitChance ∈ `[0,100]` 정수; `alwaysHit ∨ target≠"enemy"` ⇒ 100 | `computeHitChance` `clamp(round(...),0,100)` | action |
| F7 | CRIT | moveUnit 후 `0 ≤ col ≤ 3`(클램프) | `skills.ts:moveUnit` `clamp(col+delta,0,3)` | event |
| F8 | NORM | 클램프 목적지=현재 col이면 no-op(move 이벤트 없음) | `moveUnit` `if(newCol===col) return` | event |
| F9 | CRIT | 같은 편 두 유닛은 같은 칸 점유 불가(점유 시 이동 취소) | `moveUnit` blocked 검사 후 return | event |
| F10 | CRIT | 실제 이동 시에만 `move` 이벤트(from→to) 1건 + onMove·enterCell 트리거 | `moveUnit` push + fireTrigger | event |

> F7: col 상한 3은 하드코딩(`sideDims`는 더 넓은 그리드 허용) — 광폭 배치 시 불일치 가능(→ Part 6).

## G. 합법성 / step 입력

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| G1 | CRIT | phase≠inProgress ∨ !current ⇒ step은 no-op(상태·로그 불변) | `flow.ts:step` 초입 가드 | action |
| G2 | CRIT | 쿨다운>0 ∨ 빙결인 스킬 행동은 throw | `step` `if(cd>0 || isFrozen) throw` | action |
| G3 | CRIT | 미지 skillId는 throw | `step` `if(!skill) throw` | action |
| G4 | NORM | 스킬 사용 즉시 `cooldowns[id]=skill.cooldown`(끼어들기서도 설정), 해소 전 | `step` `actor.cooldowns[id]=skill.cooldown; resolveSkill(...)` | action |
| G5 | NORM | skip reason: `frozen > chosen(쓸스킬있음) > noUsableSkill` | `step` 삼항 체인 | action |
| G6 | CRIT | 진행 중이면 getLegalActions는 빈 배열 불가(최소 skip 1개) | `targeting.ts:getLegalActions` 끝 `out.push({type:"skip"})` | action |
| G7 | CRIT | 빙결이면 getLegalActions=정확히 1개 skip("스킵 (빙결)") | `getLegalActions` `if(isFrozen) return [skip]` | action |
| G8 | NORM | 각 합법 스킬행동: cd=0 ∧ active≠false ∧ usableFrom 충족 ∧ validTargets≠∅ | `getLegalActions` continue 가드들 | action |
| G9 | NORM | 합법행동의 hitChance === computeHitChance(동일 인자) | `getLegalActions` `hitChance:computeHitChance(...)` | action |
| G10 | NORM | onAction(출혈)으로 행동자 사망 시 스킬효과·끼어들기·턴종료 미실행 | `step` 후속 블록 `if(actor.alive)` 가드 | action |

## H. 끼어들기

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| H1 | CRIT | predictInterruptSubjects는 순수·결정론(실행=미리보기 동일 함수) | `interrupt.ts` 주석 + 무난수 | action |
| H2 | NORM | 주체 = 스킬 grantsInterrupt(self/target) ++ 버프(grantsInterrupt∧stacks>0, 보유자) | `predictInterruptSubjects` | action |
| H3 | CRIT | 끼어들기 칸은 모두 `cursor+1`에 삽입, subjects 순서 보존(역순 splice) | `insertInterrupts` `splice(cursor+1,0,…)` | step |
| H4 | CRIT | 끼어들기는 **정규 턴 행동에서만** 생성(연쇄 방지) | `flow.ts:step` `if(entry.kind==="normal"){…insertInterrupts}` | step |
| H5 | NORM | 삽입 칸은 `kind:"interrupt", speed:0`; 끼어들기 턴은 차감/주기효과 없음(=C10/C11) | `insertInterrupts`; `flow`/`turnOrder` 분기 | step |
| H6 | NORM | 삽입 주체 1개당 `interrupt` 이벤트 1개(개수 일치) | `insertInterrupts` `log.push({t:"interrupt",uid})` | step |

> **H6 주의**(→ Part 6): `interrupt` 이벤트 로그는 **역순**으로 push된다(splice 역순 루프 내부에서 로그). `roundOrder` 실행 순서는 정방향 보존되지만, 로그 재생(애니메이션) 순서는 주체 역순. 결정론은 유지(같은 시드→같은 역순)되나 관측 순서가 실행 순서와 어긋남.

## I. 패시브 / 특성 룰엔진 (`combat/passives/`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| I1 | CRIT | 매칭 룰 실행 순서 완전정렬: `(orderIndex, owner.uid, rule.idx)` 3-튜플 | `dispatch.ts:fireTrigger` `.sort((a,b)=>a.ord-b.ord \|\| uid \|\| a.cr.idx-b.cr.idx)` | event |
| I2 | CRIT | 재진입 가드: `${ownerUid}#${idx}` 실행 중 동일 키 재발동 금지, finally 해제 | `fireTrigger` `if(activeKeys.has(key)) continue; try{…}finally{delete}` | event |
| I3 | CRIT | 재귀 깊이 `< MAX_DEPTH(4)`; depth는 finally로 복구(발화 사이 0) | `fireTrigger` `if(depth>=4) return; depth++; finally depth--` | event |
| I4 | CRIT | castSkill 정적 게이트: 모든 passives/traits의 castSkill 대상은 존재 ∧ leaf(passives 없음) | `validate.ts:validateCastSkill`(check 게이트 호출) | validate |
| I5 | CRIT | castSkill 런타임: `!sk ∨ sk.passives≠∅ ∨ !owner.alive`면 미시전 | `effects.ts:applyEffect` castSkill 분기 | event |
| I6 | NORM | maxPerTurn/maxPerBattle 한도 초과 시 발동 스킵; 카운터는 정규 턴 시작에 turn분 리셋 | `fireTrigger` 카운터; `onUnitTurnStart` `firedThisTurn=0` | step/event |
| I7 | CRIT | 조건 평가 결정론: `conds.every`(AND), 빈/누락=true, who 대상 없으면 false | `conditions.ts:evalConditions` | event |
| I8 | CRIT | rng 소비는 조건 chance·randomEnemy/randomAlly 타겟·rerollSpeed뿐(모두 state.rng) | `conditions.ts`/`effects.ts`/`dispatch.ts` | event |
| I9 | NORM | 전투 스코프에서 run 스코프 조건(nodeTypeIs/goldAtLeast)=항상 false | `conditions.ts` `return false` | event |
| I10 | NORM | 전투 스코프에서 run 스코프 효과(goldDelta/healParty/grantRunStatus)=no-op | `effects.ts` `break` | event |
| I11 | CRIT | speedRoll 패시브: rolls 순서 → idx 정렬 적용, `speed=max(1, roll+speedMod)` | `dispatch.ts:applySpeedRollPassives` | round |
| I12 | NORM | heal/shield/applyStatus/move/healByDamage/castSkill 효과는 죽은 대상 보호 | `effects.ts` 각 `if(!tgt.alive)` 가드 | event |
| I13 | NORM | fireTrigger 대상=살아있는 유닛(예외: battleEnd 전체, death 당사자) | `fireTrigger` deadOk | event |
| I14 | CRIT | compileRules idx 안정·결정론: 활성스킬 passives → traitIds 순, idx 0부터 유일 | `compile.ts:compileRules` | campaign |
| I15 | NORM | 관측 가능 상태 변경 효과는 대응 이벤트 로그 동반(heal/shieldGain/cleanse/move/dialog) | `effects.ts` 각 push; damage/applyStatus는 하위 파이프 위임 | event |

> I3 비고: `depth`·`activeKeys`는 **모듈 전역 싱글톤**. 코어는 단일 스레드 동기 실행 전제라 현재 안전하나, harness가 한 프로세스에서 두 전투의 fireTrigger를 인터리브하면 오염 가능 — 캠페인 러너는 직렬 실행(→ Part 6).

## J. 관측 (observation)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| J1 | CRIT | obs.round/phase/cursorIndex/order === state 동명 필드(order는 복사본) | `observation.ts:buildObservation` | action |
| J2 | NORM | allies+enemies = units 전체 분할(누락·중복 없음) | `buildObservation` side filter | action |
| J3 | NORM | 상태칩 집계: defId별 stacks 합, duration=max, nextChange=min | `viewStatuses` | action |
| J4 | NORM | UnitView는 hp·hpMax·shield·pos·alive·cooldowns·formation 그대로 노출(숨김 0) | `viewUnit` | action |

## K. 포메이션

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| K1 | CRIT | **분수 단계 총량보존**: 한 열의 살아있는 동편 유닛에 `total/count` 균등분배, 합=total | `formation.ts:getFormationBonus` | action |
| K2 | NORM | `!layout ∨ total=0 ∨ count=0` ⇒ 보너스 0 | `getFormationBonus` 가드 | action |
| K3 | NORM | 원천 레이아웃은 side로 선택(ally=allyFormation, enemy=enemyFormation) | `getFormationBonus` | action |
| K4 | NORM | enemyFormation은 보스전에서만 비-null | `state.ts:createBattle` `enc.boss ? … : null` | campaign |

> **K1 주의**(→ Part 6): 총량보존은 **반올림 전 분수 단계에서만** 성립한다. 소비처(`computeDamage`/shield/heal의 `Math.round`)에서 유닛별로 반올림되므로 **반올림 후 유닛별 합 ≠ total**일 수 있다(누적 오차). 결정론은 유지되나 "엔진이 정수 총량보존을 보장한다"고 단언 불가.

---

# Part 2 — 런 진행 (`src/core/run/`)

## L. 그래프 / 도달성 (`graph.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| L1 | CRIT | 모든 변은 헥스 6방향 인접 노드쌍만 연결 | `validateFloor` `if(!hexAdjacent(a,b)) error`; `hexAdjacent` HEX_DIRS 6 | validate |
| L2 | CRIT | 모든 변의 두 끝점 id가 nodes에 실재 | `validateFloor` (dangling 검사) | validate |
| L3 | CRIT | 각 층은 nodes에 존재하는 entryNodeId 보유 | `validateFloor` | validate |
| L4 | CRIT | 각 층은 clear 노드 ≥1개 | `validateFloor` `if(clears.length===0)` | validate |
| L5 | CRIT | entry 연결성분 안에 clear ≥1개(entry→clear 도달 가능) | `validateFloor` reachableFromEntry | validate |
| L6 | NORM | 모든 노드는 entry 연결성분에 속함(고립 노드 금지) | `validateFloor` deadNodes=∅ | validate |
| L7 | CRIT | `reachable` ⊆ {현재 노드 이웃 ∧ 미방문 ∧ canReachClear(visited 회피)} | `liveReachable` filter | step |
| L8 | CRIT | `reachable ∩ visited = ∅`(재방문 불가·전진만) | `liveReachable` `!visited.has(n)` | step |
| L9 | CRIT | validateRun: entryFloor에서 toFloor BFS로 전 층 도달 ∧ 승리 clear(no toFloor) ≥1 ∧ 모든 toFloor 실재 | `validateRun` | validate |

## M. 노드 시퀀서 / 진행 (`run.ts` · `helpers.ts` · `layers.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| M1 | CRIT | enterNode는 `phase==="map" ∧ nodeId∈reachable`일 때만 동작 | `run.ts:enterNode` 가드 | event |
| M2 | CRIT | clear 노드 진입 = 즉시 completeFloor(시퀀서 밖) ∧ visited 추가 | `enterNode` `if(n.type==="clear"){…completeFloor;return}` | event |
| M3 | CRIT | completeFloor: 실재 toFloor면 그 층(부활+50%회복), 아니면 phase="won" | `completeFloor` `nextIdx<0 → won` | campaign |
| M4 | CRIT | 층 전환 시 visited=[entry], current=entry, active=null, battle=null, reachable 재계산 | `completeFloor` | campaign |
| M5 | CRIT | resolveBattleEnd 게이트: `phase=battle ∧ battle ∧ battle.phase≠inProgress`; 파티 hp=max(0, allyUnit.hp) | `resolveBattleEnd` | event |
| M6 | CRIT | enemyWin ⇒ phase="lost"(흡수 상태) | `resolveBattleEnd` | event |
| M7 | CRIT | 비전멸 전투 종료: coreCursor≠null이면 advanceCore, null이면 +gold·reward(레거시) | `resolveBattleEnd` | event |
| M8 | CRIT | `gold ≥ 0` 항상(전 차감 경로 가드/클램프) | `resolveBattleEnd`·`helpers`·`encounter`·`shop` `Math.max(0,…)`/잔액 가드 | step |
| M9 | CRIT | 데코=즉시 소비·전진, 상호작용(combat/reward/shop/event)=phase 전환·블록 | `layers.ts:stepCore` | step |
| M10 | CRIT | 각 블록 상호작용은 해소 함수에서 advanceCore 또는 completeNode 한쪽으로만 복귀(advanceCore 전 battle=null·cursor++) | `advanceCore`·resolve/choose/leave 패턴 | event |
| M11 | CRIT | core 소진 ⇒ finishCore(cursor=null) ∧ completeNode ∧ phase="map" | `stepCore`/`finishCore` | step |
| M12 | NORM | nodeCore(n) = 인라인 core(비어있지 않으면) 아니면 defaultCore(type) | `layers.ts:nodeCore` | step |
| M13 | CRIT | visited는 층 내 단조 증가·무중복, 층 전환 시에만 [entry] 리셋 | `completeNode`·`completeFloor` | step |
| M14 | CRIT | `coreCursor≠null ⇒ activeNodeId≠null ∧ phase∈{battle,reward,shop,encounter}`; `phase="map" ⇒ coreCursor=null` | `layers`/`run` 시퀀서 상태 | step |
| M15 | NORM | activeNodeId: phase="map"이면 null, 블록 phase면 non-null | `enterNode`/`completeNode`/`completeFloor` | step |
| M16 | NORM | movePartyMember/setActiveSkill은 phase="battle"이면 no-op | `run.ts` `if(phase==="battle") return` | event |
| M17 | NORM | `activeSkillIds ⊆ ownedSkillIds ∧ 1 ≤ len ≤ 4` | `createRun`·`setActiveSkill`·`learnOwned` | event |
| M18 | NORM | 편성 pos: `0≤row≤3 ∧ 0≤col≤3`, 두 멤버 같은 칸 불가(swap) | `movePartyMember` 경계·swap | event |
| M19 | NORM | chooseReward 게이트(phase=reward ∧ 선택지 존재), 적용 후 rewards=null(중복수령 불가) | `chooseReward` | event |
| M20 | CRIT | healParty: 부활(revive)은 항상 `hp≥1`, 생존자 회복은 `hp≤maxHp`, ¬revive면 전투불능 유지 | `helpers.ts:healParty` `Math.max(1,…)`/`Math.min(maxHp,…)` | event |
| M21 | NORM | 전투 참가 = `hp>0` 멤버만 ally 투입 | `layers.startCombat` `party.filter(m=>m.hp>0)` | event |
| M22 | NORM | grantStatus 데코의 pendingStatuses는 전투 시작 시 1회 주입 후 `{}` 리셋 | `startCombat` 주입 후 `pendingStatuses={}` | event |

## N. 경제 · 메타 (상점/인카운터/보상/장착)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| N1 | NORM | 골드<cost면 구매 완전 no-op(전 상태 불변·항목 잔존) | `shop.ts:buyShopOffer` `if(gold<cost) return` | step |
| N2 | CRIT | 성공 구매는 정확히 cost 차감(gold_after=gold−cost≥0) | `buyShopOffer` `run.gold-=cost` | step |
| N3 | NORM | 구매 성공 시 그 오퍼 진열에서 제거(재구매 불가) | `buyShopOffer` filter | step |
| N4 | NORM | useMastery on: 절차생성 upgrade/learn 오퍼 tier ≤ unlockedTier(masteryLevel) | `shop.ts:generateProcedural` tierOk | step |
| N5 | CRIT | generateShop/genRewards 추첨은 state.rng만 사용(동일 RunState→동일 진열) | `shop.ts`·`rewards.ts` `run.rng.int(...)` | step |
| N6 | NORM | 저작 learn 오퍼는 charId가 살아있는 편성 파티원일 때만 진열 | `shop.ts:materializeOffers` 가드 | step |
| N7 | CRIT | 인카운터 hurt는 생존자 hp를 1 미만으로 못 떨굼(인카운터사 방지) | `encounter.ts:applyOutcome` `Math.max(1,…)` | step |
| N8 | NORM | 인카운터 gold 결과는 `Math.max(0,…)` 클램프 | `applyOutcome` | step |
| N9 | CRIT | 도박 승패는 state.rng.chance로만 결정, win/lose outcome 정확 적용 | `chooseEncounterOption` `run.rng.chance(...)` | step |
| N10 | NORM | 인카운터 해소는 1회·encounter=null 후 진행(중복 적용 불가) | `chooseEncounterOption` 가드+null | step |
| N11 | NORM | 장착은 비전투 ∧ 아이템존재 ∧ 슬롯일치 ∧ 인벤보유일 때만 | `items.ts:equipItem` 가드들 | step |
| N12 | CRIT | 장착/해제는 아이템 총량(인벤∪장착) 보존(기존 장착품 인벤 복귀) | `equipItem`/`unequipItem` splice/push | step |
| N13 | NORM | 장착 후 maxHp=base+Σ(장착 mods.hp); hp는 증가분만 부여·감소분 클램프·전투불능 부활 안 함 | `items.ts:recomputeHp` | step |
| N14 | NORM | genRewards 옵션 수 = `3+clamp(tier−1,0,2)`; 풀 부족분은 30% 회복으로 패딩 | `rewards.ts:genRewards` | step |
| N15 | NORM | 강화로 상위 티어 보유한 라인의 베이스는 learn 후보로 재출현 안 함(다운그레이드 방지) | `rewards.ts` `ownsUpgradeLine` | step |
| N16 | NORM | 보상/강화/학습 후보는 살아있는 파티원에서만 산출 | `rewards.ts`·`encounter.ts` `hp>0` 필터 | step |

## O. 세이브 왕복 (`save.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| O1 | CRIT | `deserializeRun(serializeRun(run))`는 값 동등 RunState 복원(deep-equal) | `save.ts` JSON replacer + reviveRng | validate |
| O2 | CRIT | 모든 Rng는 `{__rng:state}`로 치환·복원: 복원 후 `instanceof Rng ∧ state 동일` | `reviveRng` 깊은 순회 | validate |
| O3 | NORM | 파싱 불가/손상 JSON은 throw 없이 null 반환 | `deserializeRun` try/catch | validate |

> O1 전제: RunState가 **순수 JSON-safe(+Rng)** 여야 한다(undefined/Map/Set/NaN/Infinity/함수 없음). 새 필드 추가 시 이 전제가 깨지면 조용히 손상 — harness가 캠페인 단계마다 왕복 등가성을 검사할 최우선 대상.

## P. 모험 패시브 (`run/passives.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| P1 | CRIT | fireRunTrigger 재진입 가드(firing): 중첩 호출 즉시 return, finally 해제 | `passives.ts` `if(firing) return; finally firing=false` | step |
| P2 | CRIT | 실행 순서 결정론: 파티 순서 → 룰 idx, 살아있는 멤버만, chance는 run.rng | `fireRunTrigger` | step |
| P3 | NORM | run 패시브 효과 클램프: gold≥0, hp≤maxHp(생존자) | `passives.ts:applyRunEffect` | step |
| P4 | NORM | getRunView는 순수 읽기(상태 불변), 노드 status는 배타 우선순위(current>reachable>active>visited>locked) | `view.ts:getRunView` | validate |

---

# Part 3 — 결정론 / 순수성 (가로지름)

## Q. RNG (`rng.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| Q1 | CRIT | 같은 시드 → 같은 호출 수열에 같은 난수열(외부 의존 0, mulberry32) | `rng.ts` constructor+next() | campaign |
| Q2 | CRIT | state 복원/clone 후 동일 수열(단일 number 상태=직렬화 가능) | `rng.ts:clone` | campaign |
| Q3 | NORM | `int(min,max) ∈ [min,max]` 닫힌구간 정수(상한 초과 불가) | `rng.ts:int` `min+floor(next()*(max-min+1))` | action |
| Q4 | NORM | `max<min`이면 int=min(빈 구간 폴백) | `rng.ts:int` 가드 | action |
| Q5 | NORM | `chance(≤0)=false`, `chance(≥100)=true`(next()*100 < pct, next()<1) | `rng.ts:chance` | action |
| Q6 | NORM | 생성자 시드 정규화 `state=(seed>>>0)` | `rng.ts` | campaign |

## R. AI 정책 (`ai/policy.ts` · `ai/profile.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| R1 | CRIT | chooseAction은 rng 미사용·순수(동일 state→동일 Action) | `policy.ts`(rng import 0) | action |
| R2 | CRIT | greedy 동점은 합법행동 앞 인덱스 우선(strict `<`) | `policy.ts` `if(score<bestScore)` | action |
| R3 | CRIT | applyRule 동점은 앞 인덱스 우선(strict `>`, NEGATIVE_INFINITY 초기) | `profile.ts` | action |
| R4 | CRIT | applyProfile은 rules 위→아래, 첫 (조건참 ∧ 행동존재) 룰 채택(순서=우선순위) | `profile.ts` for-of 첫 non-null | action |
| R5 | NORM | 룰 if는 AND, 빈/없음=참 | `profile.ts` `!conds \|\| every` | action |
| R6 | NORM | 프로파일 없음/룰 무산 시 greedy fallback; legal 비면 skip | `policy.ts` | action |
| R7 | NORM | profile 점수/조건 함수는 순수(시간/난수/IO 0, div0 가드) | `profile.ts` | action |

> R1/R2는 상류 `getLegalActions`의 행동 순서 결정론(G6~G9)에 의존한다.

## S. 코어 순수성 (전수 스캔)

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| S1 | CRIT | `src/core/`에 `Math.random`/`Date.now`/`new Date`/`performance`/`crypto`/`setTimeout` 없음 | 전수 grep 매치 0(rng.ts의 Math.imul/floor는 결정론 산술=예외) | 전수스캔 |
| S2 | CRIT | `src/core/`에 console/process/document/window/readline/require/fs 없음 | 전수 grep 매치 0 | 전수스캔 |

> S1·S2는 현재 **위반 0건**으로 이미 성립. `npm run check`의 코어순수성 가드가 이를 강제 — assertion 인프라는 회귀 게이트로 유지만 하면 된다.

## T. 종료성

| ID | 심각도 | 규칙 | 근거 | 시점 |
|---|---|---|---|---|
| T1 | CRIT | step 1회는 유한 시간에 반환(끼어들기 normal-only=H4로 무한연쇄 차단) | `flow.ts`+`turnOrder.ts:advance` | action |
| T2 | CRIT | 같은 시드+행동 시퀀스 → 동일 이벤트 로그(자기 일치) | Rng 단일출처(S1)+결정론 정렬(I1/I14/C2) | campaign |
| T3 | CRIT | 무작위 선택도 시드 결정적: 같은 캠페인 시드 → 같은 선택열 | 캠페인 러너가 별도 결정 시드 rng 사용 | campaign |
| T4 | CRIT | 모든 캠페인은 유한 스텝 내 종료(won/lost), 교착 0 | 스텝 가드 + 진행 단조성(M13/L8) | campaign |
| T5 | CRIT | 캠페인 전체에서 크래시/throw 0건 | (측정 지표) | campaign |

> T1 형식 코너(→ Part 6): "모든 생존자가 매 advance의 턴시작 효과로 즉시 사망"하면 이론상 루프 가능하나, checkWin이 phase 전이 후 advance를 early-return시켜 실전 무해. 형식 종료성 증명 시 검토.

---

# Part 4 — 에디터 정합성 (`src/web/editor/`, `src/web/hexgeo.ts`)

> **이 도메인은 게임 엔진이 아니라 저작 도구의 정합성**이다 — "에디터가 만들어내는 데이터/연산이 올바른가". 대부분 **순수 함수**라 DOM 없이 단위 테스트 가능(테스트 용이성 표기).

## U. ops 순수 변이 (`ops.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 | 테스트 |
|---|---|---|---|---|---|
| U1 | CRIT | addNode/addNodeFromTemplate 부여 id는 드래프트 전체 유일(Date.now+counter 단조) | `ops.ts:newNodeId` | op | 쉬움 |
| U2 | CRIT | addNode/template/moveNode는 점유된 (q,r)엔 no-op(좌표 유일성) | `ops.ts` `if(nodeAt(...)) return` | op | 쉬움 |
| U3 | NORM | moveNode는 q,r만 변경(type/core/layers/label/id 불변) | `ops.ts:moveNode` `n.q=q; n.r=r` | op | 쉬움 |
| U4 | CRIT | 모든 변이 후 edges의 모든 변은 헥스 인접쌍(비인접 변 없음) | `moveNode`/`moveNodes`/`toggleEdge`/`autoConnect` 인접 강제 | op | 쉬움 |
| U5 | NORM | autoConnectAdjacent는 인접 노드와 변 보장·멱등(중복 추가 없음) | `ops.ts` `hasEdge` 가드 | op | 쉬움 |
| U6 | NORM | adjacentPairs는 무방향 인접쌍 전수·무중복(i<j 상삼각) | `ops.ts:adjacentPairs` | op | 쉬움 |
| U7 | NORM | 빈 변 상태 전체 autoConnect 결과 = adjacentPairs 집합(교차 정합) | 둘 다 hexAdjacent 기준 | 왕복 | 쉬움 |
| U8 | CRIT | moveNodes가 false(충돌)면 어떤 좌표도 안 변함(원자적 취소) | `moveNodes` 충돌검사 선행 | op | 쉬움 |
| U9 | NORM | moveNodes 성공 시 군집 내부 변 보존, 교차 변만 재계산 | `moveNodes` `idSet.has(from)===idSet.has(to)` | op | 쉬움 |
| U10 | CRIT | deleteNode는 entryNodeId 보호 + 끝점인 변 동반 제거(고아 변 없음) | `ops.ts:deleteNode` | op | 쉬움 |
| U11 | NORM | setNodeLabel은 라벨만·trim·빈값이면 키 삭제(undefined 잔류 없음) | `ops.ts:setNodeLabel` | op | 쉬움 |
| U12 | NORM | toggleEdge는 인접·상이 노드만 무방향 토글(두 번=항등) | `ops.ts:toggleEdge` | op | 쉬움 |
| U13 | CRIT | addNodeFromTemplate은 content를 JSON deep-clone(배치 후 수정이 원본·템플릿 오염 안 함) | `ops.ts` `JSON.parse(JSON.stringify(content))` | op | 쉬움 |
| U14 | NORM | addFloor 산 층은 단독 validateFloor 통과(start+clear 인접·연결) | `ops.ts:addFloor` | op | 쉬움 |
| U15 | NORM | deleteFloor는 최소 1층 유지(floors 비지 않음) | `ops.ts:deleteFloor` `if(>1)` | op | 쉬움 |
| U16 | NORM | moveFloor는 범위 내 swap(층 다중집합 보존), 범위 밖 no-op | `ops.ts:moveFloor` | op | 쉬움 |

## V. 헥스 기하 (`hexgeo.ts`)

| ID | 심각도 | 규칙 | 근거 | 시점 | 테스트 |
|---|---|---|---|---|---|
| V1 | NORM | cornerOffsets(size)=6점, 모두 중심거리 ≈ size(정육각) | `hexgeo.ts:cornerOffsets` | 왕복 | 쉬움 |
| V2 | CRIT | `edgeDirIndex(EDGE_DIRS[i]) = i`(역함수), 비방향=−1 | `hexgeo.ts:edgeDirIndex` | 왕복 | 쉬움 |
| V3 | CRIT | `set(EDGE_DIRS) = set(HEX_DIRS)`(에디터 벽 ↔ 엔진 인접 동일 헥스 모델) | `hexgeo.ts` vs `graph.ts` HEX_DIRS | 왕복 | 쉬움 |
| V4 | CRIT | 셀 중심픽셀 왕복: `pixelToAxial(ccx(q,r),ccy(r)) = {q,r}` | `hexgeo.ts:pixelToAxial`+ccx/ccy | 왕복 | 쉬움 |
| V5 | NORM | 인접 두 셀은 변(꼭짓점 2개) 정확히 공유(완벽 벌집) | `hexgeo.ts:hexCorners/hexEdge` | 왕복 | 중간 |
| V6 | NORM | hexPoints/gridPathStr 결정론(메모이즈 동일 반환) | `hexgeo.ts` | op | 쉬움 |

> V3는 **두 독립 상수**(hexgeo의 EDGE_DIRS, graph의 HEX_DIRS)가 갈라지면 에디터 벽/인접과 엔진 검증이 불일치하는 실재 회귀 위험 — 교차 회귀 테스트로 묶는다.

## W. 템플릿 / store / 스키마

| ID | 심각도 | 규칙 | 근거 | 시점 | 테스트 |
|---|---|---|---|---|---|
| W1 | CRIT | saveTemplate은 content deep-clone 저장(이후 원본 수정이 저장본 오염 안 함) | `templates.ts` `JSON.parse(JSON.stringify(content))` | op | 쉬움(clone)/중간(persist) |
| W2 | NORM | getTemplate은 비복제 참조 반환(소비자 addNodeFromTemplate이 재clone해 현재 안전) | `templates.ts:getTemplate` | op | 쉬움 |
| W3 | CRIT | saveTemplate 부여 템플릿 id 유일(Date.now+counter) | `templates.ts:newId` | op | 쉬움 |
| W4 | NORM | localStorage 로드는 valid() 통과 항목만, 손상 시 [] 폴백 | `templates.ts` load 가드 | op | 중간 |
| W5 | CRIT | blankRun()은 validateRun 통과하는 최소 유효 런 | `store.ts:blankRun` | op | 쉬움 |
| W6 | CRIT | JSON 내보내기 왕복: `JSON.parse(JSON.stringify(def)) ≡ def`(RunDef plain data) | `store.ts:exportRun`/`saveToRepo` | 왕복 | 쉬움 |
| W7 | CRIT | cloneAsDraft은 deep-clone·새 draft id·원본 비공유 | `store.ts:cloneAsDraft` | op | 쉬움 |
| W8 | NORM | store 로드는 loadable() 통과 드래프트만, 손상 시 {} 폴백 | `store.ts:load` | op | 중간 |
| W9 | NORM | listRuns는 드래프트 우선·repo 보충, id 무중복 | `store.ts:listRuns` | op | 중간 |
| W10 | NORM | LAYER_KINDS∪DECO_KINDS ⊆ keys(LAYER_SPECS), spec.make().kind === 키 | `layerSchema.ts` | op | 쉬움 |

---

# Part 5 — 수치 반올림 지점 (ULP 함정 — 포팅 시 정확 복제 대상)

> TS `number`(IEEE754 double) ↔ Rust 수치 타입 일치를 위해 **반올림이 일어나는 모든 지점**을 목록화.
> 정책 결정은 별도 문서 [`NUMERIC-POLICY.md`](NUMERIC-POLICY.md).

| # | 파일:함수 | 연산 | 위험 |
|---|---|---|---|
| R1 | `damage.ts:computeDamage` | `Math.round(dmg)` (동상×0.5·crit배수·포메이션 분수·dmgDealtFlat 누적 후 1회) | double 곱·합 누적 후 반올림. JS round=half-up(banker's 아님)→결정론 OK. 분배 분수가 여기서 흡수. |
| R2 | `damage.ts:dealRawDamage` | `Math.floor(shield / mult)` (공포 흡수가능 피해량) | floor 경계. 공포 시 쉴드 1칸 미만 잔량 미흡수(쉴드 잔류). |
| R3 | `damage.ts:previewHpLoss` | `Math.floor(shield / mult)` | R2 미러 — 미리보기-실제 일치 위해 floor 동일해야(현재 일치). |
| R4 | `skills.ts:applyTargetEffects` | `Math.round(eff.amount + def)` (쉴드 획득) | 포메이션 defensePower 분수 반올림. equipShieldGainAdd는 round 밖(정수 가정). |
| R5 | `skills.ts:applyTargetEffects`·`status.ts` | `Math.round(eff.amount + def)` (힐) | R4 미러(힐). hpMax 클램프와 결합. |
| R6 | `formation.ts:getFormationBonus` | `total / count`(분수 생성, 반올림 X) | 반올림은 소비처(R1/R4/R5). 유닛별 round 후 합 ≠ total 가능(K1 누적오차). |
| R7 | `damage.ts:computeDamage` | crit 배수 합산 `critMultiplier+statMod+statusNumSum`(반올림 전 부동소수 누적) | 비정수 누적이 R1 직전까지 부동. 결정론 위해 합산 순서 고정 필요. |
| R8 | `helpers.ts:healParty`·`encounter.ts` | `Math.round(maxHp * pct)` (회복·피해 비율) | maxHp×0.5 등. max(1,…)/min(maxHp,…) 클램프와 결합. |
| R9 | `rewards.ts:genRewards` | `Math.max(0, Math.min(2, tier−1))` (옵션 수) | 정수 연산 — 안전. 목록화만. |

---

# Part 6 — 코드 리뷰로 발견한 잠재 결함 / 모호 지점

> assertion 모듈·캠페인 러너가 **우선 두들겨 확인**할 후보. 일부는 의도된 동작일 수 있으므로 "결함 확정"이 아니라 **검증 대상**으로 기록.

> **검증 인프라 적용 결과(2026-06-04)**: 무작위 캠페인(전 런×3정책×수백 시드)이 아래 #1을 **실제로 검출**했고
> 수정 완료. #12는 에디터 정합성 테스트가 검출·수정. 나머지는 문서화된 검증 대상으로 남김(유효 데이터에선 미발현).

### 잠재 결함 (수정 후보)

0. **✅ [수정됨] L8 — 종료 시 stale reachable** (`run.ts` completeFloor 승리분기·resolveBattleEnd 패배분기)
   캠페인 러너가 검출: 승리(won) 시 `reachable`에 방금 방문한 clear 노드가 남아 `reachable ∩ visited ≠ ∅`.
   종료 시 `reachable=[]`로 비우도록 수정(종료 상태엔 선택지 없음). 회귀 테스트 `invariants.test.ts` 고정.

1. **`completeFloor` 미존재 toFloor = 오인 승리** (`run.ts:99-104`, CRIT 후보)
   `nextIdx = clear.toFloor ? findIndex(...) : -1; if(nextIdx<0) phase="won"`. 존재하지 않는 floor id를 가리키는 `toFloor`는 `findIndex=-1` → "게임 클리어"로 처리된다. 런타임 미검증(L9 validateRun은 **에디터 저장 시점에만** 강제). → **assertion: createRun 진입 시 validateRun 게이트**가 강력한 방어.

2. **`createRun`이 validateRun 미호출** (`run.ts:20`, CRIT 후보)
   잘못된 RunDef(고립 노드·dangling 변·entry 부재)가 런타임에 그대로 진입 → `node()` throw 또는 데드런. entryFloorId 부재 시 `Math.max(0, findIndex)`로 **조용히 floor 0** 폴백.

3. **`stepCore` 미등록 starter = 조용한 시퀀서 정지** (`layers.ts:34`, CRIT 후보)
   `starters[L.kind]?.(run, L)` — shop/event starter 미등록 시 옵셔널체이닝이 no-op → phase 미전환·cursor 미전진 → 블록 상태로 무한 정지(복귀 트리거 없음). run.ts가 모듈 로드 시 둘 다 등록하므로 run.ts를 import하는 한 안전하나, 정적 보장 없음.

4. **`insertInterrupts` 이벤트 로그 역순** (`interrupt.ts:26-29`, NORM)
   역순 splice 루프 내부에서 `log.push`하므로 `interrupt` 이벤트가 주체 **역순**으로 로그된다(roundOrder 실행 순서는 정방향). 결정론은 유지되나 로그 재생(애니메이션) 순서가 실행 순서와 어긋남. 로그 순서를 정방향으로 기대하는 소비자가 있으면 버그.

### 모호 지점 (정책 확정 필요)

5. **포메이션 반올림 후 총량 비보존** (K1/R6) — 분수 단계만 보존, 유닛별 round 합은 total과 어긋날 수 있음. "엔진 보존 보장" 단언 불가. 정수화 재설계(`NUMERIC-POLICY.md`)로 해소 가능.

6. **상태이상 스택 상한 없음** (E11) — `applyStatusInstance`가 무한 누적. 상한이 데이터/엔진 어디 책임인지 미정.

7. **음수 쉴드 획득 가드 부재** (R4/D14 후보) — `shield += round(amount+def)+equipShieldGainAdd`에 음수 가드 없음. 데이터가 음수면 쉴드 감소. 강제 여부 미정(데이터 책임 추정).

8. **stacks 부호 비대칭** (E13) — `totalStacks`/`statusNumSum`은 stacks>0 미필터, `hasStatus`/`statusFlag`는 요구. 입력 불변식 "stacks≥0" 추가 가치.

9. **move col 상한 하드코딩 3** (F7) — `sideDims`는 더 넓은 그리드 허용하나 이동은 0..3 클램프. 광폭 배치 시 불일치.

10. **getTemplate 비복제 반환** (W2) — 결과를 직접 변이하면 템플릿 라이브러리 오염. 현재 소비 경로(addNodeFromTemplate 재clone)는 안전. 방어적 clone 반환 검토.

11. **모듈 전역 싱글톤** (I3) — passives의 `depth`/`activeKeys`, run passives의 `firing`이 모듈 전역. 단일 스레드 동기 전제에선 안전하나, harness가 **두 전투를 인터리브하면 오염**. → 캠페인 러너는 반드시 **직렬 실행**(현재 그렇게 구현됨).

12. **✅ [수정됨] store 드래프트 id 충돌** (`store.ts` blankRun/cloneAsDraft) — `draft_${Date.now()}`만 써서 같은 ms에 만든 두 드래프트가 id 충돌(drafts 맵에서 덮어쓰기). 에디터 정합성 테스트가 검출 → `ops.ts`/`templates.ts`와 동일하게 `Date.now()+counter` 접미사로 수정.

13. **[특성/설계] 무작위 양측 플레이의 느린 전투** (T1/T4 관련 — 결함 아님) — 대량 스윕(20k 시드)이 검출: **양측이 완전 무작위**로 두면 힐/쉴드/미스가 데미지를 거의 상쇄해 전투가 **유한하지만 수천 행동까지** 길어질 수 있다(큰 cap에서 항상 종료 확인 = 무한 아님). AI(ai-allies/ai) 플레이는 수십 행동에 종료(4만 캠페인 교착 0). **결론**: 종료성 하드 보장은 **현실적(AI) 플레이**에 적용. `random`은 크래시/불변식 스트레스 도구이며 cap 도달은 "느림(유한)"으로 분류(테스트는 random 교착을 하드 실패로 보지 않음, `npm run campaign`이 informational 보고). 진짜 무한루프는 어떤 유한 cap도 넘으므로 검출은 유지.

---

# Part 7 — `INVARIANTS-FROM-REPO.md` 교차 검증 메모

REPO 문서(A~M)와 본 카탈로그(A~W) 대조 결과:

- **일치(같은 규칙·근거)**: REPO A1~A5↔본 A1~A5, B1~B4↔B1~B5, C1~C9↔C1~C12, D1~D7↔D1~D9, E1~E7↔E1~E13, F1~F4↔F7~F10, G1~G5↔G1~G10, H1~H6↔L/M, I1~I5↔N, J1~J4↔Q/T, K1~K6↔Part 5. 심각도(CRIT/NORM)·검사시점도 대체로 합치.
- **본 카탈로그가 추가로 도출(REPO 누락)**:
  - **I(패시브 룰엔진) 전체**(I1~I15) — REPO 미커버. 정렬 완전순·재진입·깊이캡·castSkill 이중 게이트·speedRoll 결정론은 결정론의 핵심.
  - **J(관측 충실성)**, **R(AI 결정론 + 동점 tiebreak 방향)**, **S(순수성 전수스캔=위반0 확인)**.
  - **O(세이브 왕복)** REPO M에서 "추가 조사"로만 언급 → 본 O1~O3로 구체화.
  - **Part 4(에디터 정합성) 전체**(U~W) — REPO는 §7에서 "에디터 검증=비범위"로 제외했으나, 사용자 지시("프로그램 전체 검증")에 따라 **포함**. ops/hexgeo/templates/store는 순수함수라 단위테스트 용이.
  - **Part 6 잠재 결함 1~4** — REPO가 짚지 않은 코드 의미 결함 후보.
- **REPO의 "M. 미해결" 답**: 스택 상한=없음(E11), 쉴드 무한 누적(E11), statMod speed 하한=C3가 막음, applyStatusSelf 1회=SKILL-5(본 F/I), AI 결정론=R1~R7(rng 미사용 확인).
- **해석 차이**: REPO D4(공포)는 "HP 효율 불변"으로 술어화 — 본 D4와 동일하나 floor 경계(R2)로 쉴드 1칸 미만 잔량 미흡수를 명시 추가.

> 결론: REPO 문서는 전투 핵심을 잘 짚었으나(약 40개), **패시브 룰엔진·관측·에디터·세이브 왕복**이 비어 있었다. 본 카탈로그는 ~130개 불변식 + 9개 반올림 지점 + 11개 잠재결함/모호점으로 확장.
