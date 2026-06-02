// 헥스 인접 무방향그래프 맵 엔진(graph.ts) 결정론 테스트.
// 변=맞닿은 헥스끼리 무방향 연결, 이동=미방문 이웃(재방문 불가), 막힌 이웃 비활성.
import { test } from "node:test";
import assert from "node:assert/strict";
import { neighborIds, hexAdjacent, clearNodeIds, reachableFromEntry, canReachClear, liveReachable, validateFloor, validateRun } from "./run.ts";
import type { FloorDef, MapNode, RunDef } from "./types.ts";

// entry(0,0) ─ A(1,0) ─ clearA(2,0)   /   entry ─ B(0,1) ─ clearB(0,2)  (갈림길, 모든 변 인접)
function branchFloor(): FloorDef {
  return {
    id: "f1", entryNodeId: "entry",
    nodes: [
      { id: "entry", type: "start", q: 0, r: 0 },
      { id: "A", type: "battle", q: 1, r: 0 },
      { id: "B", type: "battle", q: 0, r: 1 },
      { id: "clearA", type: "clear", q: 2, r: 0 },
      { id: "clearB", type: "clear", q: 0, r: 2 },
    ],
    edges: [
      { from: "entry", to: "A" }, { from: "A", to: "clearA" },
      { from: "entry", to: "B" }, { from: "B", to: "clearB" },
    ],
  };
}

test("hexAdjacent: 변 공유(거리1)만 인접", () => {
  const o = (q: number, r: number): MapNode => ({ id: "x", type: "battle", q, r });
  assert.equal(hexAdjacent(o(0, 0), o(1, 0)), true);
  assert.equal(hexAdjacent(o(0, 0), o(1, -1)), true);
  assert.equal(hexAdjacent(o(0, 0), o(2, 0)), false); // 거리2
  assert.equal(hexAdjacent(o(0, 0), o(1, 1)), false); // 비인접 방향
});

test("neighborIds: 무방향 — 변의 양쪽에서 모두 이웃", () => {
  const f = branchFloor();
  assert.deepEqual(neighborIds(f, "entry").sort(), ["A", "B"]);
  assert.deepEqual(neighborIds(f, "A").sort(), ["clearA", "entry"]); // 무방향: entry도 이웃
});

test("clearNodeIds / reachableFromEntry: 갈림길의 두 목표 + 전체 연결", () => {
  const f = branchFloor();
  assert.deepEqual(clearNodeIds(f).sort(), ["clearA", "clearB"]);
  assert.deepEqual([...reachableFromEntry(f)].sort(), ["A", "B", "clearA", "clearB", "entry"]);
});

test("liveReachable: entry의 미방문 이웃(클리어 도달 가능)", () => {
  const f = branchFloor();
  assert.deepEqual(liveReachable(f, "entry", new Set(["entry"])).sort(), ["A", "B"]);
});

test("재방문 불가: 방문지를 지나면 왔던 길(이웃이라도) 미제시", () => {
  const f = branchFloor();
  // entry→A 이동 후 A에서: entry는 방문 → 제외, clearA만
  assert.deepEqual(liveReachable(f, "A", new Set(["entry", "A"])), ["clearA"]);
});

test("막힌 가지 비활성: 되돌아가야만 클리어 닿는 이웃은 제시 안 함", () => {
  const f = branchFloor();
  // 죽은 가지: entry ─ D(leaf, 클리어로 가려면 entry로 복귀해야)
  f.nodes.push({ id: "D", type: "battle", q: 0, r: -1 }); // entry(0,0)와 인접(0,-1)
  f.edges.push({ from: "entry", to: "D" });
  // entry에서: A·B는 전진 가능, D는 (entry 방문 처리 시) 복귀 외 클리어 경로 없음 → 제외
  assert.deepEqual(liveReachable(f, "entry", new Set(["entry"])).sort(), ["A", "B"]);
  assert.equal(canReachClear(f, "D", new Set(["entry"])), false);
});

test("validateFloor: 갈림길 = 유효", () => {
  const v = validateFloor(branchFloor());
  assert.equal(v.ok, true, v.errors.join("; "));
  assert.deepEqual(v.deadNodes, []);
});

test("validateFloor: 인접하지 않은 변 거부(맞닿아야 변)", () => {
  const f = branchFloor();
  f.edges.push({ from: "entry", to: "clearA" }); // (0,0)↔(2,0) 거리2 = 비인접
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("인접하지 않은 변")));
});

test("validateFloor: 고립(연결 안 됨) 노드 탐지", () => {
  const f = branchFloor();
  f.nodes.push({ id: "iso", type: "battle", q: 9, r: 9 }); // 변 없는 고립
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.deepEqual(v.deadNodes, ["iso"]);
});

test("validateFloor: clear 노드 없으면 실패", () => {
  const f = branchFloor();
  f.nodes = f.nodes.map((n) => (n.type === "clear" ? { ...n, type: "battle" as const } : n));
  const v = validateFloor(f);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("clear")));
});

test("validateRun: 빈 층 실패 / 다층 유효", () => {
  const empty: RunDef = { id: "e", name: "빈", useMastery: false, roster: [], floors: [] };
  assert.equal(validateRun(empty).ok, false);
  const ok: RunDef = { id: "r", name: "런", useMastery: false, roster: [], floors: [branchFloor(), branchFloor()] };
  assert.equal(validateRun(ok).ok, true);
});
