// 맵 에디터 순수 변이(ops.ts) 단위 테스트 — DOM 무관(노드/변/층 그래프 조작).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addNode, moveNode, deleteNode, toggleEdge, nodeAt, adjacentPairs, addFloor, deleteFloor, moveFloor, setNodeLabel, setNodeRoster } from "./ops.ts";
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

test("toggleEdge: 인접만 토글(벽↔연결), 비인접 무시", () => {
  const f = floor();
  addNode(f, "battle", 3, 0); // (3,0) — s/c와 비인접(고립)
  const far = nodeAt(f, 3, 0)!.id;
  toggleEdge(f, "s", far); // 비인접 → 무시
  assert.equal(f.edges.length, 1);
  addNode(f, "battle", 1, 0); // (1,0) — s·c 인접 → 자동연결 +2
  const near = nodeAt(f, 1, 0)!.id;
  const before = f.edges.length;
  toggleEdge(f, "s", near); // 연결됨 → 벽(제거)
  assert.equal(f.edges.length, before - 1);
  toggleEdge(f, near, "s"); // 무방향 동일 변 → 다시 연결
  assert.equal(f.edges.length, before);
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

test("addNode: 인접 노드와 자동 연결(기본 연결 모델)", () => {
  const f = floor(); // s(0,0), c(0,1), edge s-c
  addNode(f, "battle", 1, 0); // (1,0)은 s(0,0)·c(0,1) 둘 다 인접
  const b = nodeAt(f, 1, 0)!.id;
  assert.equal(f.edges.length, 3, "s-c + 자동 s-b + 자동 c-b");
  assert.ok(f.edges.some((e) => (e.from === b && e.to === "s") || (e.from === "s" && e.to === b)));
});

test("moveNode: 점유 무시 / 이동 시 인접 변 재계산", () => {
  const f = floor();
  addNode(f, "battle", 3, 0); // 고립(인접 없음) → 자동 변 0, edges=1
  const b = nodeAt(f, 3, 0)!.id;
  assert.equal(f.edges.length, 1);
  moveNode(f, b, 1, 0); // s·c에 인접 → 자동 연결 2개
  assert.equal(f.edges.length, 3);
  moveNode(f, b, 5, 5); // 멀리 → 비인접 변 제거
  assert.equal(f.edges.length, 1);
  moveNode(f, b, 0, 0); // s 점유 칸 → 무시
  assert.ok(nodeAt(f, 5, 5), "점유 칸 이동 거부(원위치 유지)");
});

test("adjacentPairs: 무방향 인접쌍 열거(연결 여부 무관)", () => {
  const f = floor(); // s(0,0)-c(0,1) 인접
  assert.equal(adjacentPairs(f).length, 1);
  addNode(f, "battle", 1, 0); // s·c와 인접 → 쌍 3
  assert.equal(adjacentPairs(f).length, 3);
});

test("setNodeLabel: 설정/공백 제거(트림), 모든 노드 가능", () => {
  const f = floor();
  setNodeLabel(f, "c", "  최종 관문 ");
  assert.equal(nodeAt(f, 0, 1)!.label, "최종 관문"); // 트림
  setNodeLabel(f, "c", "   "); // 공백만 → 제거
  assert.equal(nodeAt(f, 0, 1)!.label, undefined);
});

test("setNodeRoster: 전투 노드만 override 설정, 빈 배열=제거, 비전투는 무시", () => {
  const f = floor();
  addNode(f, "battle", 1, 0);
  const b = nodeAt(f, 1, 0)!.id;
  setNodeRoster(f, b, [{ charId: "chunho", pos: { row: 0, col: 0 } }]);
  assert.equal(nodeAt(f, 1, 0)!.roster!.length, 1);
  setNodeRoster(f, b, []); // 빈 → 제거(타입 기본 복귀)
  assert.equal(nodeAt(f, 1, 0)!.roster, undefined);
  setNodeRoster(f, "c", [{ charId: "thug", pos: { row: 0, col: 0 } }]); // clear=비전투 → 무시
  assert.equal(nodeAt(f, 0, 1)!.roster, undefined);
});

test("addFloor/deleteFloor/moveFloor: 선형 층 편집", () => {
  const draft: RunDef = { id: "d", name: "d", useMastery: false, entryFloorId: "f", roster: [], floors: [floor()] };
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
