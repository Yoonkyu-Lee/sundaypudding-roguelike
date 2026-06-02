// 패시브 디스패처 — 훅에서 fireTrigger 호출. 매칭 수집 → 결정론 정렬 → if 평가 → then 실행.
// 재진입/무한루프 가드: 깊이 캡 + (소유자#룰) 콜스택 차단 + maxPerTurn/Battle.
import type { CompiledRule, GameState, SpeedRoll, Trigger, Unit } from "../../types.ts";
import { evalConditions } from "./conditions.ts";
import { applyEffect } from "./effects.ts";
import type { RuleCtx, TriggerCtx } from "./ctx.ts";

const MAX_DEPTH = 4;
let depth = 0;
const activeKeys = new Set<string>(); // `${ownerUid}#${ruleIdx}` 재진입 차단

function getUnit(state: GameState, uid?: string): Unit | undefined {
  return uid ? state.units.find((u) => u.uid === uid) : undefined;
}
function whoMatch(owner: Unit, other: Unit | undefined, who: "self" | "ally" | "enemy" | "any" | undefined): boolean {
  switch (who ?? "self") {
    case "self": return !!other && other.uid === owner.uid;
    case "ally": return !!other && other.side === owner.side;
    case "enemy": return !!other && other.side !== owner.side;
    case "any": return !!other;
  }
  return false;
}
function orderIndexOf(state: GameState, uid: string): number {
  const i = state.roundOrder.findIndex((q) => q.uid === uid);
  return i < 0 ? state.roundOrder.length + 1 : i;
}

/** 트리거 + 소유자 → 매칭 시 RuleCtx(self/subject/target), 아니면 null. */
function match(state: GameState, tctx: TriggerCtx, owner: Unit, w: Trigger): RuleCtx | null {
  const subj = getUnit(state, tctx.subjectUid);
  const atk = getUnit(state, tctx.attackerUid);
  const other = (cand: Unit | undefined, fallback?: Unit) => (cand && cand.uid !== owner.uid ? cand : (fallback && fallback.uid !== owner.uid ? fallback : cand ?? fallback));
  switch (w.on) {
    case "battleStart": case "roundStart": case "roundEnd": return { owner };
    case "battleEnd": {
      if (w.result) { const won = owner.side === tctx.winnerSide; if ((w.result === "win") !== won) return null; }
      return { owner };
    }
    case "turnStart": case "turnEnd": case "beforeAction":
      return whoMatch(owner, subj, w.who) ? { owner, subject: subj } : null;
    case "interruptStart":
      return subj?.uid === owner.uid ? { owner } : null;
    case "everyNTurns":
      return subj?.uid === owner.uid && owner.turnCount > 0 && owner.turnCount % w.n === 0 ? { owner } : null;
    case "skillUsed":
      if (w.skillId && tctx.skillId !== w.skillId) return null;
      return whoMatch(owner, subj, w.who) ? { owner, subject: subj } : null;
    case "onMove":
      return whoMatch(owner, subj, w.who) ? { owner, subject: subj } : null;
    case "enterCell":
      if (subj?.uid !== owner.uid) return null;
      if (w.row != null && owner.pos.row !== w.row) return null;
      if (w.col != null && owner.pos.col !== w.col) return null;
      return { owner };
    case "onHit": case "onMiss": {
      if (w.on === "onHit" && w.crit != null && tctx.crit !== w.crit) return null;
      const as = w.as ?? "attacker";
      if (as === "attacker") return atk?.uid === owner.uid ? { owner, subject: subj } : null;
      return subj?.uid === owner.uid ? { owner, subject: atk } : null;
    }
    case "dealtDamage": case "kill":
      return atk?.uid === owner.uid ? { owner, subject: subj } : null;
    case "damaged":
      return subj?.uid === owner.uid ? { owner, subject: atk } : null;
    case "death":
      return whoMatch(owner, subj, w.who) ? { owner, subject: other(atk, subj) } : null;
    case "onHeal": {
      const as = w.as ?? "target";
      if (as === "healer") return atk?.uid === owner.uid ? { owner, subject: subj } : null;
      return subj?.uid === owner.uid ? { owner, subject: atk } : null;
    }
    case "onShieldGain":
      return subj?.uid === owner.uid ? { owner } : null;
    case "statusApplied": {
      if (w.statusId && tctx.statusId !== w.statusId) return null;
      const as = w.as ?? "target";
      if (as === "applier") return atk?.uid === owner.uid ? { owner, subject: subj } : null;
      return subj?.uid === owner.uid ? { owner, subject: atk } : null;
    }
    case "statusTick":
      if (w.statusId && tctx.statusId !== w.statusId) return null;
      return subj?.uid === owner.uid ? { owner } : null;
    case "speedRoll": return null; // applySpeedRollPassives가 따로 처리
    // 모험(run) 스코프 트리거 — 전투에선 발동 안 함(run/passives.ts가 처리)
    case "nodeEnter": case "nodeClear": case "actStart": case "goldGain": case "partyHpChange": return null;
  }
  return null;
}

