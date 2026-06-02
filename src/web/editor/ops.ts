// 맵 에디터 — 층 그래프 순수 변이 + 그리드 계산 (DOM/상태 없음). 컨트롤러가 호출.
import type { FloorDef, MapNode, NodeType, RunDef } from "../../core/types.ts";
import { hexAdjacent } from "../../core/run.ts";

let counter = 0;
/** 드래프트 내 고유 노드 id (웹 전용 — Date.now 허용). */
function newNodeId(): string { return `n${Date.now().toString(36)}${(counter++).toString(36)}`; }

export function nodeAt(floor: FloorDef, q: number, r: number): MapNode | undefined {
  return floor.nodes.find((n) => n.q === q && n.r === r);
}

function hasEdge(floor: FloorDef, a: string, b: string): boolean {
  return floor.edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
}

/** 인접한(변 공유) 모든 노드와 자동 연결 — 기존 변은 보존. (인접=기본 연결 모델) */
export function autoConnectAdjacent(floor: FloorDef, id: string): void {
  const n = floor.nodes.find((x) => x.id === id);
  if (!n) return;
  for (const m of floor.nodes) if (m.id !== id && hexAdjacent(n, m) && !hasEdge(floor, id, m.id)) floor.edges.push({ from: id, to: m.id });
}

/** 빈 칸에 노드 추가(점유 칸이면 무시) → 인접 노드와 자동 연결. */
export function addNode(floor: FloorDef, type: NodeType, q: number, r: number): void {
  if (nodeAt(floor, q, r)) return;
  const id = newNodeId();
  floor.nodes.push({ id, type, q, r });
  autoConnectAdjacent(floor, id);
}

/** 노드 이동(점유 칸이면 무시): 좌표 갱신 → 비인접 변 제거 + 새로 인접해진 노드만 자동 연결(기존 인접쌍의 벽 보존). */
export function moveNode(floor: FloorDef, id: string, q: number, r: number): void {
  if (nodeAt(floor, q, r)) return;
  const n = floor.nodes.find((x) => x.id === id);
  if (!n) return;
  const prevAdj = new Set(floor.nodes.filter((m) => m.id !== id && hexAdjacent(n, m)).map((m) => m.id));
  n.q = q; n.r = r;
  floor.edges = floor.edges.filter((e) => {
    if (e.from !== id && e.to !== id) return true;
    const om = floor.nodes.find((x) => x.id === (e.from === id ? e.to : e.from));
    return !!om && hexAdjacent(n, om); // 비인접이 된 변 제거
  });
  for (const m of floor.nodes) if (m.id !== id && hexAdjacent(n, m) && !prevAdj.has(m.id) && !hasEdge(floor, id, m.id)) floor.edges.push({ from: id, to: m.id });
}

/** 모든 무방향 인접쌍(연결 여부 무관). 벽(인접·미연결) 렌더 산출에 사용. */
export function adjacentPairs(floor: FloorDef): { a: string; b: string }[] {
  const out: { a: string; b: string }[] = [];
  const ns = floor.nodes;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (hexAdjacent(ns[i], ns[j])) out.push({ a: ns[i].id, b: ns[j].id });
  return out;
}

/** 노드 삭제(입장 노드는 보호) + 연결 변 제거. */
export function deleteNode(floor: FloorDef, id: string): void {
  if (floor.entryNodeId === id) return;
  floor.nodes = floor.nodes.filter((n) => n.id !== id);
  floor.edges = floor.edges.filter((e) => e.from !== id && e.to !== id);
}

/** 인접한 두 노드 사이 무방향 변 토글(비인접/동일은 무시). */
export function toggleEdge(floor: FloorDef, a: string, b: string): void {
  if (a === b) return;
  const na = floor.nodes.find((n) => n.id === a);
  const nb = floor.nodes.find((n) => n.id === b);
  if (!na || !nb || !hexAdjacent(na, nb)) return;
  const i = floor.edges.findIndex((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  if (i >= 0) floor.edges.splice(i, 1);
  else floor.edges.push({ from: a, to: b });
}

/** 새 층 추가 — 입장 start + 목표 clear 시드(인접·연결, 바로 유효). 선형 체인 끝에. */
export function addFloor(draft: RunDef): void {
  const fid = `f${Date.now().toString(36)}${counter++}`;
  const sid = `${fid}_start`, cid = `${fid}_clear`;
  draft.floors.push({
    id: fid, name: `층 ${draft.floors.length + 1}`, entryNodeId: sid,
    nodes: [{ id: sid, type: "start", q: 0, r: 0 }, { id: cid, type: "clear", q: 0, r: 1 }],
    edges: [{ from: sid, to: cid }],
  });
}
/** 층 삭제(최소 1개 유지). */
export function deleteFloor(draft: RunDef, idx: number): void {
  if (draft.floors.length > 1) draft.floors.splice(idx, 1);
}
/** 층 순서 이동(dir=-1 앞 / +1 뒤). */
export function moveFloor(draft: RunDef, idx: number, dir: number): void {
  const j = idx + dir;
  if (j < 0 || j >= draft.floors.length) return;
  [draft.floors[idx], draft.floors[j]] = [draft.floors[j], draft.floors[idx]];
}

/** 드롭/렌더 셀 = 노드 바운딩박스 + 1링(빈 칸 = 드롭 슬롯). axial 사각 영역. */
export function gridCells(floor: FloorDef): { q: number; r: number }[] {
  if (floor.nodes.length === 0) return [{ q: 0, r: 0 }];
  const qs = floor.nodes.map((n) => n.q);
  const rs = floor.nodes.map((n) => n.r);
  const out: { q: number; r: number }[] = [];
  for (let q = Math.min(...qs) - 1; q <= Math.max(...qs) + 1; q++)
    for (let r = Math.min(...rs) - 1; r <= Math.max(...rs) + 1; r++) out.push({ q, r });
  return out;
}
