// 런 맵/흐름/진형 테스트 — 자유 방향그래프(저작 맵)·클리어 노드 층완료·완주 루프·진형 편성.
// (육성/상점 → run-progression.test.ts · 영속/메타/다층 → run-meta.test.ts · 그래프 원자 → map.test.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward, leaveShop, chooseEncounterOption, movePartyMember, curFloor, validateRun, liveReachable } from "./run.ts";
import { step, createBattle, getFormationBonus } from "./engine.ts";
import { chooseAction } from "./ai.ts";
import { ENCOUNTER_EVENTS } from "../data/events.ts";
import { DEFAULT_RUN } from "../data/runs/index.ts";
import type { RunDef } from "./types.ts";

const ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } },
  { charId: "shanghai", pos: { row: 2, col: 1 } },
  { charId: "cho", pos: { row: 2, col: 2 } },
];

function autoRun(seed: number): string {
  const run = createRun(seed, ROSTER);
  let guard = 0;
  while (run.phase !== "won" && run.phase !== "lost" && guard < 400) {
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
    } else if (run.phase === "shop") {
      leaveShop(run);
    } else if (run.phase === "encounter") {
      chooseEncounterOption(run, ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId)!.choices[0].id);
    }
  }
  return run.phase;
}

test("저작 런(야인시대)은 검증 통과 — 모든 노드가 entry→clear 경로상", () => {
  const v = validateRun(DEFAULT_RUN);
  assert.equal(v.ok, true, v.errors.join("; "));
});

test("createRun: current=floor0 entry, reachable=entry의 미방문 이웃(클리어 도달 가능만)", () => {
  const run = createRun(7, ROSTER);
  const f0 = curFloor(run);
  assert.equal(run.floor, 0);
  assert.equal(run.currentNodeId, f0.entryNodeId);
  assert.ok(run.reachable.length > 0);
  assert.deepEqual(run.reachable.sort(), liveReachable(f0, f0.entryNodeId, new Set([f0.entryNodeId])).sort());
});

test("런 완주: 클리어 노드 도달로 층 완료 → 3개 층 돌파 후 won/lost", () => {
  for (const s of [1, 2, 3, 7, 42, 100]) {
    const phase = autoRun(s);
    assert.ok(phase === "won" || phase === "lost", `seed ${s}: ${phase}`);
  }
});

test("클리어 노드 진입 = 층 종료(전투 없음). 갈림길: 어느 클리어든 완료. 최종층 클리어 = won", () => {
  // entry → bossA → clearA  /  entry → bossB → clearB (보스 2, 클리어 2)
  const twoFloors: RunDef = {
    id: "t", name: "t", useMastery: false,
    roster: [{ charId: "kim", pos: { row: 1, col: 0 } }],
    floors: [
      { id: "fa", entryNodeId: "e", nodes: [
        { id: "e", type: "start", q: 0, r: 0 },
        { id: "cA", type: "clear", q: 1, r: 0 },
        { id: "cB", type: "clear", q: 0, r: 1 },
      ], edges: [{ from: "e", to: "cA" }, { from: "e", to: "cB" }] },
      { id: "fb", entryNodeId: "e2", nodes: [
        { id: "e2", type: "start", q: 0, r: 0 },
        { id: "c2", type: "clear", q: 1, r: 0 },
      ], edges: [{ from: "e2", to: "c2" }] },
    ],
  };
  const run = createRun(1, twoFloors.roster, twoFloors);
  assert.deepEqual(run.reachable.sort(), ["cA", "cB"]);
  enterNode(run, "cB"); // 둘 중 하나 진입 → 1층 완료, 2층으로
  assert.equal(run.phase, "map");
  assert.equal(run.floor, 1);
  assert.equal(run.currentNodeId, "e2");
  enterNode(run, "c2"); // 최종 층 클리어 → won
  assert.equal(run.phase, "won");
});

test("보스전은 적 진형 보너스 활성(6.3) — boss 노드 진입 시 enemyFormation 설정", () => {
  const run = createRun(2, ROSTER); // 야인시대 floor0의 f1_boss
  run.reachable = ["f1_boss"];
  enterNode(run, "f1_boss");
  assert.notEqual(run.battle, null);
  assert.notEqual(run.battle!.enemyFormation, null);
});

test("진형 편성: movePartyMember 이동/교대/같은칸 무시 (맵)", () => {
  const run = createRun(5, ROSTER);
  const kim = run.party.find((p) => p.charId === "kim")!;
  const pud = run.party.find((p) => p.charId === "shanghai")!;
  movePartyMember(run, "kim", { row: 0, col: 3 });
  assert.deepEqual(kim.pos, { row: 0, col: 3 });
  movePartyMember(run, "kim", { row: 2, col: 1 });
  assert.deepEqual(kim.pos, { row: 2, col: 1 });
  assert.deepEqual(pud.pos, { row: 0, col: 3 });
  movePartyMember(run, "kim", { row: 2, col: 1 });
  assert.deepEqual(kim.pos, { row: 2, col: 1 });
});

test("진형 편성: 배치 변경이 전투 진형 보너스(열 분배)에 반영", () => {
  const run = createRun(5, ROSTER);
  movePartyMember(run, "kim", { row: 0, col: 0 });
  movePartyMember(run, "shanghai", { row: 1, col: 0 });
  movePartyMember(run, "cho", { row: 0, col: 3 });
  const enc = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const g = createBattle(9, enc, run.party);
  const ub = g.units.find((u) => u.charId === "kim")!;
  const uj = g.units.find((u) => u.charId === "cho")!;
  assert.equal(ub.pos.col, 0);
  assert.equal(getFormationBonus(g, ub, "attackPower"), 2);
  assert.equal(getFormationBonus(g, uj, "defensePower"), 4);
});
