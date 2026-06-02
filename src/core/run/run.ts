// 런 흐름 — 생성/노드 진입/완료/전투종료/보상 (7장). 전투=combat, 맵=map.ts 재사용.
// 비전투 노드 해소는 shop.ts·encounter.ts, 공유 변이(node/heal/complete/skill)는 helpers.ts로 분리.
import { Rng } from "../rng.ts";
import { createBattle } from "../engine.ts";
import type { MapGenConfig, PartyMemberState, Phase, Pos } from "../types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { NODE_ROSTERS } from "../../data/encounters.ts";
import { ACTS } from "../../data/maps.ts";
import { ENCOUNTER_EVENTS } from "../../data/events.ts";
import { genMap } from "./map.ts";
import type { RunState } from "./types.ts";
import { genRewards } from "./rewards.ts";
import { fireRunTrigger } from "./passives.ts";
import { node, healParty, completeNode, upgradeOwned, learnOwned } from "./helpers.ts";
import { generateShop } from "./shop.ts";

export function createRun(seed: number, roster: { charId: string; pos: Pos }[], acts: MapGenConfig[] = ACTS, opts: { mastery?: Record<string, number>; useMastery?: boolean } = {}): RunState {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const map = acts[0];
  const nodes = genMap(rng, map);
  const party: PartyMemberState[] = roster.map((m) => {
    const c = CHARACTERS[m.charId];
    const owned = c.skillIds.slice(0, 4); // 시작 보유 = learnset 앞 4 (나머지는 학습기, 보상으로 습득)
    return { charId: m.charId, pos: { ...m.pos }, hp: c.hp, maxHp: c.hp, skillDmgBonus: {}, ownedSkillIds: owned, activeSkillIds: [...owned], equipped: {}, masteryLevel: opts.mastery?.[m.charId] ?? 0 };
  });
  return {
    rng,
    seed,
    act: 1,
    acts,
    useMastery: opts.useMastery ?? false,
    rows: map.rows,
    nodes,
    party,
    visited: ["start"],
    reachable: nodes.filter((n) => n.r === 0).map((n) => n.id), // 시작 노드의 전진 = 첫 행
    currentNodeId: "start",
    activeNodeId: null,
    phase: "map",
    battle: null,
    rewards: null,
    gold: 0,
    inventory: ["wood_bat", "leather_vest"], // 시작 인벤토리(맛보기) — 시트에서 장착
    shop: null,
    encounterId: null,
    pendingStatuses: {},
    log: [`런 시작 (seed ${seed})`],
  };
}

/** 진형 편성(6장): 아군 위치 변경 — 비전투 중 언제나. 대상 칸이 비면 이동, 다른 아군이 있으면 위치 교대(swap). */
export function movePartyMember(run: RunState, charId: string, to: Pos): void {
  if (run.phase === "battle") return; // 전투 중엔 불가
  if (to.row < 0 || to.row > 3 || to.col < 0 || to.col > 3) return; // 4×4 그리드 밖 거부
  const m = run.party.find((p) => p.charId === charId);
  if (!m) return;
  if (m.pos.row === to.row && m.pos.col === to.col) return; // 같은 칸 무시
  const other = run.party.find((p) => p.charId !== charId && p.pos.row === to.row && p.pos.col === to.col);
  if (other) other.pos = { ...m.pos }; // 점유 칸 → 위치 교대
  m.pos = { ...to };
}

/** 로드아웃(4.2): 활성 스킬 토글 — 보유 중에서 ≤4, 최소 1. 비전투 중 언제나. */
export function setActiveSkill(run: RunState, charId: string, skillId: string): void {
  if (run.phase === "battle") return;
  const m = run.party.find((p) => p.charId === charId);
  if (!m || !m.ownedSkillIds.includes(skillId)) return;
  const i = m.activeSkillIds.indexOf(skillId);
  if (i >= 0) { if (m.activeSkillIds.length > 1) m.activeSkillIds.splice(i, 1); } // 끄기(최소 1 유지)
  else if (m.activeSkillIds.length < 4) m.activeSkillIds.push(skillId); // 켜기(최대 4)
}