export function fireTrigger(state: GameState, tctx: TriggerCtx): void {
  if (depth >= MAX_DEPTH) return;
  const matched: { owner: Unit; cr: CompiledRule; rctx: RuleCtx; ord: number }[] = [];
  for (const u of state.units) {
    const deadOk = tctx.on === "battleEnd" || (tctx.on === "death" && u.uid === tctx.subjectUid);
    if (!u.alive && !deadOk) continue;
    for (const cr of u.rules) {
      if (cr.rule.when.on !== tctx.on) continue;
      const rctx = match(state, tctx, u, cr.rule.when);
      if (rctx) { rctx.damage = tctx.damage; matched.push({ owner: u, cr, rctx, ord: orderIndexOf(state, u.uid) }); }
    }
  }
  if (matched.length === 0) return;
  matched.sort((a, b) => a.ord - b.ord || (a.owner.uid < b.owner.uid ? -1 : a.owner.uid > b.owner.uid ? 1 : 0) || a.cr.idx - b.cr.idx);
  depth++;
  try {
    for (const m of matched) {
      const cr = m.cr;
      if (cr.rule.maxPerTurn != null && cr.firedThisTurn >= cr.rule.maxPerTurn) continue;
      if (cr.rule.maxPerBattle != null && cr.firedThisBattle >= cr.rule.maxPerBattle) continue;
      const key = `${m.owner.uid}#${cr.idx}`;
      if (activeKeys.has(key)) continue;
      if (!evalConditions(state, tctx, m.rctx, cr.rule.if)) continue;
      activeKeys.add(key);
      try { for (const eff of cr.rule.then) applyEffect(state, m.rctx, eff); }
      finally { activeKeys.delete(key); }
      cr.firedThisTurn++;
      cr.firedThisBattle++;
    }
  } finally {
    depth--;
  }
}

/** 소유자 정규 턴 시작 시: 턴 카운터 증가 + 턴당 발동 카운터 리셋. */
export function onUnitTurnStart(u: Unit): void {
  u.turnCount++;
  for (const cr of u.rules) cr.firedThisTurn = 0;
}

/** speedRoll 트리거 전용 — 굴린 주사위에 modSpeedRoll(가산)/rerollSpeed(재굴림) 적용. rolls 배열 순서 = 결정론. */
export function applySpeedRollPassives(state: GameState, rolls: SpeedRoll[]): void {
  for (const r of rolls) {
    const u = getUnit(state, r.uid);
    if (!u) continue;
    const rules = u.rules.filter((cr) => cr.rule.when.on === "speedRoll").sort((a, b) => a.idx - b.idx);
    for (const cr of rules) {
      if (!evalConditions(state, { on: "speedRoll" }, { owner: u }, cr.rule.if)) continue;
      for (const eff of cr.rule.then) {
        if (eff.do === "modSpeedRoll") r.roll += eff.delta;
        else if (eff.do === "rerollSpeed") r.roll = state.rng.int(u.speedMin, u.speedMax);
      }
    }
    r.speed = Math.max(1, r.roll + r.speedMod);
  }
}
