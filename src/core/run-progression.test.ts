// 런 육성/상점 테스트 — 보상(강화·학습), 상점 구매, RunView 계약, 인카운터.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, chooseReward, buyShopOffer, chooseEncounterOption, genRewards, ownsUpgradeLine, getRunView } from "./run.ts";

const ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } },
  { charId: "shanghai", pos: { row: 2, col: 1 } },
  { charId: "cho", pos: { row: 2, col: 2 } },
];

test("보상 강화: 보유·활성 스킬을 다음 티어로 교체 + map 복귀 (4.6)", () => {
  const run = createRun(1, ROSTER);
  run.phase = "reward";
  run.activeNodeId = run.currentNodeId;
  const kim = run.party.find((m) => m.charId === "kim")!;
  assert.ok(kim.ownedSkillIds.includes("kim_punch") && kim.activeSkillIds.includes("kim_punch"));
  run.rewards = [{ id: "u", kind: "upgradeSkill", charId: "kim", fromSkillId: "kim_punch", toSkillId: "kim_punch2", label: "t" }];
  chooseReward(run, "u");
  assert.ok(!kim.ownedSkillIds.includes("kim_punch") && kim.ownedSkillIds.includes("kim_punch2"), "보유 티어 교체");
  assert.ok(kim.activeSkillIds.includes("kim_punch2"), "활성도 강화 버전으로");
  assert.equal(run.phase, "map");
});

test("보상 새 스킬: 미보유 스킬을 보유 풀에 추가 (4.5)", () => {
  const run = createRun(1, ROSTER);
  run.phase = "reward";
  run.activeNodeId = run.currentNodeId;
  const cho = run.party.find((m) => m.charId === "cho")!; // learnset 6, 보유=앞4
  const newId = "u_guard"; // 미보유 학습기
  assert.ok(!cho.ownedSkillIds.includes(newId));
  const before = cho.ownedSkillIds.length;
  run.rewards = [{ id: "l", kind: "learnSkill", charId: "cho", skillId: newId, label: "t" }];
  chooseReward(run, "l");
  assert.ok(cho.ownedSkillIds.includes(newId), "보유 풀 추가");
  assert.equal(cho.ownedSkillIds.length, before + 1);
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
  run.activeNodeId = run.currentNodeId;
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
  run.activeNodeId = run.currentNodeId;
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
  // 조병옥(수전노=nodeClear 골드) 트레잇 간섭 피하려 골드 트레잇 없는 단독 파티로 정확값 검증
  const run = createRun(1, [{ charId: "kim", pos: { row: 1, col: 0 } }]);
  run.phase = "encounter";
  run.activeNodeId = run.currentNodeId;
  run.encounterId = "cache"; // 안전 선택(loot=골드 +25)
  const before = run.gold;
  chooseEncounterOption(run, "loot");
  assert.equal(run.gold, before + 25, "골드 보상");
  assert.equal(run.phase, "map", "노드 완료 후 맵");
});
