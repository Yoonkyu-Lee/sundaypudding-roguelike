// 헥스 타일맵 생성 (7.1) — axial 좌표 벌집. 간선은 좌표 인접성으로 암시. start↔boss 경로 프루닝.
// 생성 메커니즘(=엔진). 값(타입 가중치·분기·깊이)은 데이터(data/maps.ts MapGenConfig).
import { Rng } from "../rng.ts";
import type { MapGenConfig, NodeType } from "../types.ts";

export type { NodeType } from "../types.ts"; // 배럴 호환: 기존 `from run` import 유지

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

/** 노드 타입 추첨 — 첫 행은 고정(안전 시작), 이후는 nodeWeights 가중치(데이터). */
function pickType(rng: Rng, row: number, cfg: MapGenConfig): NodeType {
  if (row === 0) return cfg.firstRowType;
  const entries = Object.entries(cfg.nodeWeights) as [NodeType, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.int(1, total);
  for (const [t, w] of entries) { r -= w; if (r <= 0) return t; }
  return entries[0][0];
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

/** 헥스 타일맵 생성: 자식 규칙으로 벌집을 깔고, start↔boss 경로 밖 셀은 프루닝. 값=cfg(데이터). */
export function genMap(rng: Rng, cfg: MapGenConfig): RunNode[] {
  const choiceRows = cfg.rows;
  // 1) 행별 q 집합 (각 부모는 자식 q 또는 q-1을 가짐 → 연결 보장 + 분기)
  const rowsQ: number[][] = [[]];
  const w0 = rng.int(cfg.startWidth[0], cfg.startWidth[1]);
  for (let i = 0; i < w0; i++) rowsQ[0].push(i);
  for (let r = 1; r < choiceRows; r++) {
    const set = new Set<number>();
    for (const q of rowsQ[r - 1]) {
      set.add(rng.chance(cfg.branch.keepQChance) ? q : q - 1); // 최소 1자식
      if (rng.chance(cfg.branch.extraSameChance)) set.add(q);
      if (rng.chance(cfg.branch.extraLeftChance)) set.add(q - 1);
    }
    rowsQ[r] = [...set].sort((a, b) => a - b);
  }
  // 2) 보스 셀: 마지막 행의 중앙 자식 위치
  const last = rowsQ[choiceRows - 1];
  const qb = last[Math.floor(last.length / 2)];

  // 3) 셀 생성
  const cells: RunNode[] = [];
  for (let r = 0; r < choiceRows; r++) for (const q of rowsQ[r]) cells.push({ id: hid(q, r), q, r, type: pickType(rng, r, cfg) });
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
