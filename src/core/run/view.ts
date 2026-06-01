// 런 관측(맵/파티/보상) — RunState → RunView. 전투 화면은 run.battle을 직접 사용.
import type { NodeStatus, RunState, RunView } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";
import { ENCOUNTER_EVENTS } from "../../data/events.ts";

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
    party: run.party.map((m) => ({
      name: CHARACTERS[m.charId].name,
      charId: m.charId,
      avatar: CHARACTERS[m.charId].avatar,
      pos: { ...m.pos }, // 진형 보드 렌더용 (6장)
      hp: m.hp,
      maxHp: m.maxHp,
      alive: m.hp > 0,
      skills: m.ownedSkillIds.map((sid) => ({
        id: sid,
        name: SKILLS[sid]?.name ?? sid,
        tier: SKILLS[sid]?.tier ?? 1,
        active: m.activeSkillIds.includes(sid),
        canUpgrade: !!SKILLS[sid]?.nextTierId,
        signature: !!SKILLS[sid]?.exclusiveTo, // 전용기(4.6)면 금테, 없으면 범용기
      })),
      activeCount: m.activeSkillIds.length,
    })),
    rewards: run.rewards,
    gold: run.gold,
    shop: run.shop,
    encounter: encounterView(run),
    log: run.log.slice(-12),
  };
}

function encounterView(run: RunState): RunView["encounter"] {
  if (run.phase !== "encounter" || !run.encounterId) return null;
  const ev = ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId);
  if (!ev) return null;
  return { id: ev.id, title: ev.title, text: ev.text, choices: ev.choices.map((c) => ({ id: c.id, label: c.label })) };
}
