// 런 흐름 — 생성/노드 진입/완료/전투종료/보상 적용 (7장). 전투는 combat 재사용, 맵은 map.ts.
// (상점·인카운터 본구현이 커지면 비전투 해소를 nodes.ts로 분리할 것 — 파일 분리 규칙)
import { Rng } from "../rng.ts";
import { createBattle } from "../engine.ts";
import type { PartyMemberState, Phase, Pos } from "../types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { NODE_ROSTERS } from "../../data/encounters.ts";
import { forwardIds, genMap } from "./map.ts";
import type { RunNode } from "./map.ts";
import type { RunState } from "./types.ts";
import { damagingSkills, genRewards } from "./rewards.ts";

export function createRun(seed: number, roster: { charId: string; pos: Pos }[], rows = 3): RunState {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const nodes = genMap(rng, rows);
  const party: PartyMemberState[] = roster.map((m) => {
    const c = CHARACTERS[m.charId];
    return { charId: m.charId, pos: { ...m.pos }, hp: c.hp, maxHp: c.hp, skillDmgBonus: {} };
  });
  return {
    rng,
    seed,
    rows,
    nodes,
    party,
    visited: ["start"],
    reachable: nodes.filter((n) => n.r === 0).map((n) => n.id), // 시작 노드의 전진 = 첫 행
    currentNodeId: "start",
    activeNodeId: null,
    phase: "map",
    battle: null,
    rewards: null,
    log: [`런 시작 (seed ${seed})`],
  };
}

function node(run: RunState, id: string): RunNode {
  const n = run.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node not found: ${id}`);
  return n;
}

function healParty(run: RunState, pct: number): void {
  for (const m of run.party) {
    if (m.hp <= 0) continue; // 전투불능은 회복 안 함(런 빌드 휘발)
    m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * pct));
  }
}

/** reachable 노드를 선택해 진입. 전투면 battle 생성, 아니면 즉시 해소 후 map. */
export function enterNode(run: RunState, nodeId: string): void {
  if (run.phase !== "map" || !run.reachable.includes(nodeId)) return;
  const n = node(run, nodeId);
  run.activeNodeId = nodeId;

  if (n.type === "battle" || n.type === "elite" || n.type === "boss") {
    const battleSeed = run.rng.int(0, 2_000_000_000);
    const enc = { id: n.type, name: n.type, allies: [], enemies: NODE_ROSTERS[n.type] ?? NODE_ROSTERS.battle, boss: n.type === "boss" };
    run.battle = createBattle(battleSeed, enc, run.party.filter((m) => m.hp > 0));
    run.phase = "battle";
    run.log.push(`${n.type} 진입`);
    return;
  }

  // 비전투 노드: 즉시 해소
  if (n.type === "rest") {
    healParty(run, 0.5);
    run.log.push("휴식 — 파티 50% 회복");
  } else if (n.type === "shop") {
    healParty(run, 0.3);
    run.log.push("상점 — (준비 중) 30% 회복");
  } else if (n.type === "encounter") {
    // 인카운터: 생존 보장, 성장/저해 도박 (7.2)
    if (run.rng.chance(60)) {
      const m = run.party.find((p) => p.hp > 0);
      const sk = m ? damagingSkills(m.charId)[0] : null;
      if (m && sk) { m.skillDmgBonus[sk] = (m.skillDmgBonus[sk] ?? 0) + 4; run.log.push(`인카운터 — ${CHARACTERS[m.charId].name} 강화(+4)`); }
      else run.log.push("인카운터 — 별 일 없음");
    } else {
      for (const m of run.party) if (m.hp > 0) m.hp = Math.max(1, m.hp - Math.round(m.maxHp * 0.1));
      run.log.push("인카운터 — 함정! 파티 10% 피해");
    }
  }
  completeNode(run, nodeId);
}

function completeNode(run: RunState, nodeId: string): void {
  if (!run.visited.includes(nodeId)) run.visited.push(nodeId);
  const n = node(run, nodeId);
  run.currentNodeId = nodeId; // 지금 서 있는 위치 갱신
  run.reachable = forwardIds(run.nodes, n); // 전진(r+1) 인접 셀 (좌표로 계산)
  run.activeNodeId = null;
  run.phase = "map";
}

/** run.battle.phase가 종료 상태일 때 호출 — HP 반영, 승=보상/보스승=클리어, 패=실패. */
export function resolveBattleEnd(run: RunState): void {
  if (run.phase !== "battle" || !run.battle || run.battle.phase === "inProgress") return;
  const result: Phase = run.battle.phase;
  // 파티 HP 반영(전투 사이 유지)
  for (const m of run.party) {
    const u = run.battle.units.find((x) => x.side === "ally" && x.charId === m.charId);
    if (u) m.hp = Math.max(0, u.hp);
  }
  if (result === "enemyWin") {
    run.phase = "lost";
    run.log.push("전멸 — 런 실패");
    return;
  }
  // allyWin
  const n = node(run, run.activeNodeId!);
  if (n.type === "boss") {
    run.phase = "won";
    run.log.push("보스 격파 — 런 클리어!");
    return;
  }
  run.rewards = genRewards(run);
  run.phase = "reward";
  run.log.push("전투 승리 — 보상 선택");
}

export function chooseReward(run: RunState, optionId: string): void {
  if (run.phase !== "reward" || !run.rewards) return;
  const opt = run.rewards.find((o) => o.id === optionId);
  if (!opt) return;
  if (opt.kind === "skillUp") {
    const m = run.party.find((p) => p.charId === opt.charId);
    if (m) m.skillDmgBonus[opt.skillId] = (m.skillDmgBonus[opt.skillId] ?? 0) + opt.amount;
  } else if (opt.kind === "maxhp") {
    const m = run.party.find((p) => p.charId === opt.charId);
    if (m) { m.maxHp += opt.amount; m.hp += opt.amount; }
  } else if (opt.kind === "heal") {
    healParty(run, opt.pct);
  }
  run.log.push(`보상: ${opt.label}`);
  run.rewards = null;
  run.battle = null;
  completeNode(run, run.activeNodeId!);
}
