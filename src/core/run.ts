// ─────────────────────────────────────────────────────────────────────────
// 런(run) 구조 — 분기 노드맵 + 전투/보상 루프 (7장). 전투 위 레이어.
// 전투는 engine.ts 재사용. 파티 HP·스킬강화(런 빌드)는 전투 사이 유지. 시드 결정론.
// ─────────────────────────────────────────────────────────────────────────

import { Rng } from "./rng.ts";
import { createBattle } from "./engine.ts";
import type { GameState, PartyMemberState, Phase, Pos } from "./types.ts";
import { CHARACTERS } from "../data/characters.ts";
import { SKILLS } from "../data/skills.ts";
import type { Placement } from "../data/encounters.ts";

export type NodeType = "start" | "battle" | "elite" | "shop" | "encounter" | "rest" | "boss";
export type RunPhase = "map" | "battle" | "reward" | "won" | "lost";

/**
 * 헥스 타일맵 셀 (axial 좌표 q,r). r=깊이(보스 방향, 클수록 보스에 가까움).
 * 간선은 별도 저장하지 않고 **좌표 인접성으로 암시**된다 (진짜 벌집).
 * 전진 = r+1 방향 인접 셀: (q, r+1) / (q-1, r+1) (pointy-top SE/SW).
 */
export interface RunNode {
  id: string;
  q: number;
  r: number;
  type: NodeType;
}

function hid(q: number, r: number): string {
  return `${q}_${r}`;
}

export type RewardOption =
  | { id: string; kind: "skillUp"; charId: string; skillId: string; amount: number; label: string }
  | { id: string; kind: "heal"; pct: number; label: string }
  | { id: string; kind: "maxhp"; charId: string; amount: number; label: string };

export interface RunState {
  rng: Rng;
  seed: number;
  rows: number; // 보스 제외 선택 층 수 (기본 3, parameterizable 7.3)
  nodes: RunNode[];
  party: PartyMemberState[];
  visited: string[];
  reachable: string[]; // 지금 선택 가능한 노드 (다음 선택지)
  currentNodeId: string; // 지금 서 있는(클리어한) 위치
  activeNodeId: string | null; // 전투/보상 중인 노드
  phase: RunPhase;
  battle: GameState | null;
  rewards: RewardOption[] | null;
  log: string[];
}

// ── 맵 생성 (결정론) ────────────────────────────────────────────────────────

function pickType(rng: Rng, row: number): NodeType {
  if (row === 0) return "battle"; // 첫 행은 일반전투로 안전 시작
  const pool: NodeType[] = ["battle", "battle", "battle", "elite", "rest", "shop", "encounter"];
  return pool[rng.int(0, pool.length - 1)];
}

/** 전진(r+1) 인접 셀 id 목록 — 좌표로 계산 (간선 데이터 없음). 시작 노드는 첫 행(r=0) 전체로 전진(허브) */
function forwardIds(nodes: RunNode[], c: RunNode): string[] {
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
function genMap(rng: Rng, choiceRows: number): RunNode[] {
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

// ── 적 구성 (노드 타입별) ───────────────────────────────────────────────────

function enemiesFor(type: NodeType): Placement[] {
  switch (type) {
    case "elite":
      return [
        { charId: "thug2", pos: { row: 1, col: 0 } },
        { charId: "thug", pos: { row: 2, col: 0 } },
        { charId: "jung", pos: { row: 1, col: 2 } }, // 좌익 정진영
      ];
    case "boss":
      // 좌익(조선공산당) 진영 — 보스전 적 진형 보너스 활성(6.3)
      return [
        { charId: "shim", pos: { row: 1, col: 0 } }, // 탱커(도발)
        { charId: "chunho", pos: { row: 2, col: 0 } }, // 암살자
        { charId: "jung", pos: { row: 1, col: 2 } }, // 딜러
        { charId: "doctor", pos: { row: 2, col: 2 } }, // 힐러
      ];
    default: // battle (잡몹)
      return [
        { charId: "thug", pos: { row: 1, col: 0 } },
        { charId: "thug", pos: { row: 2, col: 0 } },
        { charId: "thug2", pos: { row: 0, col: 0 } },
      ];
  }
}

// ── 런 생성 ──────────────────────────────────────────────────────────────────

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

function damagingSkills(charId: string): string[] {
  return CHARACTERS[charId].skillIds.filter((id) => SKILLS[id]?.effects.some((e) => e.kind === "damage"));
}

// ── 노드 진입 ────────────────────────────────────────────────────────────────

/** reachable 노드를 선택해 진입. 전투면 battle 생성, 아니면 즉시 해소 후 map. */
export function enterNode(run: RunState, nodeId: string): void {
  if (run.phase !== "map" || !run.reachable.includes(nodeId)) return;
  const n = node(run, nodeId);
  run.activeNodeId = nodeId;

  if (n.type === "battle" || n.type === "elite" || n.type === "boss") {
    const battleSeed = run.rng.int(0, 2_000_000_000);
    const enc = { id: n.type, name: n.type, allies: [], enemies: enemiesFor(n.type), boss: n.type === "boss" };
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

// ── 전투 종료 처리 ────────────────────────────────────────────────────────────

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

// ── 보상 (4.5: 항상 3택1) ────────────────────────────────────────────────────

function genRewards(run: RunState): RewardOption[] {
  const living = run.party.filter((m) => m.hp > 0);
  const opts: RewardOption[] = [];
  let k = 0;
  const mk = () => `rw${run.visited.length}_${k++}`;

  // 1) 스킬 강화 (데미지는 스킬 강화로만, 4.2)
  for (const m of living) {
    const sk = damagingSkills(m.charId);
    if (sk.length) {
      const skillId = sk[run.rng.int(0, sk.length - 1)];
      opts.push({ id: mk(), kind: "skillUp", charId: m.charId, skillId, amount: 3, label: `${CHARACTERS[m.charId].name} 「${SKILLS[skillId].name}」 +3 피해` });
      break;
    }
  }
  // 2) 최대 HP
  if (living.length) {
    const m = living[run.rng.int(0, living.length - 1)];
    opts.push({ id: mk(), kind: "maxhp", charId: m.charId, amount: 6, label: `${CHARACTERS[m.charId].name} 최대 HP +6` });
  }
  // 3) 전체 회복
  opts.push({ id: mk(), kind: "heal", pct: 0.4, label: "파티 전체 40% 회복" });
  return opts;
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

// ── 관측(맵/파티/보상) — 전투는 run.battle을 직접 사용 ──────────────────────

export type NodeStatus = "current" | "visited" | "active" | "reachable" | "locked";

export interface RunView {
  phase: RunPhase;
  rows: number;
  nodes: { id: string; q: number; r: number; type: NodeType; status: NodeStatus }[];
  party: { name: string; charId: string; avatar?: string; hp: number; maxHp: number; alive: boolean }[];
  rewards: RewardOption[] | null;
  log: string[];
}

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
