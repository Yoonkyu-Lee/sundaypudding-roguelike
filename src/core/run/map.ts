// 헥스 타일맵 생성 (7.1) — axial 좌표 벌집. 간선은 좌표 인접성으로 암시. start↔boss 경로 프루닝.
import { Rng } from "../rng.ts";

export type NodeType = "start" | "battle" | "elite" | "shop" | "encounter" | "rest" | "boss";

/**
 * 헥스 타일맵 셀 (axial 좌표 q,r). r=깊이(보스 방향, 클수록 보스에 가까움).
 * 간선은 별도 저장하지 않고 **좌표 인접성으로 암시**된다. 전진 = (q,r+1)/(q-1,r+1).
 */
export interface RunNode {
  id: string;
  q: number;
  r: number;
  type: NodeType;
}

export function hid(q: number, r: number): string {
  return `${q}_${r}`;
}

function pickType(rng: Rng, row: number): NodeType {
  if (row === 0) return "battle"; // 첫 행은 일반전투로 안전 시작
  const pool: NodeType[] = ["battle", "battle", "battle", "elite", "rest", "shop", "encounter"];
  return pool[rng.int(0, pool.length - 1)];
}

/** 전진(r+1) 인접 셀 id 목록 — 좌표로 계산 (간선 데이터 없음). 시작 노드는 첫 행(r=0) 전체로 전진(허브) */
export function forwardIds(nodes: RunNode[], c: RunNode): string[] {
  if (c.type === "start") return nodes.filter((n) => n.r === 0).map((n) => n.id);
  const has = (q: number, r: number) => nodes.some((n) => n.q === q && n.r === r);
  return [
    [c.q, c.r + 1],
    [c.q - 1, c.r + 1],
  ]
    .filter(([q, r]) => has(q, r))
    .map(([q, r]) => hid(q, r));
}

/** 헥스 타일맵 생성: 자식 규칙으로 벌집을 깔고, start↔boss 경로 밖 셀은 프루닝 */
export function genMap(rng: Rng, choiceRows: number): RunNode[] {
  // 1) 행별 q 집합 (각 부모는 자식 q 또는 q-1을 가짐 → 연결 보장 + 분기)
  const rowsQ: number[][] = [[]];
  const w0 = rng.int(2, 3);
  for (let i = 0; i < w0; i++) rowsQ[0].push(i);
  for (let r = 1; r < choiceRows; r++) {
    const set = new Set<number>();
    for (const q of rowsQ[r - 1]) {
      set.add(rng.chance(50) ? q : q - 1); // 최소 1자식
      if (rng.chance(40)) set.add(q);
      if (rng.chance(40)) set.add(q - 1);
    }
    rowsQ[r] = [...set].sort((a, b) => a - b);
  }
  // 2) 보스 셀: 마지막 행의 중앙 자식 위치
  const last = rowsQ[choiceRows - 1];
  const qb = last[Math.floor(last.length / 2)];

  // 3) 셀 생성
  const cells: RunNode[] = [];
  for (let r = 0; r < choiceRows; r++) for (const q of rowsQ[r]) cells.push({ id: hid(q, r), q, r, type: pickType(rng, r) });
  cells.push({ id: hid(qb, choiceRows), q: qb, r: choiceRows, type: "boss" });

  // 4) 프루닝: start 도달 가능 ∧ boss 도달 가능 셀만 유지 → 막다른 길/고립 제거
  const bossId = hid(qb, choiceRows);
  const canBoss = new Set<string>([bossId]);
  for (let r = choiceRows - 1; r >= 0; r--) {
    for (const c of cells.filter((x) => x.r === r)) if (forwardIds(cells, c).some((id) => canBoss.has(id))) canBoss.add(c.id);
  }
  const fromStart = new Set<string>(cells.filter((c) => c.r === 0).map((c) => c.id));
  for (let r = 0; r < choiceRows; r++) {
    for (const c of cells.filter((x) => x.r === r)) if (fromStart.has(c.id)) for (const id of forwardIds(cells, c)) fromStart.add(id);
  }
  const kept = cells.filter((c) => canBoss.has(c.id) && fromStart.has(c.id));
  // 시작 노드: 첫 행 위 중앙에 단일 허브 (r=-1). 좌표 인접 무관하게 첫 행 전체로 전진
  const r0 = kept.filter((c) => c.r === 0);
  const qs = r0.length ? r0[Math.floor(r0.length / 2)].q : 0;
  kept.push({ id: "start", q: qs, r: -1, type: "start" });
  return kept;
}
