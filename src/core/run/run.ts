// 런 흐름 — 생성/노드 진입/완료/전투종료/보상 적용 (7장). 전투는 combat 재사용, 맵은 map.ts.
// (상점·인카운터 본구현이 커지면 비전투 해소를 nodes.ts로 분리할 것 — 파일 분리 규칙)
import { Rng } from "../rng.ts";
import { createBattle } from "../engine.ts";
import type { MapGenConfig, PartyMemberState, Phase, Pos } from "../types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";
import { NODE_ROSTERS } from "../../data/encounters.ts";
import { ACTS } from "../../data/maps.ts";
import { ENCOUNTER_EVENTS, type EncounterOutcome } from "../../data/events.ts";
import { forwardIds, genMap } from "./map.ts";
import type { RunNode } from "./map.ts";
import type { RunState, ShopOffer } from "./types.ts";
import { genRewards } from "./rewards.ts";
import { genItemOffers } from "./items.ts";

export function createRun(seed: number, roster: { charId: string; pos: Pos }[], acts: MapGenConfig[] = ACTS): RunState {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const map = acts[0];
  const nodes = genMap(rng, map);
  const party: PartyMemberState[] = roster.map((m) => {
    const c = CHARACTERS[m.charId];
    const owned = c.skillIds.slice(0, 4); // 시작 보유 = learnset 앞 4 (나머지는 학습기, 보상으로 습득)
    return { charId: m.charId, pos: { ...m.pos }, hp: c.hp, maxHp: c.hp, skillDmgBonus: {}, ownedSkillIds: owned, activeSkillIds: [...owned], equipped: {} };
  });
  return {
    rng,
    seed,
    act: 1,
    acts,
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
    log: [`런 시작 (seed ${seed})`],
  };
}

// 보유 풀/활성에서 스킬 티어 교체 (강화 — 보상·상점·인카운터 공유) */
function upgradeOwned(m: PartyMemberState, fromId: string, toId: string): void {
  const swap = (a: string[]) => { const i = a.indexOf(fromId); if (i >= 0) a[i] = toId; };
  swap(m.ownedSkillIds);
  swap(m.activeSkillIds);
}
// 보유 풀에 스킬 추가 (학습 — 여유 있으면 자동 활성) */
function learnOwned(m: PartyMemberState, skillId: string): void {
  if (m.ownedSkillIds.includes(skillId)) return;
  m.ownedSkillIds.push(skillId);
  if (m.activeSkillIds.length < 4) m.activeSkillIds.push(skillId);
}

