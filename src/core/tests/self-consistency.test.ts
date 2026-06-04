// self-consistency harness (MIGRATION-VERIFICATION-PLAN §3.2, 불변식 T2/T3) — 결정론 자기일치.
// 같은 시드 → 동일 이벤트 로그. 포팅 시 이 비교를 TS↔Rust로 확장(differential harness).
import { test } from "node:test";
import assert from "node:assert/strict";
import { RUNS } from "../../data/runs/index.ts";
import { campaignTrace, tracesMatch, battleTrace } from "./harness/index.ts";
import { DEMO_ENCOUNTER, NODE_ROSTERS } from "../../data/encounters.ts";

test("self-consistency: 같은 시드 캠페인 2회 → 동일 트레이스(전 런)", () => {
  for (const runDef of Object.values(RUNS)) {
    for (const seed of [1, 2, 7, 42, 100, 271, 999, 31337]) {
      const a = campaignTrace(seed, runDef);
      const b = campaignTrace(seed, runDef);
      const m = tracesMatch(a, b);
      assert.ok(m.ok, `${runDef.id} seed ${seed} 트레이스 불일치 @${m.at}: \nA=${a[m.at ?? 0]}\nB=${b[m.at ?? 0]}`);
      assert.ok(a.length > 0, `${runDef.id} seed ${seed} 트레이스 비어있음`);
    }
  }
});

test("self-consistency: 전투 2회(AI) → 동일 이벤트 로그", () => {
  for (const enc of [DEMO_ENCOUNTER, { id: "t", name: "t", allies: [], enemies: NODE_ROSTERS.battle, boss: false }]) {
    for (const seed of [1, 5, 50, 500, 5000]) {
      assert.equal(battleTrace(seed, enc, "ai"), battleTrace(seed, enc, "ai"), `전투 AI 비결정 (seed ${seed})`);
    }
  }
});

test("self-consistency: 전투 2회(무작위 합법행동) → 동일 이벤트 로그", () => {
  for (const seed of [1, 13, 137, 1377]) {
    assert.equal(battleTrace(seed, DEMO_ENCOUNTER, "random"), battleTrace(seed, DEMO_ENCOUNTER, "random"), `전투 무작위 비결정 (seed ${seed})`);
  }
});

test("self-consistency: 다른 시드는 (대개) 다른 트레이스 — 트레이스가 시드에 실제 의존", () => {
  const runDef = Object.values(RUNS)[0];
  const t1 = campaignTrace(1, runDef);
  let anyDiff = false;
  for (const s of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    if (!tracesMatch(t1, campaignTrace(s, runDef)).ok) { anyDiff = true; break; }
  }
  assert.ok(anyDiff, "시드를 바꿔도 트레이스가 전부 동일 — 시드가 캠페인에 영향 없음(결정 무작위 결함)");
});
