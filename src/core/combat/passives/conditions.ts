// 조건 평가 (if) — 순수 함수. 모든 조건 AND. who 대상이 없으면 false(불충족).
import type { Condition, CondWho, GameState, Unit } from "../../types.ts";
import { aliveUnits, hasStatus, totalStacks } from "../../util.ts";
import { cmp, isFrontline, type RuleCtx, type TriggerCtx } from "./ctx.ts";

function pick(rctx: RuleCtx, who: CondWho): Unit | undefined {
  return who === "self" ? rctx.owner : who === "subject" ? rctx.subject : (rctx.target ?? rctx.subject);
}

export function evalConditions(state: GameState, tctx: TriggerCtx, rctx: RuleCtx, conds?: Condition[]): boolean {
  if (!conds || conds.length === 0) return true;
  return conds.every((c) => evalOne(state, tctx, rctx, c));
}

function evalOne(state: GameState, tctx: TriggerCtx, rctx: RuleCtx, c: Condition): boolean {
  switch (c.c) {
    case "hpPct": { const u = pick(rctx, c.who); return !!u && cmp((u.hp / u.hpMax) * 100, c.cmp, c.v); }
    case "round": return cmp(state.round, c.cmp, c.v);
    case "selfTurnCount": return cmp(rctx.owner.turnCount, c.cmp, c.v);
    case "everyN": { const t = c.of === "round" ? state.round : rctx.owner.turnCount; return t > 0 && t % c.n === 0; }
    case "firstTurn": return rctx.owner.turnCount === 1;
    case "hasStatus": { const u = pick(rctx, c.who); return !!u && totalStacks(u, c.statusId) >= (c.minStacks ?? 1); }
    case "missingStatus": { const u = pick(rctx, c.who); return !!u && !hasStatus(u, c.statusId); }
    case "atColumn": { const u = pick(rctx, c.who); return !!u && cmp(u.pos.col, c.cmp, c.v); }
    case "atRow": { const u = pick(rctx, c.who); return !!u && cmp(u.pos.row, c.cmp, c.v); }
    case "atCell": { const u = pick(rctx, c.who); return !!u && u.pos.row === c.row && u.pos.col === c.col; }
    case "isFrontline": { const u = pick(rctx, c.who); return !!u && isFrontline(state, u); }
    case "sideCount": return cmp(aliveUnits(state, c.side).length, c.cmp, c.v);
    case "outnumbered": return aliveUnits(state, rctx.owner.side).length < aliveUnits(state, rctx.owner.side === "ally" ? "enemy" : "ally").length;
    case "subjectCharId": return rctx.subject?.charId === c.charId;
    case "subjectSide": return rctx.subject?.side === c.side;
    case "wasCrit": return tctx.crit === true;
    case "damageAtLeast": return (tctx.damage ?? 0) >= c.v;
    case "skillIs": return tctx.skillId === c.skillId;
    case "chance": return state.rng.chance(c.pct);
  }
}
