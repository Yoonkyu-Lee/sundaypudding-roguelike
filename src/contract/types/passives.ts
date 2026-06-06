// ─────────────────────────────────────────────────────────────────────────
// 특성(trait)/패시브(passive) 룰 스키마 (디자이너 작성). when/if/then 합성 언어.
// 엔진(core/combat/passives)이 이걸 "해석"만 한다. (8.6 / 8.8 데이터·엔진 경계)
// 트리거는 현재 전투 스코프 전체. 모험 스코프(노드/골드/파티HP)는 후속 슬라이스.
// ─────────────────────────────────────────────────────────────────────────
import type { NodeType, Side } from "./content.ts";

export type Comparator = "lt" | "lte" | "eq" | "gte" | "gt";

/** 트리거 대상 필터. self=규칙 소유자 / ally·enemy=소유자 기준 진영 / any=전체 */
export type TriggerWho = "self" | "ally" | "enemy" | "any";

/** 발동 시점 (when). 판별 유니온 `on`. */
export type Trigger =
  // 턴/라운드
  | { on: "battleStart" }
  | { on: "roundStart" }
  | { on: "roundEnd" }
  | { on: "turnStart"; who?: TriggerWho }
  | { on: "turnEnd"; who?: TriggerWho }
  | { on: "everyNTurns"; n: number } // 소유자의 자기 턴 카운터 기준
  | { on: "interruptStart" }
  // 주사위 (effect는 modSpeedRoll/rerollSpeed만 유효)
  | { on: "speedRoll" }
  // 행동/스킬/이동
  | { on: "beforeAction"; who?: TriggerWho }
  | { on: "skillUsed"; who?: TriggerWho; skillId?: string }
  | { on: "onMove"; who?: TriggerWho }
  | { on: "enterCell"; row?: number; col?: number }
  // 명중/피해/회복/쉴드
  | { on: "onHit"; as?: "attacker" | "target"; crit?: boolean }
  | { on: "onMiss"; as?: "attacker" | "target" }
  | { on: "dealtDamage" } // 소유자가 가해자
  | { on: "damaged" } // 소유자가 피격자
  | { on: "onHeal"; as?: "healer" | "target" }
  | { on: "onShieldGain" } // 소유자가 쉴드 획득
  // 상태/사망
  | { on: "statusApplied"; statusId?: string; as?: "applier" | "target" }
  | { on: "statusTick"; statusId?: string } // on-bleed 등 (지속 피해/회복 발동 시)
  | { on: "kill" } // 소유자가 처치
  | { on: "death"; who?: TriggerWho }
  | { on: "battleEnd"; result?: "win" | "lose" }
  // ── 모험(run) 스코프 — core/run/passives.ts가 해석 ──
  | { on: "nodeEnter"; nodeType?: NodeType }
  | { on: "nodeClear"; nodeType?: NodeType }
  | { on: "actStart" }
  | { on: "goldGain" }
  | { on: "partyHpChange"; dir?: "heal" | "hurt" };

/** 조건 평가 대상. self=소유자 / subject=이벤트 1차 대상(피격자 등) / target=소유자 현재 행동 대상 */
export type CondWho = "self" | "subject" | "target";

/** 조건 (if). AND 결합, 비면 항상 참. */
export type Condition =
  | { c: "hpPct"; who: CondWho; cmp: Comparator; v: number }
  | { c: "round"; cmp: Comparator; v: number }
  | { c: "selfTurnCount"; cmp: Comparator; v: number }
  | { c: "everyN"; n: number; of: "round" | "selfTurn" }
  | { c: "firstTurn" }
  | { c: "hasStatus"; who: CondWho; statusId: string; minStacks?: number }
  | { c: "missingStatus"; who: CondWho; statusId: string }
  | { c: "atColumn"; who: CondWho; cmp: Comparator; v: number }
  | { c: "atRow"; who: CondWho; cmp: Comparator; v: number }
  | { c: "atCell"; who: CondWho; row: number; col: number }
  | { c: "isFrontline"; who: CondWho } // 점유 최전열(reach 기준)에 있는가
  | { c: "sideCount"; side: Side; cmp: Comparator; v: number } // 살아있는 수
  | { c: "outnumbered" } // 아군 살아있는 수 < 적
  | { c: "subjectCharId"; charId: string }
  | { c: "subjectSide"; side: Side }
  | { c: "wasCrit" }
  | { c: "damageAtLeast"; v: number }
  | { c: "skillIs"; skillId: string }
  | { c: "chance"; pct: number } // state.rng만 사용
  // ── 모험(run) 스코프 조건 ──
  | { c: "nodeTypeIs"; nodeType: NodeType }
  | { c: "goldAtLeast"; v: number };

