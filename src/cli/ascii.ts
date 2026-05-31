// CLI 뷰 — ASCII 보드 렌더 (8.2 텍스트 뷰). 코어가 아니라 뷰이므로 cli/에 둔다.
import type { GameState, UnitView } from "../core/types.ts";
import { buildObservation } from "../core/observation.ts";

function round1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function statusGlance(v: UnitView): string {
  if (v.statuses.length === 0) return "";
  return " " + v.statuses.map((s) => `${s.icon}${s.stacks}/${s.duration}`).join(" ");
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
  lines.push("");
  for (const u of units.filter((x) => x.alive)) {
    const sh = u.shield > 0 ? ` 🛡${u.shield}` : "";
    const fa = u.formation.attackPower > 0 ? ` ⚔+${round1(u.formation.attackPower)}` : "";
    const fd = u.formation.defensePower > 0 ? ` 🛉+${round1(u.formation.defensePower)}` : "";
    lines.push(`  ${u.name}(c${u.pos.col}): HP ${u.hp}/${u.hpMax}${sh}${fa}${fd}${statusGlance(u)}`);
  }
  return lines;
}

export function renderAscii(state: GameState): string {
  const obs = buildObservation(state);
  const out: string[] = [];
  out.push(`══ ROUND ${obs.round} ══  [${obs.phase}]`);

  // 행동 서열 타임라인 — 완료(✓)/현재(▶)/예정, 끼어들기 ⚡ (2.11)
  const orderStr = obs.order
    .map((e, i) => {
      const u = state.units.find((x) => x.uid === e.uid);
      const nm = u ? u.name : e.uid;
      const cur = i === obs.cursorIndex ? "▶" : "";
      const done = i < obs.cursorIndex ? "✓" : "";
      const label = e.kind === "interrupt" ? `⚡${nm}` : `${nm}(${e.speed})`;
      return `${cur}${done}${label}`;
    })
    .join(" ");
  out.push(`서열: ${orderStr || "—"}`);
  out.push("");

  const allyLines = sideGrid("[ 아군 ]", obs.allies);
  const enemyLines = sideGrid("[ 적 ]", obs.enemies);
  const maxLen = Math.max(allyLines.length, enemyLines.length);
  for (let i = 0; i < maxLen; i++) {
    const l = (allyLines[i] ?? "").padEnd(30, " ");
    const r = enemyLines[i] ?? "";
    out.push(`${l}  ${r}`);
  }

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
