import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward, buyShopOffer, leaveShop, chooseEncounterOption, movePartyMember, serializeRun, deserializeRun, genRewards, unlockedTier, ownsUpgradeLine, getRunView } from "./run.ts";
import { step, createBattle, getFormationBonus } from "./engine.ts";
import { SKILLS } from "../data/skills.ts";
import { chooseAction } from "./ai.ts";
import { ENCOUNTER_EVENTS } from "../data/events.ts";
import type { MapGenConfig } from "./types.ts";

const ROSTER = [
  { charId: "beef", pos: { row: 1, col: 0 } },
  { charId: "pudding", pos: { row: 2, col: 1 } },
  { charId: "jelly", pos: { row: 2, col: 2 } },
];

function autoRun(seed: number): string {
  const run = createRun(seed, ROSTER);
  let guard = 0;
  while (run.phase !== "won" && run.phase !== "lost" && guard < 300) {
    guard++;
    if (run.phase === "map") {
      enterNode(run, run.reachable[0]);
    } else if (run.phase === "battle") {
      let bg = 0;
      while (run.battle!.phase === "inProgress" && bg < 600) {
        step(run.battle!, chooseAction(run.battle!));
        bg++;
      }
      resolveBattleEnd(run);
    } else if (run.phase === "reward") {
      chooseReward(run, run.rewards![0].id);
    } else if (run.phase === "shop") {
      leaveShop(run); // 자동주행: 구매 없이 나감
    } else if (run.phase === "encounter") {
      chooseEncounterOption(run, ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId)!.choices[0].id);
    }
  }
  return run.phase;
}

test("런 결정론: 같은 시드 = 같은 맵", () => {
  const a = createRun(7, ROSTER);
  const b = createRun(7, ROSTER);
  assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes));
});

test("헥스맵 연결성: 시작 노드 포함 모든 셀이 start 도달 ∧ boss 도달 (프루닝 보장)", () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const run = createRun(seed, ROSTER);
    const has = (q: number, r: number) => run.nodes.some((n) => n.q === q && n.r === r);
    // 시작 노드(start)는 첫 행(r=0) 전체로 전진(허브), 그 외는 axial 인접
    const fwd = (c: { id: string; q: number; r: number; type: string }) =>
      c.type === "start"
        ? run.nodes.filter((n) => n.r === 0).map((n) => n.id)
        : [[c.q, c.r + 1], [c.q - 1, c.r + 1]].filter(([q, r]) => has(q, r)).map(([q, r]) => `${q}_${r}`);
    const minR = Math.min(...run.nodes.map((n) => n.r)); // -1 (시작)
    const maxR = Math.max(...run.nodes.map((n) => n.r)); // 보스
    const bossId = run.nodes.find((n) => n.type === "boss")!.id;
    const canBoss = new Set<string>([bossId]);
    for (let r = maxR - 1; r >= minR; r--) for (const c of run.nodes.filter((x) => x.r === r)) if (fwd(c).some((id) => canBoss.has(id))) canBoss.add(c.id);
    const fromStart = new Set<string>(run.nodes.filter((n) => n.type === "start").map((n) => n.id));
    for (let r = minR; r < maxR; r++) for (const c of run.nodes.filter((x) => x.r === r)) if (fromStart.has(c.id)) for (const id of fwd(c)) fromStart.add(id);
    for (const n of run.nodes) {
      assert.ok(canBoss.has(n.id), `seed ${seed}: ${n.id} 보스 도달 불가`);
      assert.ok(fromStart.has(n.id), `seed ${seed}: ${n.id} start 도달 불가`);
    }
  }
});

test("시작 노드: createRun 시 current=start, 다음 선택지=첫 행", () => {
  const run = createRun(7, ROSTER);
  assert.equal(run.currentNodeId, "start");
  assert.ok(run.nodes.some((n) => n.type === "start"));
  assert.ok(run.reachable.length > 0);
  assert.ok(run.reachable.every((id) => run.nodes.find((n) => n.id === id)!.r === 0));
});

test("런 완주: map→battle→reward 루프가 보스까지 가서 승/패로 종료", () => {
  for (const s of [1, 2, 3, 7, 42, 100]) {
    const phase = autoRun(s);
    assert.ok(phase === "won" || phase === "lost", `seed ${s}: ${phase}`);
  }
});

