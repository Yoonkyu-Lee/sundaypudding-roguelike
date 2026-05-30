// 런 관측(맵/파티/보상) — RunState → RunView. 전투 화면은 run.battle을 직접 사용.
import type { NodeStatus, RunState, RunView } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";

export function getRunView(run: RunState): RunView {
  return {
    phase: run.phase,
    rows: run.rows,
    nodes: run.nodes.map((n) => {
      let status: NodeStatus = "locked";
      if (run.currentNodeId === n.id) status = "current"; // 지금 서 있는 위치 (테두리)
      else if (run.reachable.includes(n.id)) status = "reachable"; // 다음 선택지 (다른 색 테두리)
      else if (run.activeNodeId === n.id) status = "active";
      else if (run.visited.includes(n.id)) status = "visited";
      return { id: n.id, q: n.q, r: n.r, type: n.type, status };
    }),
    party: run.party.map((m) => ({ name: CHARACTERS[m.charId].name, charId: m.charId, avatar: CHARACTERS[m.charId].avatar, hp: m.hp, maxHp: m.maxHp, alive: m.hp > 0 })),
    rewards: run.rewards,
    log: run.log.slice(-12),
  };
}
