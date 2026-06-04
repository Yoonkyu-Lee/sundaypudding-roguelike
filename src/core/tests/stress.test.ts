// 무작위 행동 스트레스 런 (MIGRATION-VERIFICATION-PLAN §3.1/§4.3) — coremark 대응.
// (검증 용어 "stress run" — 게임의 '캠페인 모드'와 무관.)
// 전 런 × 정책 × 다수 시드를 끝까지 구동하며 매 step 불변식 검사. 크래시·교착·위반 0이 성공 기준.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RUNS, DEFAULT_RUN } from "../../data/runs/index.ts";
import { stressRun, type ActionPolicy } from "./harness/index.ts";
import { summarize } from "./invariants/index.ts";

const POLICIES: ActionPolicy[] = ["random", "ai-allies", "ai"];
const SEEDS = 200; // CI 기본. 대량 스윕(수만)은 npm run stress(별도 스크립트)로.

// 하드 보장: 어떤 정책·시드에서도 크래시 0 · 불변식 위반 0. (6만+ 스트레스 런에서 검증된 핵심 보장)
test("stress: 전 런 × 전 정책 × 시드 — 크래시·불변식 위반 0", () => {
  const failures: string[] = [];
  let total = 0;
  for (const runDef of Object.values(RUNS)) {
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        total++;
        const r = stressRun(seed, runDef, { policy });
        if (r.outcome === "crash") failures.push(`${runDef.id}/${policy}/seed${seed}: crash — ${r.error} | ${(r.logTail ?? []).join(" / ")}`);
        if (r.violations.length > 0) failures.push(`${runDef.id}/${policy}/seed${seed}: ${summarize(r.violations.slice(0, 3))}`);
        if (failures.length > 12) break;
      }
    }
  }
  assert.equal(failures.length, 0, `${total} 스트레스 런 중 실패:\n${failures.join("\n")}`);
});

// 종료성 하드 보장은 현실적(AI) 플레이 대상 — ai-allies·ai는 교착 0.
// random(양측 무작위)은 힐/미스가 데미지를 거의 상쇄해 전투가 유한하나 매우 길어질 수 있어(실측 수천 행동)
// cap 도달이 "고착(무한)"이 아닌 "느림"이라 종료성 하드보장에서 제외. (npm run stress가 random도 스윕)
test("stress: 종료성 — 현실적(AI) 플레이는 교착 0 (ai-allies·ai)", () => {
  const failures: string[] = [];
  for (const runDef of Object.values(RUNS)) {
    for (const policy of ["ai-allies", "ai"] as ActionPolicy[]) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const r = stressRun(seed, runDef, { policy });
        if (r.outcome === "deadlock") failures.push(`${runDef.id}/${policy}/seed${seed}: ${r.error} | ${(r.logTail ?? []).join(" / ")}`);
        if (failures.length > 8) break;
      }
    }
  }
  assert.equal(failures.length, 0, `AI 플레이 교착(비종료 의심):\n${failures.join("\n")}`);
});

test("stress: 모든 상호작용 phase 진입(불변식 검사가 그 경로에서 실제로 돌았음 보장)", () => {
  const want = ["battle", "reward", "shop", "encounter"];
  const hit = new Set<string>();
  for (let seed = 1; seed <= 400 && !want.every((p) => hit.has(p)); seed++) {
    const r = stressRun(seed, DEFAULT_RUN, { policy: "ai-allies" });
    for (const p of Object.keys(r.phaseHits)) hit.add(p);
  }
  for (const p of want) assert.ok(hit.has(p), `phase '${p}' 미진입 — 스트레스 런이 해당 콘텐츠를 안 거침(커버리지 부족)`);
});

test("stress: ai-allies는 무작위보다 더 깊이 진행(승리 도달 ≥ 무작위)", () => {
  const winRate = (policy: ActionPolicy) => {
    let won = 0;
    for (let seed = 1; seed <= SEEDS; seed++) if (stressRun(seed, DEFAULT_RUN, { policy }).outcome === "won") won++;
    return won;
  };
  assert.ok(winRate("ai-allies") >= winRate("random"), "ai-allies가 무작위보다 승리 적음 — 정책/진행 이상");
});
