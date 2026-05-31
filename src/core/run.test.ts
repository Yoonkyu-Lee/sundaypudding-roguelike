import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward, buyShopOffer, leaveShop, chooseEncounterOption, getRunView } from "./run.ts";
import { step } from "./engine.ts";
import { chooseAction } from "./ai.ts";
import { ENCOUNTER_EVENTS } from "../data/events.ts";

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

test("보스전은 적 진형 보너스 활성(6.3) — boss 노드 진입 시 enemyFormation 설정", () => {
  const run = createRun(2, ROSTER);
  const bossId = run.nodes.find((n) => n.type === "boss")!.id;
  run.reachable = [bossId];
  enterNode(run, bossId);
  assert.notEqual(run.battle, null);
  assert.notEqual(run.battle!.enemyFormation, null);
});
