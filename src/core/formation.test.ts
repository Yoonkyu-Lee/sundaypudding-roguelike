// 포메이션(6.1/6.3) + 데미지 미리보기 — 열 총량보존·보스전 적 적용·비크리 결정론.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, getFormationBonus, previewDamage, previewDamageParts } from "./engine.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import type { Encounter } from "../data/encounters.ts";
import { SKILLS } from "../data/skills.ts";

test("포메이션 총량보존: 같은 열 1명=전부, 2명=절반 (6.1)", () => {
  // 표준 배치: 0열 attackPower 4
  const enc: Encounter = {
    id: "t",
    name: "t",
    allies: [
      { charId: "beef", pos: { row: 0, col: 0 } },
      { charId: "pudding", pos: { row: 1, col: 0 } }, // 같은 0열
    ],
    enemies: [{ charId: "slime", pos: { row: 0, col: 0 } }],
  };
  const state = createBattle(1, enc);
  const beef = state.units.find((u) => u.name === "비프")!;
  const pud = state.units.find((u) => u.name === "푸딩")!;
  // 0열에 2명 → 각자 4/2 = 2
  assert.equal(getFormationBonus(state, beef, "attackPower"), 2);
  assert.equal(getFormationBonus(state, pud, "attackPower"), 2);
  // 푸딩을 1열로 옮기면 → 비프 혼자 0열 → 4 전부
  pud.pos = { row: 1, col: 1 };
  assert.equal(getFormationBonus(state, beef, "attackPower"), 4);
  assert.equal(getFormationBonus(state, pud, "attackPower"), 4); // 1열도 attack 4 단독
});

test("적 진형 보너스: 일반전투=미적용, 보스전=적용 (6.3)", () => {
  const base: Encounter = {
    id: "t",
    name: "t",
    allies: [{ charId: "beef", pos: { row: 0, col: 0 } }],
    enemies: [{ charId: "slime", pos: { row: 0, col: 0 } }],
  };
  const normal = createBattle(1, base);
  const e1 = normal.units.find((u) => u.side === "enemy")!;
  assert.equal(getFormationBonus(normal, e1, "attackPower"), 0); // 일반전투 적 = 0

  const boss = createBattle(1, { ...base, boss: true });
  const e2 = boss.units.find((u) => u.side === "enemy")!;
  assert.equal(getFormationBonus(boss, e2, "attackPower"), 4); // 보스전 적 = 적용
});

test("데미지 미리보기: 스킬상수+포메이션, 비크리 결정론 (타겟팅 UI용)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const beef = state.units.find((u) => u.name === "비프")!; // 강타 12, 0열 attackPower 4 단독
  // 강타 단독 데미지 = 12 + 4(포메이션) = 16
  assert.equal(previewDamage(state, beef, SKILLS["gangta"]), 16);
});

test("데미지 분해(자세히 보기): 기본+포메이션 = 최종, 라벨 노출", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const beef = state.units.find((u) => u.name === "비프")!; // 강타 12, 0열 attackPower 4 단독
  const b = previewDamageParts(state, beef, SKILLS["gangta"])!;
  assert.equal(b.total, 16);
  assert.equal(b.parts.reduce((s, p) => s + p.amount, 0), 16, "분해 합 = 최종(비-동상)");
  assert.ok(b.parts.some((p) => p.label === "기본" && p.amount === 12));
  assert.ok(b.parts.some((p) => p.label === "포메이션" && p.amount === 4));
  assert.equal(previewDamageParts(state, beef, SKILLS["suho"]), null, "비데미지 스킬은 null");
});
