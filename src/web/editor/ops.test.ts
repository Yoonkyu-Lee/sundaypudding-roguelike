// 맵 에디터 순수 변이(ops.ts) 단위 테스트 — DOM 무관(노드/변/층 그래프 조작).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addNode, deleteNode, toggleEdge, gridCells, nodeAt, addFloor, deleteFloor, moveFloor } from "./ops.ts";
import type { FloorDef, RunDef } from "../../core/types.ts";

function floor(): FloorDef {
  return {
    id: "f", entryNodeId: "s",
    nodes: [{ id: "s", type: "start", q: 0, r: 0 }, { id: "c", type: "clear", q: 0, r: 1 }],
    edges: [{ from: "s", to: "c" }],
  };
}

test("addNode: 빈 칸에 추가, 점유 칸은 무시", () => {
  const f = floor();
  addNode(f, "battle", 1, 0);
  assert.equal(f.nodes.length, 3);
  assert.equal(nodeAt(f, 1, 0)!.type, "battle");
  addNode(f, "elite", 1, 0); // 점유 → 무시
  assert.equal(f.nodes.length, 3);
});

test("toggleEdge: 인접만 토글, 비인접 무시", () => {
  const f = floor();
  addNode(f, "battle", 2, 0); // (2,0) — (0,0)과 비인접
  const far = nodeAt(f, 2, 0)!.id;
  toggleEdge(f, "s", far); // 비인접 → 무시
  assert.equal(f.edges.length, 1);
  addNode(f, "battle", 1, 0); // (1,0) — (0,0) 인접
  const near = nodeAt(f, 1, 0)!.id;
  toggleEdge(f, "s", near); // 추가
  assert.equal(f.edges.length, 2);
  toggleEdge(f, near, "s"); // 무방향 동일 변 → 제거
  assert.equal(f.edges.length, 1);
});

test("deleteNode: 입장 노드 보호, 일반 노드는 연결 변까지 제거", () => {
  const f = floor();
  addNode(f, "battle", 1, 0);
  const n = nodeAt(f, 1, 0)!.id;
  toggleEdge(f, "s", n);
  deleteNode(f, "s"); // 입장 → 보호
  assert.ok(nodeAt(f, 0, 0));
  deleteNode(f, n); // 일반 → 제거 + 변 정리
  assert.equal(nodeAt(f, 1, 0), undefined);
  assert.equal(f.edges.some((e) => e.from === n || e.to === n), false);
});

test("gridCells: 노드 바운딩박스 + 1링 빈 칸 포함", () => {
  const f = floor(); // nodes at (0,0),(0,1)
  const cells = gridCells(f);
  assert.ok(cells.some((c) => c.q === 0 && c.r === 0)); // 노드 칸
  assert.ok(cells.some((c) => c.q === -1 && c.r === -1)); // 링
  assert.ok(cells.some((c) => c.q === 1 && c.r === 2));
});

test("addFloor/deleteFloor/moveFloor: 선형 층 편집", () => {
  const draft: RunDef = { id: "d", name: "d", useMastery: false, roster: [], floors: [floor()] };
  addFloor(draft);
  assert.equal(draft.floors.length, 2);
  assert.equal(draft.floors[1].nodes.length, 2); // start+clear 시드
  const firstId = draft.floors[0].id;
  moveFloor(draft, 0, 1); // 0↔1 스왑
  assert.equal(draft.floors[1].id, firstId);
  deleteFloor(draft, 0);
  assert.equal(draft.floors.length, 1);
  deleteFloor(draft, 0); // 최소 1 유지
  assert.equal(draft.floors.length, 1);
});
