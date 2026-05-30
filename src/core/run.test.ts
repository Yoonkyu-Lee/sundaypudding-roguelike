import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward } from "./run.ts";
import { step } from "./engine.ts";
import { chooseAction } from "./ai.ts";

const ROSTER = [
  { charId: "beef", pos: { row: 1, col: 0 } },
  { charId: "pudding", pos: { row: 2, col: 1 } },
  { charId: "jelly", pos: { row: 2, col: 2 } },
];

function autoRun(seed: number): string {
  const run = createRun(seed, ROSTER);
  let guard = 0;
  while (run.phase !== "won" && run.phase !== "lost" && guard < 300) {
    guard++;
    if (run.phase === "map") {
      enterNode(run, run.reachable[0]);
    } else if (run.phase === "battle") {
      let bg = 0;
      while (run.battle!.phase === "inProgress" && bg < 600) {
        step(run.battle!, chooseAction(run.battle!));
        bg++;
      }
      resolveBattleEnd(run);
    } else if (run.phase === "reward") {
      chooseReward(run, run.rewards![0].id);
    }
  }
  return run.phase;
}

test("런 결정론: 같은 시드 = 같은 맵", () => {
  const a = createRun(7, ROSTER);
  const b = createRun(7, ROSTER);
  assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes));
});

test("맵 연결성: layer>0 모든 노드는 들어오는 간선이 있다", () => {
  const run = createRun(3, ROSTER);
  for (const n of run.nodes) {
    if (n.layer === 0) continue;
    assert.ok(run.nodes.some((m) => m.next.includes(n.id)), `${n.id} 고립`);
  }
});

test("런 완주: map→battle→reward 루프가 보스까지 가서 승/패로 종료", () => {
  for (const s of [1, 2, 3, 7, 42, 100]) {
    const phase = autoRun(s);
    assert.ok(phase === "won" || phase === "lost", `seed ${s}: ${phase}`);
  }
});

test("보상 스킬강화: 데미지 보너스 누적 + map 복귀", () => {
  const run = createRun(1, ROSTER);
  run.phase = "reward";
  run.activeNodeId = "n0_0";
  run.rewards = [{ id: "x", kind: "skillUp", charId: "beef", skillId: "gangta", amount: 3, label: "t" }];
  chooseReward(run, "x");
  assert.equal(run.party.find((m) => m.charId === "beef")!.skillDmgBonus["gangta"], 3);
  assert.equal(run.phase, "map");
});

test("보스전은 적 진형 보너스 활성(6.3) — boss 노드 진입 시 enemyFormation 설정", () => {
  const run = createRun(2, ROSTER);
  run.reachable = ["boss"];
  enterNode(run, "boss");
  assert.notEqual(run.battle, null);
  assert.notEqual(run.battle!.enemyFormation, null);
});
