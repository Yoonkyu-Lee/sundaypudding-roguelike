// 관측(Observation) 빌드 — GameState → JSON. AI·웹·CLI 공통 진실 (8.2). 렌더는 뷰(web/cli)가.
import type { GameState, Observation, Unit, UnitView } from "../types.ts";
import { getLegalActions } from "./targeting.ts";
import { getFormationBonus } from "./formation.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { CHARACTERS } from "../../data/characters.ts";

function viewStatuses(u: Unit): UnitView["statuses"] {
  const byDef = new Map<string, { stacks: number; durs: number[] }>();
  for (const s of u.statuses) {
    const e = byDef.get(s.defId) ?? { stacks: 0, durs: [] };
    e.stacks += s.stacks;
    e.durs.push(s.duration);
    byDef.set(s.defId, e);
  }
  const out: UnitView["statuses"] = [];
  for (const [id, e] of byDef) {
    out.push({
      id,
      icon: STATUS_DEFS[id].icon,
      stacks: e.stacks, // superscript (3.2)
      duration: Math.max(...e.durs), // subscript: 소멸까지
      nextChange: Math.min(...e.durs), // ▾: 다음 변화까지
    });
  }
  return out;
}

function viewUnit(state: GameState, u: Unit): UnitView {
  return {
    uid: u.uid,
    side: u.side,
    name: u.name,
    avatar: CHARACTERS[u.charId]?.avatar,
    pos: { ...u.pos },
    hp: u.hp,
    hpMax: u.hpMax,
    shield: u.shield,
    alive: u.alive,
    statuses: viewStatuses(u),
    cooldowns: { ...u.cooldowns },
    formation: {
      attackPower: getFormationBonus(state, u, "attackPower"),
      defensePower: getFormationBonus(state, u, "defensePower"),
    },
  };
}

export function buildObservation(state: GameState): Observation {
  const cur = state.current;
  const curUnit = cur ? state.units.find((u) => u.uid === cur.uid) : null;
  return {
    round: state.round,
    phase: state.phase,
    current:
      cur && curUnit
        ? { uid: cur.uid, name: curUnit.name, side: curUnit.side, kind: cur.kind }
        : null,
    order: [...state.roundOrder],
    cursorIndex: state.cursor,
    allies: state.units.filter((u) => u.side === "ally").map((u) => viewUnit(state, u)),
    enemies: state.units.filter((u) => u.side === "enemy").map((u) => viewUnit(state, u)),
    legalActions: getLegalActions(state),
  };
}
