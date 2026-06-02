// 효과 적용 (then) — 기존 전투 프리미티브 재사용. move는 인라인(skills.ts 사이클 회피).
import type { Effect, EffTarget, GameState, Pos, Unit } from "../../types.ts";
import { clamp, hasStatus, samePos } from "../../util.ts";
import { computeDamage, dealRawDamage } from "../damage.ts";
import { applyStatusInstance } from "../status.ts";
import { insertInterrupts } from "../interrupt.ts";
import { STATUS_DEFS } from "../../../data/statuses.ts";
import type { RuleCtx } from "./ctx.ts";

function resolveTargets(state: GameState, rctx: RuleCtx, t: EffTarget): Unit[] {
  switch (t) {
    case "self": return [rctx.owner];
    case "subject": return rctx.subject ? [rctx.subject] : [];
    case "target": return (rctx.target ?? rctx.subject) ? [(rctx.target ?? rctx.subject)!] : [];
    case "allAllies": return state.units.filter((u) => u.alive && u.side === rctx.owner.side);
    case "allEnemies": return state.units.filter((u) => u.alive && u.side !== rctx.owner.side);
    case "randomEnemy": { const e = state.units.filter((u) => u.alive && u.side !== rctx.owner.side); return e.length ? [e[state.rng.int(0, e.length - 1)]] : []; }
    case "randomAlly": { const a = state.units.filter((u) => u.alive && u.side === rctx.owner.side); return a.length ? [a[state.rng.int(0, a.length - 1)]] : []; }
  }
}

function moveUnit(state: GameState, u: Unit, deltaCol: number): void {
  const newCol = clamp(u.pos.col + deltaCol, 0, 3);
  if (newCol === u.pos.col) return;
  const dest: Pos = { row: u.pos.row, col: newCol };
  if (state.units.some((o) => o.alive && o.side === u.side && o !== u && samePos(o.pos, dest))) return;
  const from = { ...u.pos };
  u.pos = dest;
  state.log.push({ t: "move", uid: u.uid, from, to: { ...dest } });
}

/** 한 효과를 적용. (modSpeedRoll/rerollSpeed는 speedRoll 전용 — turnOrder가 따로 처리, 여기선 무시) */
export function applyEffect(state: GameState, rctx: RuleCtx, eff: Effect): void {
  const owner = rctx.owner;
  switch (eff.do) {
    case "damage": for (const tgt of resolveTargets(state, rctx, eff.target)) dealRawDamage(state, tgt, computeDamage(owner, eff.amount, false), { ignoreShield: hasStatus(owner, "pierce"), attackerUid: owner.uid }); break;
    case "heal": for (const tgt of resolveTargets(state, rctx, eff.target)) { if (!tgt.alive) continue; const b = tgt.hp; tgt.hp = Math.min(tgt.hpMax, tgt.hp + eff.amount); state.log.push({ t: "heal", targetUid: tgt.uid, amount: tgt.hp - b }); } break;
    case "shield": for (const tgt of resolveTargets(state, rctx, eff.target)) { if (!tgt.alive) continue; const amt = eff.amount + tgt.equipShieldGainAdd; tgt.shield += amt; state.log.push({ t: "shieldGain", targetUid: tgt.uid, amount: amt }); } break;
    case "applyStatus": for (const tgt of resolveTargets(state, rctx, eff.target)) if (tgt.alive) applyStatusInstance(state, tgt, owner, eff.statusId, eff.stacks, eff.duration); break;
    case "cleanse": for (const tgt of resolveTargets(state, rctx, eff.target)) { const before = tgt.statuses.length; tgt.statuses = tgt.statuses.filter((s) => STATUS_DEFS[s.defId].buff); if (tgt.statuses.length !== before) state.log.push({ t: "cleanse", targetUid: tgt.uid }); } break;
    case "move": for (const tgt of resolveTargets(state, rctx, eff.target)) if (tgt.alive) moveUnit(state, tgt, eff.deltaCol); break;
    case "grantInterrupt": { const subs: string[] = []; for (const tgt of resolveTargets(state, rctx, eff.target)) for (let i = 0; i < eff.count; i++) subs.push(tgt.uid); insertInterrupts(state, subs); break; }
    case "statMod": for (const tgt of resolveTargets(state, rctx, eff.target)) tgt.statMods[eff.stat] = (tgt.statMods[eff.stat] ?? 0) + eff.delta; break;
    case "modCooldown": for (const tgt of resolveTargets(state, rctx, eff.target)) { const ids = eff.skillId ? [eff.skillId] : Object.keys(tgt.cooldowns); for (const id of ids) tgt.cooldowns[id] = Math.max(0, (tgt.cooldowns[id] ?? 0) + eff.delta); } break;
    case "modSpeedRoll": case "rerollSpeed": break; // speedRoll 트리거에서 turnOrder가 처리
    case "goldDelta": case "healParty": case "grantRunStatus": break; // 모험 스코프 효과 — run/passives.ts가 처리
  }
}
