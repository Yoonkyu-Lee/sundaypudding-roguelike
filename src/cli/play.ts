// 터미널 드라이버. 사람이 직접 플레이(대화형) 또는 --demo 자동플레이.
// AI(나)는 이 CLI 없이 engine.ts를 직접 import해 getObservation/step으로 플레이한다. (8.2)
import * as readline from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";
import { createBattle, getLegalActions, step } from "../core/engine.ts";
import { renderAscii } from "../core/observation.ts";
import { chooseAction } from "../core/ai.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import type { GameEvent, GameState } from "../core/types.ts";

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
function argVal(flag: string, def: string): string {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DEMO = argv.includes("--demo");
const SEED = parseInt(argVal("--seed", "42"), 10);
const MAX_TURNS = parseInt(argVal("--max-turns", "300"), 10);

// ── 이벤트 → 사람 가독 한 줄 ─────────────────────────────────────────────────
function nmeOf(state: GameState, uid?: string): string {
  return state.units.find((u) => u.uid === uid)?.name ?? uid ?? "?";
}
function fmt(state: GameState, e: GameEvent): string | null {
  switch (e.t) {
    case "roundStart":
      return `\n──── ROUND ${e.round} ────`;
    case "turnStart":
      return `· [${nmeOf(state, e.uid)}의 턴${e.kind === "interrupt" ? " ⚡끼어들기" : ""}]`;
    case "skillUsed":
      return `  ${nmeOf(state, e.uid)} → 「${e.skillId}」${e.targetUid ? ` (대상 ${nmeOf(state, e.targetUid)})` : ""}`;
    case "miss":
      return `    ✗ 빗나감 (명중 ${e.chance}%)`;
    case "hit":
      return `    ✓ 명중${e.crit ? " 💥크리!" : ""}`;
    case "damage":
      return `    💢 ${nmeOf(state, e.targetUid)} 피해 ${e.final} (쉴드 ${e.toShield}/HP ${e.toHp})`;
    case "statusTick":
      return `    ${nmeOf(state, e.targetUid)} ${e.statusId} 지속피해 ${e.dmg}`;
    case "statusApplied":
      return `    ☢ ${nmeOf(state, e.targetUid)}에 ${e.statusId} ${e.stacks}스택(${e.duration}턴)`;
    case "shieldGain":
      return `    🛡 ${nmeOf(state, e.targetUid)} 쉴드 +${e.amount}`;
    case "heal":
      return `    ➕ ${nmeOf(state, e.targetUid)} 회복 ${e.amount}`;
    case "move":
      return `    ↔ ${nmeOf(state, e.uid)} 이동 (c${e.from.col}→c${e.to.col})`;
    case "interrupt":
      return `    ⚡ ${nmeOf(state, e.uid)} 끼어들기!`;
    case "skip":
      return `  ${nmeOf(state, e.uid)} 스킵 (${e.reason})`;
    case "death":
      return `    ☠ ${nmeOf(state, e.uid)} 전투불능`;
    case "battleEnd":
      return `\n${e.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}`;
    default:
      return null;
  }
}
function printNewEvents(state: GameState, from: number): void {
  for (let i = from; i < state.log.length; i++) {
    const line = fmt(state, state.log[i]);
    if (line) console.log(line);
  }
}

// ── 자동 데모 ────────────────────────────────────────────────────────────────
function runDemo(): void {
  console.log(`\n=== DEMO 자동플레이 (seed ${SEED}) ===`);
  const state = createBattle(SEED, DEMO_ENCOUNTER);
  let logIdx = 0;
  printNewEvents(state, logIdx);
  logIdx = state.log.length;

  let turns = 0;
  while (state.phase === "inProgress" && turns < MAX_TURNS) {
    const action = chooseAction(state); // 양측 모두 AI
    step(state, action);
    printNewEvents(state, logIdx);
    logIdx = state.log.length;
    turns++;
  }
  console.log(`\n결과: ${state.phase} (총 ${turns}행동, ${state.round}라운드)`);
}

// ── 대화형 ───────────────────────────────────────────────────────────────────
async function runInteractive(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log(`\n=== 플레이 (seed ${SEED}) — 아군=당신, 적=AI ===`);
  const state = createBattle(SEED, DEMO_ENCOUNTER);
  let logIdx = state.log.length;

  while (state.phase === "inProgress") {
    const cur = state.current!;
    const actor = state.units.find((u) => u.uid === cur.uid)!;

    if (actor.side === "enemy") {
      const action = chooseAction(state);
      step(state, action);
      printNewEvents(state, logIdx);
      logIdx = state.log.length;
      continue;
    }

    // 아군 차례
    console.log("\n" + renderAscii(state));
    const legal = getLegalActions(state);
    if (legal.length === 1 && legal[0].action.type === "skip") {
      console.log("(자동 스킵)");
      step(state, legal[0].action);
      printNewEvents(state, logIdx);
      logIdx = state.log.length;
      continue;
    }
    const ans = await rl.question("\n행동 번호 입력 > ");
    const idx = parseInt(ans.trim(), 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= legal.length) {
      console.log("잘못된 입력. 다시.");
      continue;
    }
    step(state, legal[idx].action);
    printNewEvents(state, logIdx);
    logIdx = state.log.length;
  }
  console.log("\n" + renderAscii(state));
  rl.close();
}

if (DEMO) {
  runDemo();
} else {
  await runInteractive();
  exit(0);
}
