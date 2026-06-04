// 세이브 왕복 항등 (불변식 O1/O2) — serialize∘deserialize가 RunState를 정확 복원(Rng 보존).
// 결정론이 저장/로드를 가로질러 유지되는지(복원 후 동일 전개)까지 검증.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../rng.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, leaveShop, chooseEncounterOption, serializeRun, deserializeRun } from "../run.ts";
import { step } from "../engine.ts";
import { chooseAction } from "../ai.ts";
import { DEFAULT_RUN } from "../../data/runs/index.ts";
import type { RunState } from "../run.ts";

/** 첫 reachable만 따라가며 phase가 battle(또는 종료)이 될 때까지 진행. */
function driveToBattle(run: RunState): void {
  let guard = 0;
  while (run.phase !== "battle" && run.phase !== "won" && run.phase !== "lost" && guard++ < 100) {
    if (run.phase === "map") enterNode(run, run.reachable[0]);
    else if (run.phase === "reward") chooseReward(run, run.rewards![0].id);
    else if (run.phase === "shop") leaveShop(run);
    else if (run.phase === "encounter") chooseEncounterOption(run, run.encounter!.choices[0].id);
  }
}

const driveBattleToEnd = (run: RunState): string => {
  const b = run.battle!;
  let g = 0;
  while (b.phase === "inProgress" && g++ < 1000) step(b, chooseAction(b));
  return JSON.stringify(b.log);
};

test("save round-trip: serialize∘deserialize 왕복 직렬화 항등 + rng=Rng 인스턴스", () => {
  for (const seed of [1, 2, 7, 42, 123, 9999]) {
    const run = createRun(seed, DEFAULT_RUN.roster, DEFAULT_RUN);
    driveToBattle(run);
    if (run.phase === "battle") { step(run.battle!, chooseAction(run.battle!)); } // 전투 진행 중 상태로

    const json1 = serializeRun(run);
    const restored = deserializeRun(json1);
    assert.ok(restored, `seed ${seed}: deserialize가 null`);
    assert.ok(restored!.rng instanceof Rng, `seed ${seed}: run.rng가 Rng 아님`);
    assert.equal(restored!.rng.state, run.rng.state, `seed ${seed}: run.rng.state 불일치`);
    if (run.battle) assert.ok(restored!.battle!.rng instanceof Rng, `seed ${seed}: battle.rng가 Rng 아님`);
    assert.equal(serializeRun(restored!), json1, `seed ${seed}: 왕복 재직렬화 불일치(필드 손실/Rng 누락)`);
  }
});

test("save round-trip: 전투 중 저장→복원 후 동일 전개(결정론이 세이브를 가로질러 유지)", () => {
  let tested = 0;
  for (const seed of [3, 4, 11, 55, 271, 808, 5000]) {
    const run = createRun(seed, DEFAULT_RUN.roster, DEFAULT_RUN);
    driveToBattle(run);
    if (run.phase !== "battle") continue;
    step(run.battle!, chooseAction(run.battle!)); // 몇 수 둔 뒤 저장
    step(run.battle!, chooseAction(run.battle!));

    const restored = deserializeRun(serializeRun(run))!;
    const original = deserializeRun(serializeRun(run))!; // 원본도 복제해 독립 전개(부작용 격리)
    assert.equal(driveBattleToEnd(original), driveBattleToEnd(restored), `seed ${seed}: 복원 후 전투 전개 불일치`);
    tested++;
  }
  assert.ok(tested > 0, "전투 중 저장 케이스를 하나도 못 만듦 — 드라이버 점검");
});
