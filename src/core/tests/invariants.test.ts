// 불변식 검사기 직접 테스트 (INVARIANTS-FROM-CLAUDE-CODE.md) — 검사기 자체가 옳게 작동하는지 +
// 코어가 directed 시나리오에서 불변식을 지키는지 + 캠페인이 잡은 L8(stale reachable) 회귀 고정.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, step, getLegalActions } from "../engine.ts";
import { chooseAction } from "../ai.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, leaveShop, chooseEncounterOption } from "../run.ts";
import { DEMO_ENCOUNTER } from "../../data/encounters.ts";
import { DEFAULT_RUN } from "../../data/runs/index.ts";
import { checkCombatInvariants, checkRunInvariants, summarize } from "./invariants/index.ts";
import type { RunState, RunDef } from "../run.ts";

test("invariant: 전투 진행 내내(매 step) 전투 불변식 위반 0", () => {
  for (const seed of [1, 2, 3, 42, 777]) {
    const s = createBattle(seed, DEMO_ENCOUNTER);
    let n = 0;
    while (s.phase === "inProgress" && n++ < 500) {
      step(s, chooseAction(s));
      const vs = checkCombatInvariants(s);
      assert.equal(vs.length, 0, `seed ${seed} step ${n}: ${summarize(vs)}`);
    }
  }
});

test("invariant: 무작위 합법행동 전투에서도 전투 불변식 위반 0", () => {
  const choose = (s: ReturnType<typeof createBattle>, i: number) => {
    const legal = getLegalActions(s);
    return legal[(i * 2654435761) % legal.length].action; // 결정적 의사난수 인덱스
  };
  for (const seed of [9, 99, 999]) {
    const s = createBattle(seed, DEMO_ENCOUNTER);
    let n = 0;
    while (s.phase === "inProgress" && n < 500) {
      step(s, choose(s, n++));
      const vs = checkCombatInvariants(s);
      assert.equal(vs.length, 0, `seed ${seed} step ${n}: ${summarize(vs)}`);
    }
  }
});

// Part6 #1/#2 회귀: createRun은 무효 RunDef를 fail-fast로 거부(진행 중 늦은 throw·dangling toFloor 오인승리 방지).
test("invariant 게이트(Part6 #1/#2): createRun은 무효 RunDef를 즉시 거부, 유효는 통과", () => {
  const noClear: RunDef = { id: "bad", name: "bad", useMastery: false, entryFloorId: "f", roster: [{ charId: "kim", pos: { row: 0, col: 0 } }], floors: [{ id: "f", entryNodeId: "s", nodes: [{ id: "s", type: "start", q: 0, r: 0 }], edges: [] }] };
  assert.throws(() => createRun(1, noClear.roster, noClear), /invalid runDef/, "clear 없는 런은 거부");
  const danglingToFloor: RunDef = JSON.parse(JSON.stringify(DEFAULT_RUN));
  for (const f of danglingToFloor.floors) for (const n of f.nodes) if (n.type === "clear") n.toFloor = "nope"; // 미존재 층(#1 오인승리 유발 데이터)
  assert.throws(() => createRun(1, danglingToFloor.roster, danglingToFloor), /invalid runDef/, "dangling toFloor는 거부");
  assert.ok(createRun(1, DEFAULT_RUN.roster, DEFAULT_RUN), "유효 런은 통과");
});

test("invariant: 새 런(createRun)은 런 불변식 위반 0", () => {
  for (const seed of [0, 1, 2, 100]) {
    const run = createRun(seed, DEFAULT_RUN.roster, DEFAULT_RUN);
    assert.equal(checkRunInvariants(run).length, 0, `seed ${seed}: ${summarize(checkRunInvariants(run))}`);
  }
});

// 회귀: 캠페인 러너가 발견한 L8 — 승리/패배(종료) 시 reachable가 stale하게 남던 버그.
// completeFloor 승리분기·resolveBattleEnd 패배분기에서 reachable=[]로 비우도록 수정.
test("invariant L8 회귀: 종료(won/lost) 시 reachable=[] ∧ 런 불변식 위반 0", () => {
  const driveAi = (run: RunState): void => {
    let g = 0;
    while (run.phase !== "won" && run.phase !== "lost" && g++ < 3000) {
      if (run.phase === "map") {
        if (run.reachable.length === 0) break;
        enterNode(run, run.reachable[run.rng.int(0, run.reachable.length - 1)]);
      } else if (run.phase === "battle") {
        const b = run.battle!;
        let bg = 0;
        while (b.phase === "inProgress" && bg++ < 1500) step(b, chooseAction(b));
        resolveBattleEnd(run);
      } else if (run.phase === "reward") chooseReward(run, run.rewards![0].id);
      else if (run.phase === "shop") leaveShop(run);
      else if (run.phase === "encounter") chooseEncounterOption(run, run.encounter!.choices[0].id);
    }
  };
  let sawWon = false;
  let sawLost = false;
  for (let seed = 1; seed <= 60; seed++) {
    const run = createRun(seed, DEFAULT_RUN.roster, DEFAULT_RUN);
    driveAi(run);
    if (run.phase === "won" || run.phase === "lost") {
      assert.equal(run.reachable.length, 0, `seed ${seed} 종료(${run.phase})인데 reachable 비어있지 않음: ${run.reachable.join(",")}`);
      assert.equal(checkRunInvariants(run).length, 0, `seed ${seed} 종료 후 위반: ${summarize(checkRunInvariants(run))}`);
      if (run.phase === "won") sawWon = true; else sawLost = true;
    }
  }
  assert.ok(sawWon && sawLost, `won/lost 둘 다 도달해야 회귀가 의미 있음 (won=${sawWon}, lost=${sawLost})`);
});
