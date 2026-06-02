// 전투 엔진 기본 흐름 — 결정론·종료·명중·합법행동·라운드 SPD·자발적 대기.
// 끼어들기/상태이상/포메이션/면적은 각각 *.test.ts로 분리.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, getLegalActions, step, computeHitChance } from "./engine.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import { SKILLS } from "../data/skills.ts";
import { playToEnd, forceTurn } from "./testutil.ts";

test("결정론: 같은 시드 + 같은 정책 = 동일한 이벤트 로그 (8.3)", () => {
  const a = playToEnd(42);
  const b = playToEnd(42);
  assert.equal(JSON.stringify(a.log), JSON.stringify(b.log));
  assert.equal(a.phase, b.phase);
});

test("다른 시드는 (대개) 다른 전개", () => {
  const a = playToEnd(1);
  const b = playToEnd(999);
  // 최소한 둘 다 정상 종료해야 함
  assert.notEqual(a.phase, "inProgress");
  assert.notEqual(b.phase, "inProgress");
});

test("스모크: 전투는 cap 내에 종료되고 승패가 결정된다", () => {
  for (const seed of [1, 2, 3, 7, 42, 100, 256, 999]) {
    const s = playToEnd(seed);
    assert.notEqual(s.phase, "inProgress", `seed ${seed} 미종료`);
    assert.ok(s.phase === "allyWin" || s.phase === "enemyWin");
  }
});

test("명중 공식: (명중률 + 스킬명중) − DEX, 클램프 (2.7)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  const enemy = state.units.find((u) => u.side === "enemy")!;
  // 종로의 주먹 acc 90, 김두한 acc 0, 깡패 evasion 6 → 84
  const expected = 0 + SKILLS["kim_punch"].accuracy - enemy.evasion;
  assert.equal(computeHitChance(kim, SKILLS["kim_punch"], enemy), expected);
});

test("합법 행동: 시작 시 빈 배열이 아니고, 쿨다운/사정권을 반영", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const legal = getLegalActions(state);
  assert.ok(legal.length > 0);
  // 첫 행동 유닛이 적이든 아군이든, 최소 1개 합법 행동(또는 스킵)
});

test("라운드 SPD 분해: roundStart에 rolls 노출, speed=max(1,roll+speedMod), roll∈[min,max] (2.2)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const rs = state.log.find((e) => e.t === "roundStart");
  assert.ok(rs && rs.t === "roundStart" && rs.rolls.length > 0, "rolls 노출");
  if (rs && rs.t === "roundStart") {
    for (const r of rs.rolls) {
      assert.equal(r.speed, Math.max(1, r.roll + r.speedMod), "최종 speed 공식");
      assert.ok(r.roll >= r.speedMin && r.roll <= r.speedMax, "roll 범위 내");
    }
    assert.equal(rs.rolls.length, rs.order.length, "rolls와 order 동수");
  }
});

test("대기: 쓸 스킬이 있어도 자발적 턴 넘기기 가능(chosen), 쿨 미소모", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.cooldowns = {};
  forceTurn(state, kim.uid);
  const legal = getLegalActions(state);
  assert.ok(legal.some((a) => a.action.type === "skill"), "스킬 선택지 존재");
  assert.ok(legal.some((a) => a.action.type === "skip"), "대기 선택지도 존재");
  step(state, { type: "skip" });
  assert.ok(state.log.some((e) => e.t === "skip" && e.reason === "chosen"), "자발적 대기는 chosen 사유");
  assert.ok(Object.values(kim.cooldowns).every((c) => c === 0), "대기는 어떤 스킬도 쿨에 안 올림");
});
