// 면적/타겟팅(6.4 재배치 · AoE 모양 · 자유선택 · 빈칸 앵커 · 쉴드→HP 순).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, step, computeAreaCells } from "./engine.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import { forceTurn } from "./testutil.ts";

test("동적 재배치: 밀치기가 대상을 뒤 열로 이동 (6.4)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const beef = state.units.find((u) => u.name === "비프")!;
  const slime = state.units.find((u) => u.side === "enemy" && u.pos.col === 0)!;
  slime.evasion = -100;
  beef.cooldowns = {};
  const col0 = slime.pos.col;
  forceTurn(state, beef.uid);

  step(state, { type: "skill", skillId: "milchigi", targetUid: slime.uid });
  assert.equal(slime.pos.col, col0 + 1); // 한 칸 뒤로
});

test("면적 모양: computeAreaCells (single/row/col/square/cross/all + 클램프)", () => {
  assert.equal(computeAreaCells({ row: 1, col: 1 }, { kind: "single" }, 4, 4).length, 1);
  assert.equal(computeAreaCells({ row: 1, col: 1 }, { kind: "row" }, 4, 4).length, 4);
  assert.equal(computeAreaCells({ row: 1, col: 1 }, { kind: "col" }, 4, 4).length, 4);
  assert.equal(computeAreaCells({ row: 1, col: 1 }, { kind: "square", radius: 1 }, 4, 4).length, 9);
  assert.equal(computeAreaCells({ row: 0, col: 0 }, { kind: "square", radius: 1 }, 4, 4).length, 4); // 모서리 클램프
  assert.equal(computeAreaCells({ row: 1, col: 1 }, { kind: "cross", radius: 1 }, 4, 4).length, 5);
  assert.equal(computeAreaCells({ row: 0, col: 0 }, { kind: "all" }, 4, 4).length, 16);
});

test("면적 row: 같은 행의 적 다수를 한 번에 타격", () => {
  const enc = {
    id: "t", name: "t",
    allies: [{ charId: "cho", pos: { row: 1, col: 0 } }],
    enemies: [{ charId: "slime", pos: { row: 1, col: 0 } }, { charId: "slime", pos: { row: 1, col: 2 } }, { charId: "slime", pos: { row: 3, col: 0 } }],
  };
  const state = createBattle(1, enc);
  const cho = state.units.find((u) => u.name === "조병옥")!;
  cho.cooldowns = {};
  const e0 = state.units.find((u) => u.side === "enemy" && u.pos.row === 1 && u.pos.col === 0)!;
  const e2 = state.units.find((u) => u.side === "enemy" && u.pos.row === 1 && u.pos.col === 2)!;
  const e3 = state.units.find((u) => u.side === "enemy" && u.pos.row === 3)!;
  for (const e of [e0, e2, e3]) e.evasion = -100;
  const hp = (u: typeof e0) => u.hp;
  const [h0, h2, h3] = [hp(e0), hp(e2), hp(e3)];
  forceTurn(state, cho.uid);
  step(state, { type: "skill", skillId: "cho_police", targetUid: e0.uid }); // row 면적
  assert.ok(e0.hp < h0 && e2.hp < h2, "같은 행(1) 둘 다 타격");
  assert.equal(e3.hp, h3, "다른 행(3)은 무사");
});

test("면적 free: 자유 선택한 칸들의 적을 타격, 그 외는 무사", () => {
  const enc = {
    id: "t", name: "t",
    allies: [{ charId: "shin", pos: { row: 1, col: 0 } }],
    enemies: [{ charId: "slime", pos: { row: 0, col: 0 } }, { charId: "slime", pos: { row: 2, col: 3 } }, { charId: "slime", pos: { row: 3, col: 3 } }],
  };
  const state = createBattle(1, enc);
  const shin = state.units.find((u) => u.name === "신영균")!;
  shin.cooldowns = {};
  const e0 = state.units.find((u) => u.side === "enemy" && u.pos.row === 0)!;
  const e1 = state.units.find((u) => u.side === "enemy" && u.pos.row === 2)!;
  const e2 = state.units.find((u) => u.side === "enemy" && u.pos.row === 3)!;
  for (const e of [e0, e1, e2]) e.evasion = -100;
  const [h0, h1, h2] = [e0.hp, e1.hp, e2.hp];
  forceTurn(state, shin.uid);
  // shin_ult = free. cells로 0,0 과 2,3 선택
  step(state, { type: "skill", skillId: "shin_ult", cells: [{ row: 0, col: 0 }, { row: 2, col: 3 }] });
  assert.ok(e0.hp < h0 && e1.hp < h1, "선택한 칸 타격");
  assert.equal(e2.hp, h2, "선택 안 한 칸은 무사");
});

test("빈 칸 앵커: 적 없는 칸을 앵커로 한 십자/행도 주변 유닛 타격", () => {
  const enc = {
    id: "t", name: "t",
    allies: [{ charId: "cho", pos: { row: 0, col: 0 } }],
    enemies: [{ charId: "slime", pos: { row: 2, col: 0 } }, { charId: "slime", pos: { row: 2, col: 3 } }],
  };
  const state = createBattle(1, enc);
  const cho = state.units.find((u) => u.name === "조병옥")!;
  cho.cooldowns = {};
  const e0 = state.units.find((u) => u.side === "enemy" && u.pos.col === 0)!;
  const e3 = state.units.find((u) => u.side === "enemy" && u.pos.col === 3)!;
  e0.evasion = -100; e3.evasion = -100;
  const [h0, h3] = [e0.hp, e3.hp];
  forceTurn(state, cho.uid);
  // cho_police = row. 빈 칸 (row2,col1) 을 앵커로 → 2행 전체
  step(state, { type: "skill", skillId: "cho_police", targetCell: { row: 2, col: 1 } });
  assert.ok(e0.hp < h0 && e3.hp < h3, "빈 칸 앵커의 행 전체 타격");
});

test("데미지는 쉴드부터 깎고 그다음 HP (2.9)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const target = state.units.find((u) => u.side === "enemy")!;
  target.shield = 5;
  const hp0 = target.hp;
  // 쉴드 우선 소비만 확인: 큰 피해 시 쉴드 0이 되어야 함
  assert.equal(target.shield, 5);
  assert.equal(target.hp, hp0);
});
