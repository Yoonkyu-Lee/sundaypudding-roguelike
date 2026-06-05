// 모험(run) 스코프 특성/패시브 디스패처 — 전투 밖 사건(노드/골드/파티HP)에 반응.
// 전투 디스패처(combat/passives)와 분리: 상태가 RunState/PartyMemberState. 룰 컴파일은 재사용.
import type { Condition, Effect, EffTarget, NodeType, PartyMemberState } from "../types.ts";
import type { RunState } from "./types.ts";
import { roundDiv } from "../util.ts";
import { compileRules } from "../combat/passives/index.ts";

export interface RunTriggerCtx { on: "nodeEnter" | "nodeClear" | "actStart" | "goldGain" | "partyHpChange"; nodeType?: NodeType; dir?: "heal" | "hurt"; }

// 재진입 가드는 RunState.firing에 귀속(P0-3): healParty 효과 → partyHpChange → … 무한루프 차단. 모듈 전역 mut 제거.

function cmp(a: number, op: "lt" | "lte" | "eq" | "gte" | "gt", b: number): boolean {
  return op === "lt" ? a < b : op === "lte" ? a <= b : op === "eq" ? a === b : op === "gte" ? a >= b : a > b;
}

/** run 스코프 조건 평가(소유자=파티원). 전투 전용 조건은 여기서 미충족(false). */
function evalRunCond(run: RunState, ctx: RunTriggerCtx, owner: PartyMemberState, c: Condition): boolean {
  switch (c.c) {
    case "hpPct": return c.who === "self" && cmp((owner.hp / owner.maxHp) * 100, c.cmp, c.v);
    case "chance": return run.rng.chance(c.pct);
    case "nodeTypeIs": return ctx.nodeType === c.nodeType;
    case "goldAtLeast": return run.gold >= c.v;
    default: return false; // 전투 전용 조건은 모험 스코프 미충족
  }
}

function targets(run: RunState, owner: PartyMemberState, t: EffTarget): PartyMemberState[] {
  if (t === "allAllies") return run.party.filter((m) => m.hp > 0);
  if (t === "otherAllies") return run.party.filter((m) => m.hp > 0 && m.charId !== owner.charId);
  return [owner]; // self(및 그 외; 모험 스코프엔 적 없음) = 소유자
}

function applyRunEffect(run: RunState, owner: PartyMemberState, e: Effect): void {
  switch (e.do) {
    case "goldDelta": run.gold = Math.max(0, run.gold + e.amount); run.log.push(`골드 ${e.amount >= 0 ? "+" : ""}${e.amount} (패시브)`); break;
    case "healParty": for (const m of run.party) if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + roundDiv(m.maxHp * e.pct, 100)); break;
    case "grantRunStatus":
      for (const m of targets(run, owner, e.target)) (run.pendingStatuses[m.charId] ??= []).push({ statusId: e.statusId, stacks: e.stacks, duration: e.duration });
      break;
    default: break; // 전투 전용 효과는 모험 스코프 무시
  }
}

/** 모험 트리거 발동 — 살아있는 파티원의 (보유 스킬 passives + 특성) 룰 중 매칭 실행. 결정론: 파티 순→룰 idx. */
export function fireRunTrigger(run: RunState, ctx: RunTriggerCtx): void {
  if (run.firing) return; // 재진입 차단
  run.firing = true;
  try {
    for (const m of run.party) {
      if (m.hp <= 0) continue;
      const rules = compileRules(m.charId, m.activeSkillIds); // 스킬 패시브=활성(출전) 기준, 특성=항상

      for (const cr of rules) {
        const w = cr.rule.when;
        if (w.on !== ctx.on) continue;
        if ((w.on === "nodeEnter" || w.on === "nodeClear") && w.nodeType && w.nodeType !== ctx.nodeType) continue;
        if (w.on === "partyHpChange" && w.dir && w.dir !== ctx.dir) continue;
        if (cr.rule.if && !cr.rule.if.every((c) => evalRunCond(run, ctx, m, c))) continue;
        for (const eff of cr.rule.then) applyRunEffect(run, m, eff);
      }
    }
  } finally {
    run.firing = false;
  }
}
