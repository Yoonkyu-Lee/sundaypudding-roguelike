// 런 공유 변이 헬퍼 (leaf — run.ts·shop.ts·encounter.ts 공용, 사이클 방지).
// 노드 조회 + 파티 회복(+모험 트리거) + 노드 완료(+nodeClear) + 스킬 보유/강화 변이.
import type { PartyMemberState } from "../types.ts";
import type { RunState } from "./types.ts";
import { forwardIds, type RunNode } from "./map.ts";
import { fireRunTrigger } from "./passives.ts";

export function node(run: RunState, id: string): RunNode {
  const n = run.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node not found: ${id}`);
  return n;
}

/** 파티 회복. revive=true면 전투불능(hp≤0)도 maxHp*pct로 부활(휴식·액트전환). false면 생존자만 회복. */
export function healParty(run: RunState, pct: number, revive = false): void {
  for (const m of run.party) {
    if (m.hp <= 0) {
      if (revive) m.hp = Math.max(1, Math.round(m.maxHp * pct)); // 부활
      continue;
    }
    m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * pct));
  }
  fireRunTrigger(run, { on: "partyHpChange", dir: "heal" });
}

export function completeNode(run: RunState, nodeId: string): void {
  if (!run.visited.includes(nodeId)) run.visited.push(nodeId);
  const n = node(run, nodeId);
  run.currentNodeId = nodeId; // 지금 서 있는 위치 갱신
  run.reachable = forwardIds(run.nodes, n); // 전진(r+1) 인접 셀 (좌표로 계산)
  run.activeNodeId = null;
  run.phase = "map";
  fireRunTrigger(run, { on: "nodeClear", nodeType: n.type });
}

// 보유 풀/활성에서 스킬 티어 교체 (강화 — 보상·상점·인카운터 공유)
export function upgradeOwned(m: PartyMemberState, fromId: string, toId: string): void {
  const swap = (a: string[]) => { const i = a.indexOf(fromId); if (i >= 0) a[i] = toId; };
  swap(m.ownedSkillIds);
  swap(m.activeSkillIds);
}
// 보유 풀에 스킬 추가 (학습 — 여유 있으면 자동 활성)
export function learnOwned(m: PartyMemberState, skillId: string): void {
  if (m.ownedSkillIds.includes(skillId)) return;
  m.ownedSkillIds.push(skillId);
  if (m.activeSkillIds.length < 4) m.activeSkillIds.push(skillId);
}
