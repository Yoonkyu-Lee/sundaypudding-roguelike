// 자유 방향그래프 맵 엔진 (메커니즘). 순수·결정론(rng 미사용). 좌표암시 간선(구 genMap) 대체.
// 이동=간선 방향, 복귀 불가. 도달성 불변식: 모든 활성 노드는 어떤 clear 노드로 도달 가능해야.
import type { FloorDef, MapNode, RunDef } from "../types.ts";

/** node id → 노드 (없으면 undefined). */
export function mapNode(floor: FloorDef, id: string): MapNode | undefined {
  return floor.nodes.find((n) => n.id === id);
}

/** 전진 인접: nodeId에서 방향 간선이 향하는 노드 id들. */
export function outgoingIds(floor: FloorDef, nodeId: string): string[] {
  return floor.edges.filter((e) => e.from === nodeId).map((e) => e.to);
}

/** clear 노드 id 목록(목표 마커). */
export function clearNodeIds(floor: FloorDef): string[] {
  return floor.nodes.filter((n) => n.type === "clear").map((n) => n.id);
}

/** entry에서 방향 간선으로 도달 가능한 노드 집합(정방향 BFS). */
export function reachableFromEntry(floor: FloorDef): Set<string> {
  const seen = new Set<string>();
  const stack = [floor.entryNodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const nxt of outgoingIds(floor, id)) if (!seen.has(nxt)) stack.push(nxt);
  }
  return seen;
}

/** 어떤 clear 노드로 도달 가능한 노드 집합(역방향 BFS). 검증·플레이 중 비활성 판정 공용. */
export function nodesReachingClear(floor: FloorDef): Set<string> {
  const seen = new Set<string>(clearNodeIds(floor));
  const stack = [...seen];
  while (stack.length) {
    const id = stack.pop()!;
    // id로 향하는(거꾸로 탐색) 노드들
    for (const e of floor.edges) if (e.to === id && !seen.has(e.from)) { seen.add(e.from); stack.push(e.from); }
  }
  return seen;
}

export interface FloorValidation {
  ok: boolean;
  errors: string[];
  /** entry→clear 경로 어디에도 없는 노드(고립/막다른). 에디터가 비활성/수정 대상으로 표시. */
  deadNodes: string[];
}

/** 한 층 검증: entry·clear 존재, 간선 무결성, 모든 노드가 entry→clear 경로상. */
export function validateFloor(floor: FloorDef): FloorValidation {
  const errors: string[] = [];
  const ids = new Set(floor.nodes.map((n) => n.id));
  if (!ids.has(floor.entryNodeId)) errors.push(`entry 노드 없음: ${floor.entryNodeId}`);
  const clears = clearNodeIds(floor);
  if (clears.length === 0) errors.push("clear(목표) 노드가 없음");
  for (const e of floor.edges) {
    if (!ids.has(e.from)) errors.push(`간선 from 미존재: ${e.from}`);
    if (!ids.has(e.to)) errors.push(`간선 to 미존재: ${e.to}`);
  }
  const fromEntry = reachableFromEntry(floor);
  const toClear = nodesReachingClear(floor);
  if (!clears.some((c) => fromEntry.has(c))) errors.push("entry에서 어떤 clear 노드에도 도달 불가");
  // 경로상 = entry 도달 ∧ clear 역도달. 그 외 = dead.
  const deadNodes = floor.nodes.filter((n) => !(fromEntry.has(n.id) && toClear.has(n.id))).map((n) => n.id);
  if (deadNodes.length) errors.push(`경로 밖(고립) 노드: ${deadNodes.join(", ")}`);
  return { ok: errors.length === 0, errors, deadNodes };
}

export interface RunValidation {
  ok: boolean;
  errors: string[];
  floors: FloorValidation[];
}

/** 런 검증: 층≥1, 각 층 유효. (선형 체인이라 최종 층 도달성은 자명 — 분기는 후속) */
export function validateRun(runDef: RunDef): RunValidation {
  const errors: string[] = [];
  if (runDef.floors.length === 0) errors.push("층이 하나도 없음");
  const floors = runDef.floors.map((f) => validateFloor(f));
  floors.forEach((v, i) => { if (!v.ok) errors.push(`층 ${i + 1}(${runDef.floors[i].id}): ${v.errors.join("; ")}`); });
  return { ok: errors.length === 0, errors, floors };
}