test("보상 강화: 보유·활성 스킬을 다음 티어로 교체 + map 복귀 (4.6)", () => {
  const run = createRun(1, ROSTER);
  run.phase = "reward";
  run.activeNodeId = run.nodes[0].id;
  const beef = run.party.find((m) => m.charId === "beef")!;
  assert.ok(beef.ownedSkillIds.includes("gangta") && beef.activeSkillIds.includes("gangta"));
  run.rewards = [{ id: "u", kind: "upgradeSkill", charId: "beef", fromSkillId: "gangta", toSkillId: "gangta_x", label: "t" }];
  chooseReward(run, "u");
  assert.ok(!beef.ownedSkillIds.includes("gangta") && beef.ownedSkillIds.includes("gangta_x"), "보유 티어 교체");
  assert.ok(beef.activeSkillIds.includes("gangta_x"), "활성도 강화 버전으로");
  assert.equal(run.phase, "map");
});

test("보상 새 스킬: 미보유 스킬을 보유 풀에 추가 (4.5)", () => {
  const run = createRun(1, ROSTER);
  run.phase = "reward";
  run.activeNodeId = run.nodes[0].id;
  const jelly = run.party.find((m) => m.charId === "jelly")!; // learnset 6, 보유=앞4
  const newId = "gwantongbuyeo"; // 미보유 학습기
  assert.ok(!jelly.ownedSkillIds.includes(newId));
  const before = jelly.ownedSkillIds.length;
  run.rewards = [{ id: "l", kind: "learnSkill", charId: "jelly", skillId: newId, label: "t" }];
  chooseReward(run, "l");
  assert.ok(jelly.ownedSkillIds.includes(newId), "보유 풀 추가");
  assert.equal(jelly.ownedSkillIds.length, before + 1);
});

test("보상 학습(4.6): 강화로 베이스가 교체되면 베이스가 학습 후보로 재출현 안 함(다운그레이드 방지)", () => {
  // ownsUpgradeLine 단위: 상위 티어 보유 = 라인 보유로 간주
  assert.equal(ownsUpgradeLine(["kim_punch2"], "kim_punch"), true, "종로의 주먹+ 보유 → 종로의 주먹 라인 보유");
  assert.equal(ownsUpgradeLine(["kim_punch"], "kim_punch"), true, "베이스 자체 보유");
  assert.equal(ownsUpgradeLine(["kim_kick"], "kim_punch"), false, "다른 스킬은 무관");
  // 통합: 종로의 주먹→종로의 주먹+ 강화 후 genRewards가 종로의 주먹(kim_punch)을 학습기로 제시하지 않음
  for (let s = 1; s <= 40; s++) {
    const run = createRun(s, [{ charId: "kim", pos: { row: 0, col: 0 } }]);
    const kim = run.party[0];
    kim.ownedSkillIds = kim.ownedSkillIds.map((id) => (id === "kim_punch" ? "kim_punch2" : id)); // 강화 시뮬레이션
    for (const r of genRewards(run)) {
      if (r.kind === "learnSkill") assert.notEqual(r.skillId, "kim_punch", `seed ${s}: 강화한 베이스가 학습 후보로 재출현`);
    }
  }
});

test("상점: 골드로 구매 → 적용 + 차감 + 항목 제거 (7.2)", () => {
  const run = createRun(1, ROSTER);
  run.gold = 100;
  run.phase = "shop";
  run.activeNodeId = run.nodes[0].id;
  run.shop = [{ id: "h", kind: "heal", cost: 15, pct: 0.5, label: "치료" }];
  run.party[0].hp = 1;
  buyShopOffer(run, "h");
  assert.equal(run.gold, 85, "골드 차감");
  assert.ok(run.party[0].hp > 1, "회복 적용");
  assert.equal(run.shop!.length, 0, "구매 항목 제거(재구매 방지)");
});

test("상점: 골드 부족이면 구매 불가", () => {
  const run = createRun(1, ROSTER);
  run.gold = 10;
  run.phase = "shop";
  run.activeNodeId = run.nodes[0].id;
  run.shop = [{ id: "h", kind: "heal", cost: 15, pct: 0.5, label: "치료" }];
  buyShopOffer(run, "h");
  assert.equal(run.gold, 10, "차감 안 됨");
  assert.equal(run.shop!.length, 1, "항목 유지");
});

