// 런 세이브 직렬화 (순수 — IO 없음). RunState/GameState는 Rng 인스턴스만 빼면 JSON-safe.
// Rng는 state(number)만으로 완전 복원 가능(8.3) → {__rng:state} 마커로 치환·복원. 영속화(localStorage)는 web.
import { Rng } from "../rng.ts";
import type { RunState } from "./types.ts";

/** RunState → JSON 문자열. 모든 Rng(run.rng·battle.rng)를 {__rng:state}로 치환. */
export function serializeRun(run: RunState): string {
  return JSON.stringify(run, (_k, v) => (v instanceof Rng ? { __rng: v.state } : v));
}

/** {__rng:n} 마커를 Rng(state=n)로 깊이 복원. */
function reviveRng(o: unknown): unknown {
  if (o === null || typeof o !== "object") return o;
  const rec = o as Record<string, unknown>;
  if (typeof rec.__rng === "number") { const r = new Rng(0); r.state = rec.__rng; return r; }
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = reviveRng(o[i]); return o; }
  for (const k in rec) rec[k] = reviveRng(rec[k]);
  return o;
}

/** JSON 문자열 → RunState. 파싱/스키마 손상 시 null(세이브 무시). */
export function deserializeRun(json: string): RunState | null {
  try {
    return reviveRng(JSON.parse(json)) as RunState;
  } catch {
    return null;
  }
}