/** 효과 대상. other*=소유자/대상 제외 광역. */
export type EffTarget = "self" | "subject" | "target" | "allAllies" | "allEnemies" | "otherAllies" | "otherEnemies" | "randomEnemy" | "randomAlly";
/** statMod 가능한 스탯. */
export type StatKey = "accuracy" | "evasion" | "critChance" | "critMultiplier" | "speedMin" | "speedMax";

/** 효과 (then). 순서대로 실행. */
export type Effect =
  // 기존 전투 프리미티브 재사용
  | { do: "damage"; amount: number; target: EffTarget }
  | { do: "heal"; amount: number; target: EffTarget }
  | { do: "shield"; amount: number; target: EffTarget }
  | { do: "applyStatus"; statusId: string; stacks: number; duration: number; target: EffTarget }
  | { do: "cleanse"; target: EffTarget }
  | { do: "move"; deltaCol: number; target: EffTarget }
  | { do: "grantInterrupt"; count: number; target: EffTarget }
  // 신규 해석
  | { do: "modSpeedRoll"; delta: number } // speedRoll 트리거 전용(소유자 주사위에 가산, rng 호출 없음)
  | { do: "rerollSpeed" } // speedRoll 트리거 전용(소유자 주사위 재굴림, state.rng)
  | { do: "statMod"; stat: StatKey; delta: number; target: EffTarget } // 전투 동안 누적 스탯 보정
  | { do: "modCooldown"; skillId?: string; delta: number; target: EffTarget } // 쿨다운 가감(음수=감소)
  // ── 피해 비례/상태 제거 (전투 스코프 — dealtDamage/damaged 등 ctx.damage 필요) ──
  | { do: "healByDamage"; pct: number; target: EffTarget } // 흡혈: 가한 피해의 pct% 회복
  | { do: "reflectByDamage"; pct: number; target: EffTarget } // 비율 반사: 받은 피해의 pct%를 대상에 피해
  | { do: "removeStatus"; statusId: string; target: EffTarget } // 특정 상태이상 1종 제거
  | { do: "castSkill"; skillId: string } // 액티브 스킬을 정상 시전(명중·사정권·면적은 스킬 정의대로, 타겟 자동). 대상은 passives 없는 leaf 스킬만(재귀 방지)
  // ── 연출(스토리텔링) — phase/상태 불변, 뷰 이벤트만 (NODE-DESIGN Phase C) ──
  | { do: "showDialog"; speaker?: string; text: string } // 대사/컷신 1줄 → dialog 이벤트 push(전투 위 오버레이로 재생)
  // ── 모험(run) 스코프 효과 ──
  | { do: "goldDelta"; amount: number } // 골드 가감
  | { do: "healParty"; pct: number } // 파티 비율 회복
  | { do: "grantRunStatus"; statusId: string; stacks: number; duration: number; target: EffTarget }; // 다음 전투 시작 시 부여(계승)

/** 디자이너 룰: when 시점에, if 모두 참이면, then 순서대로 실행. */
export interface PassiveRule {
  id?: string;
  when: Trigger;
  if?: Condition[];
  then: Effect[];
  maxPerTurn?: number; // 소유자 턴당 최대 발동(과발동 방지)
  maxPerBattle?: number; // 전투당 최대 발동
}

/** 특성 = 캐릭터를 정의하는 패시브 룰 묶음(data/traits.ts). 캐릭터가 traitIds로 참조. */
export interface TraitDef {
  id: string;
  name: string;
  icon?: string;
  desc?: string;
  rules: PassiveRule[];
}
