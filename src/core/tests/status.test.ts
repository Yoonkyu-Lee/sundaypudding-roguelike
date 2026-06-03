// 상태이상(3.5/3.6) — 빙결/공포/관통/불사/재생.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, getLegalActions, step } from "../engine.ts";
import { DEMO_ENCOUNTER } from "../../data/encounters.ts";
import { forceTurn } from "./testutil.ts";

test("빙결: 행동불가 → 합법행동은 스킵뿐, 1턴 후 해제 (3.5)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.statuses.push({ defId: "freeze", stacks: 1, duration: 1, sourceUid: "x" });
  forceTurn(state, kim.uid);

  const legal = getLegalActions(state);
  assert.equal(legal.length, 1);
  assert.equal(legal[0].action.type, "skip");

  step(state, { type: "skip" });
  // 정규 턴 종료 시 지속시간 차감 → 빙결 해제
  assert.ok(!kim.statuses.some((s) => s.defId === "freeze"));
});

test("공포: 쉴드 잠식 가속 — 1피해가 쉴드를 (스택)만큼 깎음, HP는 불변 (3.5)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const t = state.units.find((u) => u.side === "enemy")!;
  t.shield = 12;
  t.statuses.push({ defId: "fear", stacks: 3, duration: 2, sourceUid: "x" });
  forceTurn(state, state.units.find((u) => u.name === "김두한")!.uid);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.cooldowns = {};
  t.evasion = -100; // 명중 보장
  step(state, { type: "skill", skillId: "kim_punch", targetUid: t.uid });
  // 공포3 → 피해가 쉴드를 3배로 깎음. 쉴드 12는 피해 4만 흡수하고 소진.
  assert.ok(t.shield < 12, "쉴드가 가속 소진되어야");
});

test("관통: 공격자 보유 시 쉴드 무시하고 HP 직접 (3.6)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.statuses.push({ defId: "pierce", stacks: 1, duration: 2, sourceUid: "x" });
  kim.cooldowns = {};
  const t = state.units.find((u) => u.side === "enemy")!;
  t.shield = 50;
  t.evasion = -100;
  const hp0 = t.hp;
  forceTurn(state, kim.uid);
  step(state, { type: "skill", skillId: "kim_punch", targetUid: t.uid });
  assert.equal(t.shield, 50, "쉴드는 그대로(무시)");
  assert.ok(t.hp < hp0, "HP가 직접 깎여야");
});

test("불사: HP 0 이하여도 1턴 생존, 만료 후 사망 가능 (3.6)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.hp = 3;
  kim.statuses.push({ defId: "undying", stacks: 1, duration: 1, sourceUid: "x" });
  const enemy = state.units.find((u) => u.side === "enemy")!;
  enemy.cooldowns = {};
  kim.evasion = -100;
  forceTurn(state, enemy.uid);
  step(state, { type: "skill", skillId: "thug_punch", targetUid: kim.uid }); // 큰 피해
  assert.equal(kim.alive, true, "불사로 생존");
  assert.equal(kim.hp, 1, "HP 1로 버팀");
});

test("재생: 턴 종료 시 회복 (HoT, 3.6)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.hp = 10;
  kim.statuses.push({ defId: "regen", stacks: 2, duration: 3, sourceUid: "x" }); // 2*4=8 회복
  kim.cooldowns = {};
  forceTurn(state, kim.uid);
  const hp0 = kim.hp;
  step(state, { type: "skip" }); // 정규 턴 종료 시 재생 발동
  assert.ok(kim.hp > hp0, "재생으로 회복되어야");
});
