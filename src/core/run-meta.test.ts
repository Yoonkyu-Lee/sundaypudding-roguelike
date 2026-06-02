// 런 영속/메타/다층 테스트 — 세이브 라운드트립, 숙련도 게이팅, 액트 진행.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, movePartyMember, serializeRun, deserializeRun, genRewards, unlockedTier } from "./run.ts";
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
  assert.equal(r.floor, run.floor);
  assert.equal(r.runDef.id, run.runDef.id);
  assert.equal(r.gold, 42);
  assert.deepEqual(r.inventory, run.inventory);
  assert.equal(r.party.length, run.party.length);
  assert.deepEqual(r.party.find((p) => p.charId === "kim")!.pos, { row: 3, col: 3 });
  assert.equal(r.rng.next(), a, "복원된 rng가 같은 다음 값 (결정론 보존)");
});

test("세이브 라운드트립: 전투 중 GameState·battle.rng 복원", () => {
  const run = createRun(11, ROSTER);
  run.reachable = ["f1_b1"]; // 야인시대 floor0 전투 노드
  enterNode(run, "f1_b1");
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

test("다층(7.3): 클리어 노드 도달로 층 완료→다음 층(파티 유지·부활), 최종 층=게임 클리어", () => {
  const run = createRun(3, ROSTER);
  assert.equal(run.floor, 0);
  assert.equal(run.runDef.floors.length, 3);
  const partyN = run.party.length;
  const clears = ["f1_clear", "f2_clearA", "f3_clear"]; // 야인시대 각 층의 클리어 노드
  for (let f = 0; f < 3; f++) {
    assert.equal(run.floor, f);
    if (f === 0) run.party[0].hp = 0; // 층1 종료 전 1명 전투불능 → 층 전환 부활 검증
    run.reachable = [clears[f]];
    enterNode(run, clears[f]); // 클리어 노드 진입 = 층 종료(전투 없음)
    assert.equal(run.party.length, partyN, "파티 유지");
    if (f < 2) {
      assert.equal(run.phase, "map", `층${f + 1} 완료 후 다음 층 맵`);
      assert.equal(run.floor, f + 1, "다음 층으로 진행");
      if (f === 0) assert.ok(run.party[0].hp > 0, "층 전환 시 전투불능 멤버 부활");
    } else {
      assert.equal(run.phase, "won", "최종 층 클리어 = 게임 클리어");
    }
  }
});
