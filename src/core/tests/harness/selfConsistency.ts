// self-consistency harness (MIGRATION-VERIFICATION-PLAN §3.2) — 같은 시드 2회 실행이 동일 로그.
// 결정론(T2/T3)을 검증. 포팅 시 TS↔Rust differential harness로 확장(같은 비교 함수 재사용).
import { runCampaign } from "./campaign.ts";
import type { RunDef } from "../../run.ts";
import { createBattle, step, getLegalActions } from "../../engine.ts";
import { chooseAction } from "../../ai.ts";
import type { Encounter } from "../../../data/encounters.ts";
import { Rng } from "../../rng.ts";

/** 캠페인 1판의 관측 트레이스(전투 이벤트 로그 시퀀스 + 최종 다이제스트). */
export function campaignTrace(seed: number, runDef: RunDef): string[] {
  const trace: string[] = [];
  runCampaign(seed, runDef, { trace, checkInvariants: false });
  return trace;
}

/** 두 트레이스가 정확히 일치하는지 + 처음 어긋난 인덱스. */
export function tracesMatch(a: string[], b: string[]): { ok: boolean; at?: number } {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return { ok: false, at: i };
  if (a.length !== b.length) return { ok: false, at: n };
  return { ok: true };
}

/** 전투 단위 결정론: 같은 시드+인코더+(랜덤 또는 AI) 행동열 2회 → 동일 이벤트 로그. */
export function battleTrace(seed: number, enc: Encounter, mode: "ai" | "random" = "ai", cap = 800): string {
  const state = createBattle(seed, enc);
  const choice = new Rng((seed ^ 0xbeef) >>> 0);
  let n = 0;
  while (state.phase === "inProgress" && n < cap) {
    if (mode === "ai") {
      step(state, chooseAction(state));
    } else {
      const legal = getLegalActions(state);
      step(state, legal[choice.int(0, legal.length - 1)].action);
    }
    n++;
  }
  return JSON.stringify(state.log);
}