/** reachable 노드를 선택해 진입. 전투면 battle 생성, 아니면 즉시 해소 후 map. */
export function enterNode(run: RunState, nodeId: string): void {
  if (run.phase !== "map" || !run.reachable.includes(nodeId)) return;
  const n = node(run, nodeId);
  run.activeNodeId = nodeId;
  fireRunTrigger(run, { on: "nodeEnter", nodeType: n.type });

  if (n.type === "battle" || n.type === "elite" || n.type === "boss") {
    const battleSeed = run.rng.int(0, 2_000_000_000);
    const enc = { id: n.type, name: n.type, allies: [], enemies: NODE_ROSTERS[n.type] ?? NODE_ROSTERS.battle, boss: n.type === "boss" };
    // 모험 패시브 계승(pendingStatuses) 주입 후 1회 소비
    const allyStates = run.party.filter((m) => m.hp > 0).map((m) => ({ ...m, startStatuses: run.pendingStatuses[m.charId] }));
    run.battle = createBattle(battleSeed, enc, allyStates);
    run.pendingStatuses = {};
    run.phase = "battle";
    run.log.push(`${n.type} 진입`);
    return;
  }

  // 휴식: 즉시 해소
  if (n.type === "rest") {
    healParty(run, 0.5, true); // 재정비 거점: 전투불능도 부활 + 50% 회복
    run.log.push("휴식 — 전투불능 부활 + 파티 50% 회복");
    completeNode(run, nodeId);
    return;
  }
  // 상점: 진열 생성 후 상호작용 화면 (구매는 buyShopOffer, 나갈 때 leaveShop)
  if (n.type === "shop") {
    run.shop = generateShop(run);
    run.phase = "shop";
    run.log.push("상점 진입");
    return;
  }
  // 인카운터: 이벤트 추첨 후 선택지 화면 (chooseEncounterOption)
  if (n.type === "encounter") {
    const ev = ENCOUNTER_EVENTS[run.rng.int(0, ENCOUNTER_EVENTS.length - 1)];
    run.encounterId = ev.id;
    run.phase = "encounter";
    run.log.push(`인카운터 — ${ev.title}`);
    return;
  }
  completeNode(run, nodeId);
}

/** 다음 액트로 (7.3 다층): 새 맵 생성·진행 초기화·파티 50% 회복(숨돌리기). 결정론(run.rng). */
function advanceAct(run: RunState): void {
  run.act += 1;
  const map = run.acts[run.act - 1];
  run.rows = map.rows;
  run.nodes = genMap(run.rng, map);
  run.visited = ["start"];
  run.reachable = run.nodes.filter((n) => n.r === 0).map((n) => n.id);
  run.currentNodeId = "start";
  run.activeNodeId = null;
  run.battle = null;
  healParty(run, 0.5, true); // 액트 전환: 전투불능 부활 + 50% 회복
  run.phase = "map";
  run.log.push(`액트 ${run.act} 진입 — 전투불능 부활 + 파티 50% 회복`);
  fireRunTrigger(run, { on: "actStart" });
}

/** run.battle.phase가 종료 상태일 때 호출 — HP 반영, 승=보상/보스승=다음 액트(최종 보스=클리어), 패=실패. */
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
  // 최종 액트 보스 = 게임 클리어 (보상 없음, 끝)
  if (n.type === "boss" && run.act >= run.acts.length) {
    run.phase = "won";
    run.log.push("최종 보스 격파 — 게임 클리어!");
    return;
  }
  // 그 외 승리(일반/엘리트/액트 보스) = 골드 + 보상 3택1. 보스는 가장 큰 골드. (보상 선택 후 chooseReward가 다음 액트로)
  const goldGain = n.type === "boss" ? 24 : n.type === "elite" ? 16 : 8;
  run.gold += goldGain;
  fireRunTrigger(run, { on: "goldGain" });
  run.rewards = genRewards(run);
  run.phase = "reward";
  run.log.push(`${n.type === "boss" ? "보스 격파" : "전투 승리"} (+${goldGain}G) — 보상 선택`);
}

export function chooseReward(run: RunState, optionId: string): void {
  if (run.phase !== "reward" || !run.rewards) return;
  const opt = run.rewards.find((o) => o.id === optionId);
  if (!opt) return;
  if (opt.kind === "upgradeSkill") {
    const m = run.party.find((p) => p.charId === opt.charId);
    if (m) upgradeOwned(m, opt.fromSkillId, opt.toSkillId);
  } else if (opt.kind === "learnSkill") {
    const m = run.party.find((p) => p.charId === opt.charId);
    if (m) learnOwned(m, opt.skillId);
  } else if (opt.kind === "item") {
    run.inventory.push(opt.itemId); // 장신구 → 인벤토리(4.5)
  } else if (opt.kind === "heal") {
    healParty(run, opt.pct);
  }
  run.log.push(`보상: ${opt.label}`);
  run.rewards = null;
  // 액트 보스 보상을 받은 뒤 다음 액트로 진입(+전투불능 부활·50% 회복). 그 외엔 같은 액트 맵으로 복귀.
  if (node(run, run.activeNodeId!).type === "boss") {
    advanceAct(run);
  } else {
    run.battle = null;
    completeNode(run, run.activeNodeId!);
  }
}
