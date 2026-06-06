// 런 에디터 순수 변이(ops.ts) 단위 테스트 — DOM 무관(노드/변/층 그래프 조작).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addNode, addNodeFromTemplate, moveNode, moveNodes, deleteNode, toggleEdge, nodeAt, adjacentPairs, autoConnectAdjacent, addFloor, deleteFloor, moveFloor, setNodeLabel } from "./ops.ts";
import { hexAdjacent } from "../../contract/run.ts";
import type { FloorDef, RunDef } from "../../contract/types.ts";

const pairKey = (a: string, b: string) => [a, b].sort().join("|");
const edgeSet = (f: FloorDef) => new Set(f.edges.map((e) => pairKey(e.from, e.to)));

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

test("addNode: 전투 노드는 defaultCore(레이어) 시드, 구조 노드(clear)는 core 없음", () => {
  const f = floor();
  addNode(f, "battle", 1, 0);
  assert.ok((nodeAt(f, 1, 0)!.core?.length ?? 0) > 0, "battle은 core 시드(combat+gold+reward)");
  addNode(f, "clear", 3, 0);
  assert.equal(nodeAt(f, 3, 0)!.core, undefined, "clear는 구조 노드 — core 없음");
});

test("addNodeFromTemplate: content deep-clone 배치(원본 불변·인접 자동연결)", () => {
  const f = floor();
  const tpl = { label: "깡패 무리", core: [{ kind: "combat", roster: [{ charId: "shim", pos: { row: 1, col: 0 } }] }] as never };
  addNodeFromTemplate(f, "battle", tpl, 1, 0); // s·c와 인접
  const n = nodeAt(f, 1, 0)!;
  assert.equal(n.type, "battle");
  assert.equal(n.label, "깡패 무리");
  assert.equal(n.core!.length, 1);
  assert.equal(f.edges.length, 3, "s-c + 자동 s-n + 자동 c-n");
  // deep-clone: 배치 노드 변형이 템플릿 원본을 건드리지 않음
  (n.core![0] as { roster: { charId: string }[] }).roster.push({ charId: "kim" } as never);
  assert.equal((tpl.core[0] as { roster: unknown[] }).roster.length, 1, "원본 템플릿 roster 불변");
  addNodeFromTemplate(f, "battle", tpl, 1, 0); // 점유 → 무시
  assert.equal(f.nodes.length, 3);
});

test("U1 id 유일성: 같은 틱 연속 addNode/template도 노드 id 전부 유일", () => {
  const f = floor();
  // 빈 칸을 줄지어 채움(동일 ms 내 다수 추가 → counter로 분리돼야)
  const coords: [number, number][] = [[1, 0], [2, 0], [3, 0], [4, 0], [1, -1], [2, -1], [3, -1]];
  for (const [q, r] of coords) addNode(f, "battle", q, r);
  addNodeFromTemplate(f, "battle", { label: "x" }, 5, 0);
  const ids = f.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, `id 중복: ${ids.join(",")}`);
});

test("U3 moveNode: 좌표 외 필드(type/core/label/id) 불변", () => {
  const f = floor();
  addNode(f, "battle", 3, 0);
  const n = nodeAt(f, 3, 0)!;
  n.label = "관문";
  const { id, type, core } = n;
  const coreRef = core;
  moveNode(f, id, 1, 0);
  const after = nodeAt(f, 1, 0)!;
  assert.equal(after.id, id);
  assert.equal(after.type, type);
  assert.equal(after.label, "관문");
  assert.equal(after.core, coreRef, "core 참조 동일(좌표만 변경)");
});

test("U4/U7 변=인접쌍: 전체 autoConnect 결과 == adjacentPairs 집합(독립 구현 교차검증)", () => {
  const f = floor();
  for (const [q, r] of [[1, 0], [2, 0], [1, -1], [0, 2], [-1, 1]] as [number, number][]) addNode(f, "battle", q, r);
  // 변을 모두 지우고 전 노드에 autoConnect → adjacentPairs와 동일해야
  f.edges = [];
  for (const n of f.nodes) autoConnectAdjacent(f, n.id);
  const fromAuto = edgeSet(f);
  const fromPairs = new Set(adjacentPairs(f).map((p) => pairKey(p.a, p.b)));
  assert.deepEqual([...fromAuto].sort(), [...fromPairs].sort(), "autoConnect 전수 ≠ adjacentPairs");
  // 모든 변은 실제 헥스 인접쌍(U4)
  for (const e of f.edges) {
    const a = f.nodes.find((n) => n.id === e.from)!, b = f.nodes.find((n) => n.id === e.to)!;
    assert.ok(hexAdjacent(a, b), `비인접 변 ${e.from}-${e.to}`);
  }
});

test("U8 moveNodes: 비선택과 충돌하면 원자적 취소(false, 좌표 불변)", () => {
  const f = floor(); // s(0,0), c(0,1)
  addNode(f, "battle", 2, 0);
  addNode(f, "battle", 3, 0);
  const a = nodeAt(f, 2, 0)!, b = nodeAt(f, 3, 0)!;
  // a,b를 (-2,0) 이동하면 a→(0,0)=s 점유와 충돌 → 취소
  const ok = moveNodes(f, [a.id, b.id], -2, 0);
  assert.equal(ok, false);
  assert.equal(nodeAt(f, 2, 0)!.id, a.id, "a 원위치");
  assert.equal(nodeAt(f, 3, 0)!.id, b.id, "b 원위치");
});

test("U9 moveNodes: 군집 평행이동 — 내부 변 보존 + 군집째 이동", () => {
  const f = floor();
  addNode(f, "battle", 2, 0);
  addNode(f, "battle", 3, 0); // (2,0)-(3,0) 인접 → 자동 변
  const a = nodeAt(f, 2, 0)!, b = nodeAt(f, 3, 0)!;
  const internalEdge = pairKey(a.id, b.id);
  assert.ok(edgeSet(f).has(internalEdge), "사전: 내부 변 존재");
  const ok = moveNodes(f, [a.id, b.id], 0, 2); // 빈 영역으로 평행이동
  assert.equal(ok, true);
  assert.equal(nodeAt(f, 2, 2)!.id, a.id);
  assert.equal(nodeAt(f, 3, 2)!.id, b.id);
  assert.ok(edgeSet(f).has(internalEdge), "내부 변(벽 포함) 보존");
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
