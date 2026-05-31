// 전투 엔진 공유 커널 — 순수 헬퍼 + 유닛/상태 쿼리. 사이클 방지를 위해 leaf에 둔다.
// (쿼리는 여기, 상태 "적용/틱"은 combat/status.ts — damage↔status 사이클 회피)
import type { GameState, Unit } from "./types.ts";
import { STATUS_DEFS } from "../data/statuses.ts";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function samePos(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return a.row === b.row && a.col === b.col;
}

export function unitById(state: GameState, uid: string): Unit {
  const u = state.units.find((x) => x.uid === uid);
  if (!u) throw new Error(`unit not found: ${uid}`);
  return u;
}

export function aliveUnits(state: GameState, side?: "ally" | "enemy"): Unit[] {
  return state.units.filter((u) => u.alive && (side ? u.side === side : true));
}

export function hasStatus(unit: Unit, defId: string): boolean {
  return unit.statuses.some((s) => s.defId === defId && s.stacks > 0);
}

export function totalStacks(unit: Unit, defId: string): number {
  return unit.statuses.filter((s) => s.defId === defId).reduce((sum, s) => sum + s.stacks, 0);
}

/** 상태이상 정의의 수치 필드를 스택 가중 합산 (dmgDealtFlat/critChanceAdd/critMultiplierAdd/speedDown) */
export function statusNumSum(unit: Unit, key: "dmgDealtFlat" | "critChanceAdd" | "critMultiplierAdd" | "speedDown"): number {
  let sum = 0;
  for (const s of unit.statuses) {
    const v = STATUS_DEFS[s.defId][key];
    if (typeof v === "number") sum += v * s.stacks;
  }
  return sum;
}

/** 불린 플래그 상태 보유 여부 (invincible/taunt 등) */
export function statusFlag(unit: Unit, key: "invincible" | "taunt"): boolean {
  return unit.statuses.some((s) => STATUS_DEFS[s.defId][key] && s.stacks > 0);
}

export function critPctOf(unit: Unit): number {
  return unit.critChance + statusNumSum(unit, "critChanceAdd");
}

/** 빙결 등 행동 봉쇄 상태 */
export function isFrozen(u: Unit): boolean {
  return u.statuses.some((s) => STATUS_DEFS[s.defId].actionDenial && s.stacks > 0);
}