test("RunView: 상점/인카운터/골드 화면 데이터 노출 (웹 렌더 계약)", () => {
  const run = createRun(1, ROSTER);
  run.gold = 50;
  run.phase = "shop";
  run.shop = [{ id: "x", kind: "heal", cost: 15, pct: 0.5, label: "치료" }];
  let v = getRunView(run);
  assert.equal(v.gold, 50);
  assert.equal(v.shop?.length, 1);
  run.phase = "encounter";
  run.shop = null;
  run.encounterId = "shrine";
  v = getRunView(run);
  assert.ok(v.encounter && v.encounter.choices.length >= 2, "인카운터 뷰(제목/선택지)");
  assert.equal(v.encounter!.title, "수상한 제단");
});

test("인카운터: 선택지 결과 적용 후 map 복귀 (7.2)", () => {
  const run = createRun(1, ROSTER);
  run.phase = "encounter";
  run.activeNodeId = run.nodes[0].id;
  run.encounterId = "cache"; // 안전 선택(loot=골드 +25)
  const before = run.gold;
  chooseEncounterOption(run, "loot");
  assert.equal(run.gold, before + 25, "골드 보상");
  assert.equal(run.phase, "map", "노드 완료 후 맵");
});

test("맵 데이터화: 커스텀 MapGenConfig가 깊이·첫행·타입 가중치를 제어 (7.1/7.3)", () => {
  const cfg: MapGenConfig = {
    rows: 5,
    startWidth: [2, 2],
    firstRowType: "rest",
    nodeWeights: { battle: 1 }, // 행1+는 battle만
    branch: { keepQChance: 50, extraSameChance: 0, extraLeftChance: 0 },
  };
  const run = createRun(7, ROSTER, [cfg]); // 1액트 런
  assert.equal(Math.max(...run.nodes.map((n) => n.r)), 5, "보스가 rows(=5) 깊이");
  assert.ok(run.nodes.some((n) => n.r === 0 && n.type === "rest"), "첫 행 = firstRowType");
  assert.ok(run.nodes.filter((n) => n.r >= 1 && n.r <= 4).every((n) => n.type === "battle"), "행1+ = nodeWeights(battle)만");
});

test("보스전은 적 진형 보너스 활성(6.3) — boss 노드 진입 시 enemyFormation 설정", () => {
  const run = createRun(2, ROSTER);
  const bossId = run.nodes.find((n) => n.type === "boss")!.id;
  run.reachable = [bossId];
  enterNode(run, bossId);
  assert.notEqual(run.battle, null);
  assert.notEqual(run.battle!.enemyFormation, null);
});

test("진형 편성: movePartyMember 이동/교대/같은칸 무시 (맵)", () => {
  const run = createRun(5, ROSTER); // beef(1,0) pudding(2,1) jelly(2,2)
  const beef = run.party.find((p) => p.charId === "beef")!;
  const pud = run.party.find((p) => p.charId === "pudding")!;
  // 빈 칸 이동
  movePartyMember(run, "beef", { row: 0, col: 3 });
  assert.deepEqual(beef.pos, { row: 0, col: 3 });
  // 점유 칸 → 위치 교대 (beef ↔ pudding)
  movePartyMember(run, "beef", { row: 2, col: 1 });
  assert.deepEqual(beef.pos, { row: 2, col: 1 });
  assert.deepEqual(pud.pos, { row: 0, col: 3 }); // pudding이 beef 직전 칸으로
  // 같은 칸 무시
  movePartyMember(run, "beef", { row: 2, col: 1 });
  assert.deepEqual(beef.pos, { row: 2, col: 1 });
});

test("진형 편성: 배치 변경이 전투 진형 보너스(열 분배)에 반영", () => {
  const run = createRun(5, ROSTER);
  movePartyMember(run, "beef", { row: 0, col: 0 }); // 0열(공격)
  movePartyMember(run, "pudding", { row: 1, col: 0 }); // 0열(공격) — 둘이 분배
  movePartyMember(run, "jelly", { row: 0, col: 3 }); // 3열(방어) 혼자
  const enc = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const g = createBattle(9, enc, run.party);
  const ub = g.units.find((u) => u.charId === "beef")!;
  const uj = g.units.find((u) => u.charId === "jelly")!;
  assert.equal(ub.pos.col, 0);
  assert.equal(getFormationBonus(g, ub, "attackPower"), 2); // 0열 총량4 ÷ 2명
  assert.equal(getFormationBonus(g, uj, "defensePower"), 4); // 3열 총량4 ÷ 1명
});

