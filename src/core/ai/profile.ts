// AI 프로파일 인터프리터 — 우선순위 룰 리스트를 합법 행동에 적용해 1개 행동 선택.
// 순수·결정론(rng 미사용, 동점=합법행동 인덱스). 메커니즘=엔진, 정책 값=data/ai.ts.
import type {
  Action,
  AiCondition,
  AiProfile,
  AiRule,
  Comparator,
  GameState,
  LegalAction,
  SkillKindPref,
  TargetPref,
  Unit,
} from "../types.ts";
import { aliveUnits, unitById } from "../util.ts";
import { SKILLS } from "../../data/skills.ts";

const cmp = (a: number, op: Comparator, b: number): boolean =>
  op === "lt" ? a < b : op === "lte" ? a <= b : op === "eq" ? a === b : op === "gte" ? a >= b : a > b;

const hpPct = (u: Unit): number => (u.hpMax > 0 ? (u.hp / u.hpMax) * 100 : 0);

/** 스킬이 가진 효과 종류 집합(prefer 매칭용). applyStatusSelf도 applyStatus로 본다. */
function skillKinds(skillId: string): Set<SkillKindPref> {
  const s = SKILLS[skillId];
  const out = new Set<SkillKindPref>();
  if (!s) return out;
  for (const e of s.effects) {
    if (e.kind === "damage") out.add("damage");
    else if (e.kind === "heal") out.add("heal");
    else if (e.kind === "shield") out.add("shield");
    else if (e.kind === "cleanse") out.add("cleanse");
    else if (e.kind === "applyStatus" || e.kind === "applyStatusSelf") out.add("applyStatus");
  }
  return out;
}

function matchesPrefer(skillId: string, prefer: SkillKindPref): boolean {
  return prefer === "any" || skillKinds(skillId).has(prefer);
}

/** prefer의 기본 타겟 선호 (target 생략 시). */
function defaultTarget(prefer: SkillKindPref): TargetPref {
  return prefer === "heal" || prefer === "shield" || prefer === "cleanse" ? "lowestHpAlly" : "lowestHpEnemy";
}

const ENEMY_PREFS = new Set<TargetPref>(["lowestHpEnemy", "highestHpEnemy", "frontmostEnemy", "backmostEnemy", "anyEnemy"]);
const ALLY_PREFS = new Set<TargetPref>(["lowestHpAlly", "anyAlly"]);

/** 이 합법 행동의 타겟이 target 선호의 진영 제약을 만족하는가. */
function sideOk(action: LegalAction, actor: Unit, target: TargetPref, tgt: Unit | null): boolean {
  if (target === "self") return action.targetUid === actor.uid;
  if (!tgt) return false;
  if (ENEMY_PREFS.has(target)) return tgt.side !== actor.side;
  if (ALLY_PREFS.has(target)) return tgt.side === actor.side;
  return false;
}

/** 타겟 선호 → 기본 점수(높을수록 선호). col·hp는 큰 배수로 1차 정렬, weight는 보조. */
function baseScore(target: TargetPref, tgt: Unit | null): number {
  if (!tgt || target === "self" || target === "anyEnemy" || target === "anyAlly") return 0;
  switch (target) {
    case "lowestHpEnemy":
    case "lowestHpAlly":
      return -tgt.hp * 100;
    case "highestHpEnemy":
      return tgt.hp * 100;
    case "frontmostEnemy":
      return -tgt.pos.col * 1000;
    case "backmostEnemy":
      return tgt.pos.col * 1000;
  }
}

/** weight 가산 보너스(보조 정렬). */
function weightBonus(rule: AiRule, action: LegalAction, tgt: Unit | null): number {
  const w = rule.weight;
  if (!w || !tgt) return 0;
  let b = 0;
  if (w.backlineTarget) b += w.backlineTarget * tgt.pos.col * 10;
  if (w.frontlineTarget) b += w.frontlineTarget * -tgt.pos.col * 10;
  if (w.lowHpTarget) b += w.lowHpTarget * -tgt.hp;
  if (w.hitChance) b += w.hitChance * (action.hitChance ?? 0) * 0.1;
  if (w.critChance) b += w.critChance * tgt.critChance * 0.1;
  return b;
}

function evalCond(state: GameState, actor: Unit, c: AiCondition): boolean {
  const oppSide = actor.side === "ally" ? "enemy" : "ally";
  switch (c.c) {
    case "selfHpPct":
      return cmp(hpPct(actor), c.cmp, c.v);
    case "allyHpPctBelow":
      return aliveUnits(state, actor.side).some((u) => hpPct(u) < c.v);
    case "enemyHpPctBelow":
      return aliveUnits(state, oppSide).some((u) => hpPct(u) < c.v);
    case "selfHasStatus":
      return actor.statuses.some((s) => s.defId === c.statusId && s.stacks > 0);
    case "selfMissingStatus":
      return !actor.statuses.some((s) => s.defId === c.statusId && s.stacks > 0);
    case "enemyHasStatus":
      return aliveUnits(state, oppSide).some((u) => u.statuses.some((s) => s.defId === c.statusId && s.stacks > 0));
    case "round":
      return cmp(state.round, c.cmp, c.v);
    case "outnumbered":
      return aliveUnits(state, actor.side).length < aliveUnits(state, oppSide).length;
    case "allyCount":
      return cmp(aliveUnits(state, actor.side).length, c.cmp, c.v);
  }
}

const condsHold = (state: GameState, actor: Unit, conds?: AiCondition[]): boolean =>
  !conds || conds.every((c) => evalCond(state, actor, c));

/** 한 룰을 합법 스킬 행동에 적용. 매칭+진영OK 후보 중 최고 점수(동점=인덱스 앞) 반환, 없으면 null. */
function applyRule(state: GameState, actor: Unit, rule: AiRule, skills: LegalAction[]): Action | null {
  const prefer = rule.prefer ?? "any";
  const target = rule.target ?? defaultTarget(prefer);
  let best: LegalAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  skills.forEach((a) => {
    if (!a.action.type || a.action.type !== "skill") return;
    if (!matchesPrefer(a.action.skillId, prefer)) return;
    const tgt = a.targetUid ? unitById(state, a.targetUid) : null;
    if (!sideOk(a, actor, target, tgt)) return;
    const score = baseScore(target, tgt) + weightBonus(rule, a, tgt);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  });
  return best ? (best as LegalAction).action : null;
}

/** 프로파일을 위→아래 적용. 첫 적용가능(조건 참 AND 행동 존재) 룰의 행동 반환. 없으면 null(→ fallback). */
export function applyProfile(state: GameState, actor: Unit, profile: AiProfile, skills: LegalAction[]): Action | null {
  for (const rule of profile.rules) {
    if (!condsHold(state, actor, rule.if)) continue;
    const action = applyRule(state, actor, rule, skills);
    if (action) return action;
  }
  return null;
}
