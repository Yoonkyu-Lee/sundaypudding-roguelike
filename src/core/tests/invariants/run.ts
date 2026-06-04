// 런 상태 불변식 검사기 (INVARIANTS-FROM-CLAUDE-CODE.md Part 2).
// 매 phase 전이 후 RunState를 받아 위반 목록 반환. 순수·무throw.
import type { RunState } from "../../run.ts";
import { curFloor, neighborIds, canReachClear } from "../../run.ts";
import { Violations, type Violation } from "./types.ts";

const BLOCK_PHASES = new Set(["battle", "reward", "shop", "encounter"]);

export function checkRunInvariants(run: RunState): Violation[] {
  const v = new Violations();

  // ── M8. 골드 비음수 ──
  v.check(run.gold >= 0, "M8", "CRIT", () => `gold<0 (${run.gold})`);

  // ── L8. 재방문 불가: reachable ∩ visited = ∅ ──
  const visitedSet = new Set(run.visited);
  for (const id of run.reachable) {
    v.check(!visitedSet.has(id), "L8", "CRIT", () => `reachable에 방문 노드: ${id}`);
  }
  // ── M13. visited 무중복 ──
  v.check(visitedSet.size === run.visited.length, "M13", "CRIT", () => `visited 중복 (${run.visited.join(",")})`);

  // ── M14. 시퀀서 상태 정합 ──
  if (run.phase === "map") {
    v.check(run.coreCursor === null, "M14", "CRIT", () => `phase=map인데 coreCursor=${run.coreCursor}`);
    v.check(run.activeNodeId === null, "M15", "NORM", () => `phase=map인데 activeNodeId=${run.activeNodeId}`);
  }
  if (run.coreCursor !== null && run.phase !== "won" && run.phase !== "lost") {
    v.check(BLOCK_PHASES.has(run.phase), "M14", "CRIT", () => `coreCursor≠null인데 phase=${run.phase}`);
  }

  // ── L7. reachable ⊆ {현재 이웃 ∧ 미방문 ∧ clear 도달가능} (map phase에서만 의미) ──
  if (run.phase === "map") {
    const floor = curFloor(run);
    const nbrs = new Set(neighborIds(floor, run.currentNodeId));
    for (const id of run.reachable) {
      v.check(nbrs.has(id), "L7", "CRIT", () => `reachable ${id}가 현재(${run.currentNodeId}) 이웃 아님`);
      v.check(canReachClear(floor, id, visitedSet), "L7", "CRIT", () => `reachable ${id}에서 clear 도달 불가`);
    }
    // 참조 무결성: currentNodeId가 현재 층에 존재
    v.check(floor.nodes.some((n) => n.id === run.currentNodeId), "L-ref", "CRIT", () => `currentNodeId(${run.currentNodeId}) 부재`);
  }

  // ── 층 인덱스 범위 ──
  v.check(run.floor >= 0 && run.floor < run.runDef.floors.length, "M-floor", "CRIT", () => `floor 범위 밖 (${run.floor}/${run.runDef.floors.length})`);

  // ── 파티: HP 경계 · 로드아웃 · 편성 ──
  const posSeen = new Set<string>();
  for (const m of run.party) {
    v.check(m.hp >= 0 && m.hp <= m.maxHp, "M20", "CRIT", () => `${m.charId} hp 범위 밖 (${m.hp}/${m.maxHp})`);
    const ownedSet = new Set(m.ownedSkillIds);
    const allOwned = m.activeSkillIds.every((id) => ownedSet.has(id));
    v.check(allOwned, "M17", "NORM", () => `${m.charId} activeSkillIds ⊄ owned`);
    v.check(m.activeSkillIds.length >= 1 && m.activeSkillIds.length <= 4, "M17", "NORM", () => `${m.charId} active 개수 ${m.activeSkillIds.length} (1~4 위반)`);
    v.check(m.pos.row >= 0 && m.pos.row <= 3 && m.pos.col >= 0 && m.pos.col <= 3, "M18", "NORM", () => `${m.charId} pos 격자 밖 (${m.pos.row},${m.pos.col})`);
    const key = `${m.pos.row},${m.pos.col}`;
    v.check(!posSeen.has(key), "M18", "NORM", () => `${m.charId} 편성 위치 중복 (${key})`);
    posSeen.add(key);
  }

  return v.list;
}
