// 런 영속/메타/다층 테스트 — 세이브 라운드트립, 숙련도 게이팅, 액트 진행.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward, movePartyMember, serializeRun, deserializeRun, genRewards, unlockedTier } from "./run.ts";
import { SKILLS } from "../data/skills.ts";

const ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } },
  { charId: "shanghai", pos: { row: 2, col: 1 } },
  { charId: "cho", pos: { row: 2, col: 2 } },
];

test("세이브 라운드트립: 상태·rng 연속성 보존 (이어하기)", () => {
  const run = createRun(11, ROSTER);
  run.gold = 42;
  run.inventory.push("iron_plate");
  movePartyMember(run, "kim", { row: 3, col: 3 });
  const json = serializeRun(run);
  const a = run.rng.next(); // 직렬화 시점 이후 원본의 다음 난수
  const r = deserializeRun(json)!;
  assert.equal(r.act, run.act);
  assert.equal(r.gold, 42);
  assert.deepEqual(r.inventory, run.inventory);
  assert.equal(r.party.length, run.party.length);
  assert.deepEqual(r.party.find((p) => p.charId === "kim")!.pos, { row: 3, col: 3 });
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
