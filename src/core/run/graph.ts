// 헥스 인접 무방향그래프 맵 엔진 (메커니즘). 순수·결정론(rng 미사용).
// 변=인접한 두 헥스 사이 무방향 연결(디자이너 토글). 이동=미방문 이웃으로(재방문 불가, 전진만).
// 도달성 불변식: 모든 활성 노드는 어떤 clear 노드로 도달 가능해야(미방문 경로 기준 비활성).
import type { FloorDef, MapNode, RunDef } from "../types.ts";

/** pointy-top axial 6방향 이웃 오프셋. */
const HEX_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

/** 두 노드가 헥스 격자에서 변을 공유(인접)하는가. */
export function hexAdjacent(a: MapNode, b: MapNode): boolean {
  return HEX_DIRS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

/** node id → 노드 (없으면 undefined). */
export function mapNode(floor: FloorDef, id: string): MapNode | undefined {
  return floor.nodes.find((n) => n.id === id);
}

/** 무방향 이웃: nodeId가 한쪽 끝인 모든 변의 반대쪽 노드 id. */
export function neighborIds(floor: FloorDef, nodeId: string): string[] {
  const out: string[] = [];
  for (const e of floor.edges) {
    if (e.from === nodeId) out.push(e.to);
    else if (e.to === nodeId) out.push(e.from);
  }
  return out;
}

/** clear 노드 id 목록(목표 마커). */
export function clearNodeIds(floor: FloorDef): string[] {
  return floor.nodes.filter((n) => n.type === "clear").map((n) => n.id);
}

/** start에서 무방향 변으로 닿는 연결 성분(BFS). blocked에 든 노드는 통과 불가. */
function component(floor: FloorDef, startId: string, blocked?: Set<string>): Set<string> {
  const seen = new Set<string>();
  if (blocked?.has(startId)) return seen;
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const nxt of neighborIds(floor, id)) if (!seen.has(nxt) && !blocked?.has(nxt)) stack.push(nxt);
  }
  return seen;
}

/** entry에서 도달 가능한 노드 집합. */
export function reachableFromEntry(floor: FloorDef): Set<string> {
  return component(floor, floor.entryNodeId);
}

/** start에서 (blocked 회피) 어떤 clear 노드든 닿을 수 있는가. 재방문 불가 진행의 비활성 판정. */
export function canReachClear(floor: FloorDef, startId: string, blocked?: Set<string>): boolean {
  const reach = component(floor, startId, blocked);
  return clearNodeIds(floor).some((c) => reach.has(c));
}

/** 현재 위치에서 갈 수 있는 다음 노드: 미방문 이웃 중, 방문지를 피해 clear에 닿을 수 있는 것만. */
export function liveReachable(floor: FloorDef, currentId: string, visited: Set<string>): string[] {
  return neighborIds(floor, currentId).filter((n) => !visited.has(n) && canReachClear(floor, n, visited));
}

export interface FloorValidation {
  ok: boolean;
  errors: string[];
  /** entry 연결성분 밖(고립) 노드. 에디터가 비활성/수정 대상으로 표시. */
  deadNodes: string[];
}

/** 한 층 검증: entry·clear 존재, 변은 인접 헥스끼리만, 모든 노드가 entry와 연결 ∧ 그 성분에 clear. */
export function validateFloor(floor: FloorDef): FloorValidation {
  const errors: string[] = [];
  const byId = new Map(floor.nodes.map((n) => [n.id, n]));
  if (!byId.has(floor.entryNodeId)) errors.push(`entry 노드 없음: ${floor.entryNodeId}`);
  const clears = clearNodeIds(floor);
  if (clears.length === 0) errors.push("clear(목표) 노드가 없음");
  for (const e of floor.edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a) errors.push(`변 끝 미존재: ${e.from}`);
    if (!b) errors.push(`변 끝 미존재: ${e.to}`);
    if (a && b && !hexAdjacent(a, b)) errors.push(`인접하지 않은 변: ${e.from}↔${e.to}`); // 변은 맞닿은 헥스끼리만
  }
  const fromEntry = reachableFromEntry(floor);
  if (!clears.some((c) => fromEntry.has(c))) errors.push("entry에서 어떤 clear 노드에도 연결 안 됨");
  const deadNodes = floor.nodes.filter((n) => !fromEntry.has(n.id)).map((n) => n.id); // entry와 단절 = 고립
  if (deadNodes.length) errors.push(`고립(연결 안 됨) 노드: ${deadNodes.join(", ")}`);
  return { ok: errors.length === 0, errors, deadNodes };
}

export interface RunValidation {
  ok: boolean;
  errors: string[];
  floors: FloorValidation[];
}

/** 런 검증: 각 층 유효 + 층-그래프(clear.toFloor) 도달성 — 입장 층에서 전 층 도달 ∧ 승리 클리어(toFloor 없는) ≥1. */
export function validateRun(runDef: RunDef): RunValidation {
  const errors: string[] = [];
  const floors = runDef.floors.map((f) => validateFloor(f));
  floors.forEach((v, i) => { if (!v.ok) errors.push(`층 ${i + 1}(${runDef.floors[i].id}): ${v.errors.join("; ")}`); });
  if (runDef.floors.length === 0) { errors.push("층이 하나도 없음"); return { ok: false, errors, floors }; }

  const byId = new Map(runDef.floors.map((f) => [f.id, f]));
  const hasEntry = byId.has(runDef.entryFloorId);
  if (!hasEntry) errors.push(`입장 층 없음: ${runDef.entryFloorId}`);

  // clear.toFloor 링크로 입장 층에서 BFS — 도달 층 집합 + toFloor 무결성
  const reach = new Set<string>();
  if (hasEntry) {
    const stack = [runDef.entryFloorId];
    while (stack.length) {
      const fid = stack.pop()!;
      if (reach.has(fid)) continue;
      reach.add(fid);
      for (const n of byId.get(fid)!.nodes) {
        if (n.type !== "clear" || !n.toFloor) continue;
        if (!byId.has(n.toFloor)) errors.push(`존재하지 않는 다음 층(toFloor): ${n.toFloor}`);
        else if (!reach.has(n.toFloor)) stack.push(n.toFloor);
      }
    }
    const hasWin = [...reach].some((fid) => byId.get(fid)!.nodes.some((n) => n.type === "clear" && !n.toFloor));
    if (!hasWin) errors.push("승리(종료) 클리어 노드 없음 — toFloor 없는 clear 1개 이상 필요");
  }
  const unreached = runDef.floors.filter((f) => !reach.has(f.id)).map((f) => f.id);
  if (unreached.length) errors.push(`도달 불가 층: ${unreached.join(", ")}`);

  return { ok: errors.length === 0, errors, floors };
}