function node(run: RunState, id: string): RunNode {
  const n = run.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node not found: ${id}`);
  return n;
}

/** 파티 회복. revive=true면 전투불능(hp≤0)도 maxHp*pct로 부활(휴식·액트전환). false면 생존자만 회복. */
function healParty(run: RunState, pct: number, revive = false): void {
  for (const m of run.party) {
    if (m.hp <= 0) {
      if (revive) m.hp = Math.max(1, Math.round(m.maxHp * pct)); // 부활
      continue;
    }
    m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * pct));
  }
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

  if (n.type === "battle" || n.type === "elite" || n.type === "boss") {
    const battleSeed = run.rng.int(0, 2_000_000_000);
    const enc = { id: n.type, name: n.type, allies: [], enemies: NODE_ROSTERS[n.type] ?? NODE_ROSTERS.battle, boss: n.type === "boss" };
    run.battle = createBattle(battleSeed, enc, run.party.filter((m) => m.hp > 0));
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

// ── 상점 (7.2) — 골드 구매. 강화권은 상점에서만(4.6) ──
function generateShop(run: RunState): ShopOffer[] {
  let k = 0;
  const mk = () => `shop${run.visited.length}_${k++}`;
  const pool: ShopOffer[] = [];
  for (const m of run.party.filter((p) => p.hp > 0)) {
    const c = CHARACTERS[m.charId];
    for (const sid of m.ownedSkillIds) {
      const sk = SKILLS[sid];
      const to = sk?.nextTierId ? SKILLS[sk.nextTierId] : undefined;
      if (sk && to) pool.push({ id: mk(), kind: "upgrade", cost: 25, charId: m.charId, fromSkillId: sid, toSkillId: sk.nextTierId!, label: `강화권: ${c.name} 「${sk.name}」→「${to.name}」` });
    }
    for (const sid of c.skillIds) {
      if (!m.ownedSkillIds.includes(sid) && !SKILLS[sid]?.exclusiveTo) pool.push({ id: mk(), kind: "learn", cost: 20, charId: m.charId, skillId: sid, label: `스킬: ${c.name} 「${SKILLS[sid].name}」(범용)` });
    }
  }
  const picked: ShopOffer[] = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(run.rng.int(0, pool.length - 1), 1)[0]);
  picked.push(...genItemOffers(run, mk, 2)); // 장착 아이템 진열 (4.3)
  picked.push({ id: mk(), kind: "heal", cost: 15, pct: 0.5, label: "치료: 파티 50% 회복" });
  return picked;
}

export function buyShopOffer(run: RunState, offerId: string): void {
  if (run.phase !== "shop" || !run.shop) return;
  const o = run.shop.find((x) => x.id === offerId);
  if (!o || run.gold < o.cost) return;
  run.gold -= o.cost;
  if (o.kind === "upgrade") { const m = run.party.find((p) => p.charId === o.charId); if (m) upgradeOwned(m, o.fromSkillId, o.toSkillId); }
  else if (o.kind === "learn") { const m = run.party.find((p) => p.charId === o.charId); if (m) learnOwned(m, o.skillId); }
  else if (o.kind === "buyItem") run.inventory.push(o.itemId); // 인벤토리에 추가 → 시트에서 장착
  else if (o.kind === "heal") healParty(run, o.pct);
  run.shop = run.shop.filter((x) => x.id !== offerId); // 구매한 항목 제거(재구매 방지)
  run.log.push(`구매: ${o.label} (−${o.cost}G)`);
}

export function leaveShop(run: RunState): void {
  if (run.phase !== "shop") return;
  run.shop = null;
  completeNode(run, run.activeNodeId!);
}

// ── 인카운터 (7.2) — 선택지/도박. 생존 보장(피해는 최소 HP1) ──
function applyOutcome(run: RunState, o: EncounterOutcome): void {
  if (o.kind === "heal") { healParty(run, o.pct); run.log.push(`파티 ${Math.round(o.pct * 100)}% 회복`); }
  else if (o.kind === "hurt") { for (const m of run.party) if (m.hp > 0) m.hp = Math.max(1, m.hp - Math.round(m.maxHp * o.pct)); run.log.push(`파티 ${Math.round(o.pct * 100)}% 피해`); }
  else if (o.kind === "gold") { run.gold = Math.max(0, run.gold + o.amount); run.log.push(`골드 ${o.amount >= 0 ? "+" : ""}${o.amount}`); }
  else if (o.kind === "upgradeRandom") {
    const cand = run.party.filter((m) => m.hp > 0).flatMap((m) => m.ownedSkillIds.filter((sid) => SKILLS[sid]?.nextTierId).map((sid) => ({ m, sid })));
    if (cand.length) { const p = cand[run.rng.int(0, cand.length - 1)]; upgradeOwned(p.m, p.sid, SKILLS[p.sid].nextTierId!); run.log.push(`${CHARACTERS[p.m.charId].name} 「${SKILLS[p.sid].name}」 강화!`); }
  } else if (o.kind === "learnUniversal") {
    const cand = run.party.filter((m) => m.hp > 0).flatMap((m) => CHARACTERS[m.charId].skillIds.filter((sid) => !m.ownedSkillIds.includes(sid) && !SKILLS[sid]?.exclusiveTo).map((sid) => ({ m, sid })));
    if (cand.length) { const p = cand[run.rng.int(0, cand.length - 1)]; learnOwned(p.m, p.sid); run.log.push(`${CHARACTERS[p.m.charId].name} 「${SKILLS[p.sid].name}」 습득!`); }
  }
}

export function chooseEncounterOption(run: RunState, choiceId: string): void {
  if (run.phase !== "encounter" || !run.encounterId) return;
  const ev = ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId);
  const ch = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !ch) return;
  let outcome: EncounterOutcome = ch.result ?? { kind: "nothing" };
  if (ch.gamble) { const win = run.rng.chance(ch.gamble.chance); run.log.push(`${ev.title}: ${win ? "성공!" : "실패…"}`); outcome = win ? ch.gamble.win : ch.gamble.lose; }
  applyOutcome(run, outcome);
  run.encounterId = null;
  completeNode(run, run.activeNodeId!);
}

function completeNode(run: RunState, nodeId: string): void {
  if (!run.visited.includes(nodeId)) run.visited.push(nodeId);
  const n = node(run, nodeId);
  run.currentNodeId = nodeId; // 지금 서 있는 위치 갱신
  run.reachable = forwardIds(run.nodes, n); // 전진(r+1) 인접 셀 (좌표로 계산)
  run.activeNodeId = null;
  run.phase = "map";
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
  if (n.type === "boss") {
    if (run.act < run.acts.length) { advanceAct(run); return; } // 다음 액트로
    run.phase = "won";
    run.log.push("최종 보스 격파 — 게임 클리어!");
    return;
  }
  run.gold += n.type === "elite" ? 16 : 8; // 전투 보상 골드(상점 통화)
  run.rewards = genRewards(run);
  run.phase = "reward";
  run.log.push(`전투 승리 (+${n.type === "elite" ? 16 : 8}G) — 보상 선택`);
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
  run.battle = null;
  completeNode(run, run.activeNodeId!);
}
