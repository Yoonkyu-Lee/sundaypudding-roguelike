// 적 AI/패턴(우선순위 룰 프로파일) 결정론 테스트.
// 메커니즘=core/ai(프로파일 인터프리터 + 그리디 fallback), 정책 값=data/ai.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle } from "./engine.ts";
import { chooseAction } from "./ai.ts";
import { forceTurn } from "./testutil.ts";
import type { Encounter } from "../data/encounters.ts";
import type { Action } from "./types.ts";

const SEED = 7;
const skillOf = (a: Action) => (a.type === "skill" ? a.skillId : "skip");
const targetOf = (a: Action) => (a.type === "skill" ? a.targetUid : undefined);

// 힐러(의사양반) vs 위급한 아군(심영). 적 진영=[doctor, shim], 플레이어=[kim].
const HEALER_ENC: Encounter = {
  id: "t_healer", name: "힐러",
  allies: [{ charId: "kim", pos: { row: 1, col: 0 } }],
  enemies: [
    { charId: "doctor", pos: { row: 1, col: 1 } },
    { charId: "shim", pos: { row: 2, col: 1 } },
  ],
};

test("healer: 아군 HP 60% 미만이면 가장 위급한 아군을 치료한다", () => {
  const state = createBattle(SEED, HEALER_ENC);
  const shim = state.units.find((u) => u.charId === "shim")!;
  shim.hp = Math.floor(shim.hpMax * 0.3); // 위급
  forceTurn(state, state.units.find((u) => u.charId === "doctor")!.uid);
  const a = chooseAction(state);
  assert.equal(skillOf(a), "doc_heal", "위급 아군 있으면 치료 우선");
  assert.equal(targetOf(a), shim.uid, "가장 위급한 아군(심영)을 대상");
});

test("healer: 아군이 멀쩡하면 룰이 떨어지고 공격으로 전환", () => {
  const state = createBattle(SEED, HEALER_ENC);
  // 전원 풀피 → allyHpPctBelow:60 거짓 → rule2(damage) 적용
  forceTurn(state, state.units.find((u) => u.charId === "doctor")!.uid);
  const a = chooseAction(state);
  assert.equal(skillOf(a), "doc_tap", "치료 불필요 시 공격");
  assert.equal(targetOf(a), state.units.find((u) => u.charId === "kim")!.uid);
});

// 암살자(김천호): 후열·저체력 적 저격. 플레이어=[kim 전열 풀피, shanghai 후열 저체력].
const ASSASSIN_ENC: Encounter = {
  id: "t_assassin", name: "암살자",
  allies: [
    { charId: "kim", pos: { row: 1, col: 0 } },
    { charId: "shanghai", pos: { row: 2, col: 2 } },
  ],
  enemies: [{ charId: "chunho", pos: { row: 1, col: 0 } }],
};

test("assassin: 전열 풀피보다 후열 저체력 적을 노린다", () => {
  const state = createBattle(SEED, ASSASSIN_ENC);
  const sh = state.units.find((u) => u.charId === "shanghai")!;
  sh.hp = 8; // 후열 저체력
  forceTurn(state, state.units.find((u) => u.charId === "chunho")!.uid);
  const a = chooseAction(state);
  assert.equal(targetOf(a), sh.uid, "후열 저체력(상하이)을 대상 — 가중치(backline+lowHp)");
  assert.equal(a.type === "skill" && a.skillId !== "chunho_stab", true, "근접(reach1)이 아닌 원거리기로 후열 도달");
});

// 수호자(심영): 위급하면 자기 보호, 아니면 적 약화.
const GUARD_ENC: Encounter = {
  id: "t_guard", name: "수호자",
  allies: [{ charId: "kim", pos: { row: 1, col: 0 } }],
  enemies: [{ charId: "shim", pos: { row: 1, col: 0 } }],
};

test("guardian: HP 45% 미만이면 자기 방어(쉴드), 아니면 적 약화", () => {
  const low = createBattle(SEED, GUARD_ENC);
  const shimLow = low.units.find((u) => u.charId === "shim")!;
  shimLow.hp = Math.floor(shimLow.hpMax * 0.4);
  forceTurn(low, shimLow.uid);
  assert.equal(skillOf(chooseAction(low)), "shim_mother", "위급 시 자기 쉴드");

  const ok = createBattle(SEED, GUARD_ENC);
  forceTurn(ok, ok.units.find((u) => u.charId === "shim")!.uid);
  assert.equal(skillOf(chooseAction(ok)), "shim_speech", "멀쩡하면 적 약화(applyStatus)");
});

test("결정론: 동일 상태에서 chooseAction은 매번 동일 행동", () => {
  const mk = () => {
    const s = createBattle(SEED, ASSASSIN_ENC);
    s.units.find((u) => u.charId === "shanghai")!.hp = 8;
    forceTurn(s, s.units.find((u) => u.charId === "chunho")!.uid);
    return chooseAction(s);
  };
  assert.deepEqual(mk(), mk());
});

test("fallback: 프로파일 없는 유닛(잡몹)은 그리디 — 최저 HP 적 우선", () => {
  const enc: Encounter = {
    id: "t_thug", name: "잡몹",
    allies: [
      { charId: "kim", pos: { row: 1, col: 0 } },
      { charId: "cho", pos: { row: 2, col: 0 } },
    ],
    enemies: [{ charId: "thug", pos: { row: 1, col: 0 } }],
  };
  const state = createBattle(SEED, enc);
  const cho = state.units.find((u) => u.charId === "cho")!;
  cho.hp = 5;
  forceTurn(state, state.units.find((u) => u.charId === "thug")!.uid);
  assert.equal(targetOf(chooseAction(state)), cho.uid, "그리디는 최저 HP 대상");
});
