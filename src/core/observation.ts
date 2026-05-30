// 관측(Observation) 빌드 + ASCII 렌더. 사람 육안 = AI 입력 = 같은 진실. (8.2)
import type { GameState, Observation, Unit, UnitView } from "./types.ts";
import { getLegalActions } from "./engine.ts";
import { STATUS_DEFS } from "../data/statuses.ts";

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

function viewUnit(u: Unit): UnitView {
  return {
    uid: u.uid,
    side: u.side,
    name: u.name,
    pos: { ...u.pos },
    hp: u.hp,
    hpMax: u.hpMax,
    shield: u.shield,
    alive: u.alive,
    statuses: viewStatuses(u),
    cooldowns: { ...u.cooldowns },
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
    order: [...state.queue],
    allies: state.units.filter((u) => u.side === "ally").map(viewUnit),
    enemies: state.units.filter((u) => u.side === "enemy").map(viewUnit),
    legalActions: getLegalActions(state),
  };
}

// ── ASCII 렌더 ───────────────────────────────────────────────────────────────

function statusGlance(v: UnitView): string {
  if (v.statuses.length === 0) return "";
  return " " + v.statuses.map((s) => `${s.icon}${s.stacks}/${s.duration}`).join(" ");
}

function cellLabel(units: UnitView[], row: number, col: number): string {
  const u = units.find((x) => x.alive && x.pos.row === row && x.pos.col === col);
  if (!u) return "  ·   ";
  return u.name.slice(0, 3).padEnd(3, " ").padStart(4, " ").slice(0, 6);
}

function sideGrid(title: string, units: UnitView[]): string[] {
  const lines: string[] = [title];
  lines.push("   c0    c1    c2    c3");
  for (let row = 0; row < 4; row++) {
    let line = `r${row} `;
    for (let col = 0; col < 4; col++) {
      const u = units.find((x) => x.alive && x.pos.row === row && x.pos.col === col);
      line += u ? `[${u.name.slice(0, 3).padEnd(3, " ")}]` : `[   ]`;
    }
    lines.push(line);
  }
  // 유닛 상태 요약
  lines.push("");
  for (const u of units.filter((x) => x.alive)) {
    const sh = u.shield > 0 ? ` 🛡${u.shield}` : "";
    lines.push(`  ${u.name}: HP ${u.hp}/${u.hpMax}${sh}${statusGlance(u)}`);
  }
  return lines;
}

export function renderAscii(state: GameState): string {
  const obs = buildObservation(state);
  const out: string[] = [];
  out.push(`══ ROUND ${obs.round} ══  [${obs.phase}]`);

  // 행동 서열 바 — 끼어들기는 ⚡로 표시 (2.11)
  const orderStr = obs.order
    .map((e) => {
      const u = state.units.find((x) => x.uid === e.uid);
      const nm = u ? u.name : e.uid;
      return e.kind === "interrupt" ? `⚡{${nm}}` : `${nm}(${e.spd})`;
    })
    .join(" → ");
  if (obs.current) {
    const tag = obs.current.kind === "interrupt" ? " ⚡끼어들기" : "";
    out.push(`▶ 현재: ${obs.current.name}${tag}`);
  }
  out.push(`서열(남음): ${orderStr || "—"}`);
  out.push("");

  const allyLines = sideGrid("[ 아군 ]", obs.allies);
  const enemyLines = sideGrid("[ 적 ]", obs.enemies);
  const maxLen = Math.max(allyLines.length, enemyLines.length);
  for (let i = 0; i < maxLen; i++) {
    const l = (allyLines[i] ?? "").padEnd(30, " ");
    const r = enemyLines[i] ?? "";
    out.push(`${l}  ${r}`);
  }

  // 합법 행동
  out.push("");
  if (obs.phase === "inProgress") {
    out.push("합법 행동:");
    obs.legalActions.forEach((a, i) => {
      const hit = a.hitChance !== undefined ? `  (명중 ${a.hitChance}%)` : "";
      out.push(`  [${i}] ${a.label}${hit}`);
    });
  } else {
    out.push(obs.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배...");
  }
  return out.join("\n");
}
