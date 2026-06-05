// 런 공유 변이 헬퍼 (leaf — run.ts·shop.ts·encounter.ts 공용, 사이클 방지).
// 노드 조회 + 파티 회복(+모험 트리거) + 노드 완료(+nodeClear) + 스킬 보유/강화 변이.
import type { DecoratorLayer, FloorDef, MapNode, PartyMemberState } from "../types.ts";
import type { RunState } from "./types.ts";
import { roundDiv } from "../util.ts";
import { liveReachable } from "./graph.ts";
import { fireRunTrigger } from "./passives.ts";

/** 즉시 레이어 실행 (Phase A 슬라이스1) — 데코레이터 효과를 순서대로 적용 + 로그.
 *  러너가 leaf인 helpers에 사는 이유: completeNode(여기)가 onResolve를 발동 → 별 모듈로 빼면 사이클.
 *  상호작용 레이어(combat 등)는 A2의 호스트(run.ts 조율)에서 다룸. */
export function runInstantLayers(run: RunState, layers: DecoratorLayer[] | undefined): void {
  if (!layers) return;
  for (const L of layers) {
    switch (L.kind) {
      case "gold":
        run.gold = Math.max(0, run.gold + L.amount);
        run.log.push(`${L.amount >= 0 ? "+" : ""}${L.amount}G`);
        if (L.amount > 0) fireRunTrigger(run, { on: "goldGain" });
        break;
      case "heal":
        healParty(run, L.pct, !!L.revive);
        run.log.push(`파티 ${L.pct}% 회복`);
        break;
      case "grantStatus": {
        const ids = L.charId ? [L.charId] : run.party.map((m) => m.charId);
        for (const id of ids) (run.pendingStatuses[id] ??= []).push({ statusId: L.statusId, stacks: L.stacks, duration: L.duration });
        run.log.push(`상태 부여(다음 전투): ${L.statusId}`);
        break;
      }
      case "text":
        run.log.push(L.text);
        break;
    }
  }
}

/** 현재 층 그래프 (RunState의 단일 진실원 = runDef.floors[floor]). */
export function curFloor(run: RunState): FloorDef {
  return run.runDef.floors[run.floor];
}

export function node(run: RunState, id: string): MapNode {
  const n = curFloor(run).nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node not found: ${id}`);
  return n;
}

/** 파티 회복. pct=정수 퍼센트(50=50%). revive=true면 전투불능(hp≤0)도 maxHp×pct%로 부활(휴식·액트전환). false면 생존자만. */
export function healParty(run: RunState, pct: number, revive = false): void {
  for (const m of run.party) {
    if (m.hp <= 0) {
      if (revive) m.hp = Math.max(1, roundDiv(m.maxHp * pct, 100)); // 부활
      continue;
    }
    m.hp = Math.min(m.maxHp, m.hp + roundDiv(m.maxHp * pct, 100));
  }
  fireRunTrigger(run, { on: "partyHpChange", dir: "heal" });
}

export function completeNode(run: RunState, nodeId: string): void {
  if (!run.visited.includes(nodeId)) run.visited.push(nodeId);
  const n = node(run, nodeId);
  runInstantLayers(run, n.layers?.onResolve); // 노드 완료 시 부착 레이어(보상·연출 등)
  const floor = curFloor(run);
  run.currentNodeId = nodeId; // 지금 서 있는 위치 갱신
  // 다음 선택지 = 미방문 이웃 중 방문지를 피해 클리어 도달 가능한 노드 (재방문 불가·막힌 노드 비활성)
  run.reachable = liveReachable(floor, nodeId, new Set(run.visited));
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
