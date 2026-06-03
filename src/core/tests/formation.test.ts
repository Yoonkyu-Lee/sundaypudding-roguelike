// 포메이션(6.1/6.3) + 데미지 미리보기 — 열 총량보존·보스전 적 적용·비크리 결정론.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, getFormationBonus, previewDamage, previewDamageParts } from "../engine.ts";
import { DEMO_ENCOUNTER } from "../../data/encounters.ts";
import type { Encounter } from "../../data/encounters.ts";
import { SKILLS } from "../../data/skills.ts";

test("포메이션 총량보존: 같은 열 1명=전부, 2명=절반 (6.1)", () => {
  // 표준 배치: 0열 attackPower 4
  const enc: Encounter = {
    id: "t",
    name: "t",
    allies: [
      { charId: "kim", pos: { row: 0, col: 0 } },
      { charId: "shin", pos: { row: 1, col: 0 } }, // 같은 0열
    ],
    enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }],
  };
  const state = createBattle(1, enc);
  const kim = state.units.find((u) => u.name === "김두한")!;
  const shin = state.units.find((u) => u.name === "신영균")!;
  // 0열에 2명 → 각자 4/2 = 2
  assert.equal(getFormationBonus(state, kim, "attackPower"), 2);
  assert.equal(getFormationBonus(state, shin, "attackPower"), 2);
  // 신영균을 1열로 옮기면 → 김두한 혼자 0열 → 4 전부
  shin.pos = { row: 1, col: 1 };
  assert.equal(getFormationBonus(state, kim, "attackPower"), 4);
  assert.equal(getFormationBonus(state, shin, "attackPower"), 4); // 1열도 attack 4 단독
});

test("적 진형 보너스: 일반전투=미적용, 보스전=적용 (6.3)", () => {
  const base: Encounter = {
    id: "t",
    name: "t",
    allies: [{ charId: "kim", pos: { row: 0, col: 0 } }],
    enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }],
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
  const kim = state.units.find((u) => u.name === "김두한")!; // 종로의 주먹 14, 0열 attackPower 4 단독
  // 종로의 주먹 단독 데미지 = 14 + 4(포메이션) = 18
  assert.equal(previewDamage(state, kim, SKILLS["kim_punch"]), 18);
});

test("데미지 분해(자세히 보기): 기본+포메이션 = 최종, 라벨 노출", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!; // 종로의 주먹 14, 0열 attackPower 4 단독
  const b = previewDamageParts(state, kim, SKILLS["kim_punch"])!;
  assert.equal(b.total, 18);
  assert.equal(b.parts.reduce((s, p) => s + p.amount, 0), 18, "분해 합 = 최종(비-동상)");
  assert.ok(b.parts.some((p) => p.label === "기본" && p.amount === 14));
  assert.ok(b.parts.some((p) => p.label === "포메이션" && p.amount === 4));
  assert.equal(previewDamageParts(state, kim, SKILLS["u_guard"]), null, "비데미지 스킬은 null");
});
