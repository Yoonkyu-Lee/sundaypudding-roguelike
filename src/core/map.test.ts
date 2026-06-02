// 자유 방향그래프 맵 엔진(graph.ts) 결정론 테스트. 좌표암시 폐기 → 명시적 방향 간선·clear 노드.
import { test } from "node:test";
import assert from "node:assert/strict";
import { outgoingIds, clearNodeIds, reachableFromEntry, nodesReachingClear, validateFloor, validateRun } from "./run.ts";
import type { FloorDef, RunDef } from "./types.ts";

// entry → A(battle) → B(boss) → C(clear)
//   └──→ D(battle) → E(boss) → F(clear)   (갈림길: 보스 2, clear 2)
function branchFloor(): FloorDef {
  return {
    id: "f1", entryNodeId: "entry",
    nodes: [
      { id: "entry", type: "start", q: 0, r: 0 },
      { id: "A", type: "battle", q: 1, r: 0 },
      { id: "B", type: "boss", q: 2, r: 0 },
      { id: "C", type: "clear", q: 3, r: 0 },
      { id: "D", type: "battle", q: 1, r: 1 },
      { id: "E", type: "boss", q: 2, r: 1 },
      { id: "F", type: "clear", q: 3, r: 1 },
    ],
    edges: [
      { from: "entry", to: "A" }, { from: "A", to: "B" }, { from: "B", to: "C" },
      { from: "entry", to: "D" }, { from: "D", to: "E" }, { from: "E", to: "F" },
    ],
  };
}

test("outgoingIds: 방향 간선의 전진 인접만", () => {
  const f = branchFloor();
  assert.deepEqual(outgoingIds(f, "entry").sort(), ["A", "D"]);
  assert.deepEqual(outgoingIds(f, "B"), ["C"]);
  assert.deepEqual(outgoingIds(f, "C"), []); // clear는 말단
});

test("clearNodeIds: 갈림길의 두 목표 노드", () => {
  assert.deepEqual(clearNodeIds(branchFloor()).sort(), ["C", "F"]);
});

test("reachableFromEntry: entry에서 정방향 도달 = 전체", () => {
  const s = reachableFromEntry(branchFloor());
  assert.deepEqual([...s].sort(), ["A", "B", "C", "D", "E", "F", "entry"]);
});

test("nodesReachingClear: 역방향 BFS = 전체(모두 경로상)", () => {
  const s = nodesReachingClear(branchFloor());
  assert.deepEqual([...s].sort(), ["A", "B", "C", "D", "E", "F", "entry"]);
});

test("validateFloor: 갈림길 다중 보스/클리어 = 유효", () => {
  const v = validateFloor(branchFloor());
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.deepEqual(v.deadNodes, []);
});

test("validateFloor: clear 노드 없으면 실패", () => {
  const f = branchFloor();
  f.nodes = f.nodes.map((n) => (n.type === "clear" ? { ...n, type: "battle" as const } : n));
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("clear")));
});

test("validateFloor: 고립(경로 밖) 노드 탐지", () => {
  const f = branchFloor();
  f.nodes.push({ id: "X", type: "battle", q: 9, r: 9 }); // 간선 없는 고립 노드
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.deepEqual(v.deadNodes, ["X"]);
});

test("validateFloor: clear로 역도달 못 하는 막다른 가지 탐지", () => {
  const f = branchFloor();
  f.nodes.push({ id: "dead", type: "battle", q: 5, r: 5 });
  f.edges.push({ from: "A", to: "dead" }); // entry→A→dead, dead는 clear로 못 감
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.ok(v.deadNodes.includes("dead"));
});

test("validateFloor: entry가 어떤 clear에도 도달 못 하면 실패", () => {
  const f: FloorDef = {
    id: "x", entryNodeId: "entry",
    nodes: [
      { id: "entry", type: "start", q: 0, r: 0 },
      { id: "iso", type: "clear", q: 5, r: 5 }, // 간선 없음
    ],
    edges: [],
  };
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("도달 불가") || e.includes("고립")));
});

test("validateRun: 빈 층 실패 / 다층 유효", () => {
  const empty: RunDef = { id: "e", name: "빈", useMastery: false, roster: [], floors: [] };
  assert.equal(validateRun(empty).ok, false);

  const ok: RunDef = { id: "r", name: "런", useMastery: false, roster: [], floors: [branchFloor(), branchFloor()] };
  const v = validateRun(ok);
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.equal(v.floors.length, 2);
});
