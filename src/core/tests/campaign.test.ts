// 무작위 행동 캠페인 스트레스 (MIGRATION-VERIFICATION-PLAN §3.1/§4.3) — coremark 대응.
// 전 런 × 정책 × 다수 시드를 끝까지 구동하며 매 step 불변식 검사. 크래시·교착·위반 0이 성공 기준.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RUNS, DEFAULT_RUN } from "../../data/runs/index.ts";
import { runCampaign, type ActionPolicy } from "./harness/index.ts";
import { summarize } from "./invariants/index.ts";

const POLICIES: ActionPolicy[] = ["random", "ai-allies", "ai"];
const SEEDS = 200; // CI 기본. 대량 스윕(수만)은 npm run campaign(별도 스크립트)로.

test("campaign: 전 런 × 정책 × 시드 — 크래시·교착·불변식 위반 0", () => {
  const failures: string[] = [];
  let total = 0;
  for (const runDef of Object.values(RUNS)) {
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        total++;
        const r = runCampaign(seed, runDef, { policy });
        if (r.outcome === "crash" || r.outcome === "deadlock") {
          failures.push(`${runDef.id}/${policy}/seed${seed}: ${r.outcome} — ${r.error} | ${(r.logTail ?? []).join(" / ")}`);
        }
        if (r.violations.length > 0) {
          failures.push(`${runDef.id}/${policy}/seed${seed}: ${summarize(r.violations.slice(0, 3))}`);
        }
        if (failures.length > 12) break;
      }
    }
  }
  assert.equal(failures.length, 0, `${total} 캠페인 중 실패:\n${failures.join("\n")}`);
});

test("campaign: 모든 상호작용 phase 진입(불변식 검사가 그 경로에서 실제로 돌았음 보장)", () => {
  const want = ["battle", "reward", "shop", "encounter"];
  const hit = new Set<string>();
  for (let seed = 1; seed <= 400 && !want.every((p) => hit.has(p)); seed++) {
    const r = runCampaign(seed, DEFAULT_RUN, { policy: "ai-allies" });
    for (const p of Object.keys(r.phaseHits)) hit.add(p);
  }
  for (const p of want) assert.ok(hit.has(p), `phase '${p}' 미진입 — 캠페인이 해당 콘텐츠를 안 거침(커버리지 부족)`);
});

test("campaign: ai-allies는 무작위보다 더 깊이 진행(승리 도달 ≥ 무작위)", () => {
  const winRate = (policy: ActionPolicy) => {
    let won = 0;
    for (let seed = 1; seed <= SEEDS; seed++) if (runCampaign(seed, DEFAULT_RUN, { policy }).outcome === "won") won++;
    return won;
  };
  assert.ok(winRate("ai-allies") >= winRate("random"), "ai-allies가 무작위보다 승리 적음 — 정책/진행 이상");
});
