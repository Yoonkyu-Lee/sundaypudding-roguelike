// 승패 판정 (7.3). 사이클 방지를 위해 leaf로 분리 (turnOrder·flow가 모두 사용).
import type { GameState } from "../types.ts";
import { aliveUnits } from "../util.ts";

export function checkWin(state: GameState): boolean {
  if (state.phase !== "inProgress") return true;
  const alliesAlive = aliveUnits(state, "ally").length;
  const enemiesAlive = aliveUnits(state, "enemy").length;
  if (enemiesAlive === 0) {
    state.phase = "allyWin";
    state.log.push({ t: "battleEnd", phase: "allyWin" });
    return true;
  }
  if (alliesAlive === 0) {
    state.phase = "enemyWin";
    state.log.push({ t: "battleEnd", phase: "enemyWin" });
    return true;
  }
  return false;
}
