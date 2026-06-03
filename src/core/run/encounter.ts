// 인카운터 (7.2) — 선택지/도박. 생존 보장(피해는 최소 HP1). 결과 적용 + 노드 완료.
import type { RunState } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";
import { ENCOUNTER_EVENTS, type EncounterOutcome } from "../../data/events.ts";
import { ownsUpgradeLine } from "./rewards.ts";
import { healParty, upgradeOwned, learnOwned, completeNode } from "./helpers.ts";
import { advanceCore } from "./layers.ts";
import { fireRunTrigger } from "./passives.ts";

function applyOutcome(run: RunState, o: EncounterOutcome): void {
  if (o.kind === "heal") { healParty(run, o.pct); run.log.push(`파티 ${Math.round(o.pct * 100)}% 회복`); }
  else if (o.kind === "hurt") { for (const m of run.party) if (m.hp > 0) m.hp = Math.max(1, m.hp - Math.round(m.maxHp * o.pct)); run.log.push(`파티 ${Math.round(o.pct * 100)}% 피해`); fireRunTrigger(run, { on: "partyHpChange", dir: "hurt" }); }
  else if (o.kind === "gold") { run.gold = Math.max(0, run.gold + o.amount); run.log.push(`골드 ${o.amount >= 0 ? "+" : ""}${o.amount}`); }
  else if (o.kind === "upgradeRandom") {
    const cand = run.party.filter((m) => m.hp > 0).flatMap((m) => m.ownedSkillIds.filter((sid) => SKILLS[sid]?.nextTierId).map((sid) => ({ m, sid })));
    if (cand.length) { const p = cand[run.rng.int(0, cand.length - 1)]; upgradeOwned(p.m, p.sid, SKILLS[p.sid].nextTierId!); run.log.push(`${CHARACTERS[p.m.charId].name} 「${SKILLS[p.sid].name}」 강화!`); }
  } else if (o.kind === "learnUniversal") {
    const cand = run.party.filter((m) => m.hp > 0).flatMap((m) => CHARACTERS[m.charId].skillIds.filter((sid) => !ownsUpgradeLine(m.ownedSkillIds, sid) && !SKILLS[sid]?.exclusiveTo).map((sid) => ({ m, sid })));
    if (cand.length) { const p = cand[run.rng.int(0, cand.length - 1)]; learnOwned(p.m, p.sid); run.log.push(`${CHARACTERS[p.m.charId].name} 「${SKILLS[p.sid].name}」 습득!`); }
  }
}

export function chooseEncounterOption(run: RunState, choiceId: string): void {
  if (run.phase !== "encounter" || !run.encounterId) return;
  const ev = ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId);
  const ch = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !ch) return;
  let outcome: EncounterOutcome = ch.result ?? { kind: "nothing" };
  if (ch.gamble) { const win = run.rng.chance(ch.gamble.chance); run.log.push(`${ev.title}: ${win ? "성공!" : "실패…"}`); outcome = win ? ch.gamble.win : ch.gamble.lose; }
  applyOutcome(run, outcome);
  run.encounterId = null;
  if (run.coreCursor !== null) { advanceCore(run); return; } // 코어 시퀀스 event 레이어 → 다음 스텝
  completeNode(run, run.activeNodeId!);
}