test("세이브 라운드트립: 상태·rng 연속성 보존 (이어하기)", () => {
  const run = createRun(11, ROSTER);
  run.gold = 42;
  run.inventory.push("iron_plate");
  movePartyMember(run, "beef", { row: 3, col: 3 });
  const json = serializeRun(run);
  const a = run.rng.next(); // 직렬화 시점 이후 원본의 다음 난수
  const r = deserializeRun(json)!;
  assert.equal(r.act, run.act);
  assert.equal(r.gold, 42);
  assert.deepEqual(r.inventory, run.inventory);
  assert.equal(r.party.length, run.party.length);
  assert.deepEqual(r.party.find((p) => p.charId === "beef")!.pos, { row: 3, col: 3 });
  assert.equal(r.rng.next(), a, "복원된 rng가 같은 다음 값 (결정론 보존)");
});

test("세이브 라운드트립: 전투 중 GameState·battle.rng 복원", () => {
  const run = createRun(11, ROSTER);
  const battleId = run.nodes.find((n) => n.type === "battle")!.id;
  run.reachable = [battleId];
  enterNode(run, battleId);
  assert.equal(run.phase, "battle");
  const json = serializeRun(run);
  const a = run.battle!.rng.next();
  const r = deserializeRun(json)!;
  assert.equal(r.phase, "battle");
  assert.equal(r.battle!.units.length, run.battle!.units.length);
  assert.equal(r.battle!.rng.next(), a, "복원된 battle.rng 연속성");
});

test("숙련도(4.4): unlockedTier 곡선 + 낮은 숙련도면 상위 tier 보상 미출현", () => {
  assert.equal(unlockedTier(0), 1);
  assert.equal(unlockedTier(2), 2);
  assert.equal(unlockedTier(5), 3);
  // 김두한(kim_punch t1→kim_punch2 t2 체인) 단독, 숙련도 0 + useMastery → tier2 강화 미출현
  const run = createRun(1, [{ charId: "kim", pos: { row: 0, col: 0 } }], undefined, { useMastery: true, mastery: { kim: 0 } });
  assert.equal(run.party[0].masteryLevel, 0);
  assert.equal(run.useMastery, true);
  for (const r of genRewards(run)) {
    if (r.kind === "upgradeSkill") assert.ok((SKILLS[r.toSkillId].tier ?? 1) <= 1, "숙련도0 → tier1 강화만");
    if (r.kind === "learnSkill") assert.ok((SKILLS[r.skillId].tier ?? 1) <= 1, "숙련도0 → tier1 학습만");
  }
  // useMastery off(기본)면 게이팅 없음
  assert.equal(createRun(1, [{ charId: "kim", pos: { row: 0, col: 0 } }]).useMastery, false);
});

test("다층(7.3): 액트 보스 격파→다음 액트(새 맵·파티 유지), 3액트 보스=게임 클리어", () => {
  const run = createRun(3, ROSTER);
  assert.equal(run.act, 1);
  assert.equal(run.acts.length, 3);
  const partyN = run.party.length;
  for (let expect = 1; expect <= 3; expect++) {
    assert.equal(run.act, expect);
    if (expect === 1) run.party[0].hp = 0; // 액트1 보스 전 1명 전투불능 → 액트 전환 부활 검증용
    const bossId = run.nodes.find((n) => n.type === "boss")!.id;
    run.reachable = [bossId];
    enterNode(run, bossId);
    assert.equal(run.phase, "battle");
    run.battle!.phase = "allyWin"; // 보스전 승리 강제(결정론)
    const goldBefore = run.gold;
    resolveBattleEnd(run);
    assert.equal(run.party.length, partyN, "파티 유지");
    if (expect < 3) {
      // 액트 보스 격파 = 골드 + 보상 선택 → 보상 후 다음 액트로
      assert.equal(run.phase, "reward", `액트${expect} 보스 후 보상 선택`);
      assert.ok(run.gold > goldBefore, "보스 격파 골드 보상");
      assert.ok(run.rewards && run.rewards.length > 0, "보스 보상 선택지 제시");
      chooseReward(run, run.rewards![0].id);
      assert.equal(run.phase, "map", `보상 후 액트${expect + 1} 맵`);
      assert.equal(run.act, expect + 1, "다음 액트로 진행");
      if (expect === 1) assert.ok(run.party[0].hp > 0, "액트 전환 시 전투불능 멤버 부활");
      assert.equal(Math.max(...run.nodes.map((n) => n.r)), run.acts[run.act - 1].rows, "새 액트 깊이 반영");
    } else {
      assert.equal(run.phase, "won", "3액트 보스 = 게임 클리어");
    }
  }
});
