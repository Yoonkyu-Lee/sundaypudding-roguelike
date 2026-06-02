// 특성/패시브 룰 엔진 — 결정론·발동·재진입 가드·보유 기준·active 배제 테스트.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, getLegalActions, step } from "./engine.ts";
import { chooseAction } from "./ai.ts";
import type { GameState, PartyMemberState } from "./types.ts";
import type { Encounter } from "../data/encounters.ts";

function ally(charId: string, pos: { row: number; col: number }, owned: string[], active = owned): PartyMemberState {
  return { charId, pos, hp: 60, maxHp: 60, skillDmgBonus: {}, ownedSkillIds: owned, activeSkillIds: active, equipped: {}, masteryLevel: 0 };
}
const enemy1: Encounter = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };

test("패시브(보유 기준): u_toughness 보유 → 전투 시작 쉴드 6 (active:false, 편성 무관)", () => {
  const g = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch", "u_toughness"], ["kim_punch"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  assert.equal(kim.shield, 6, "battleStart 패시브로 쉴드 부여");
});

test("active:false 스킬은 전투 스킬창에 안 뜸", () => {
  const g = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["u_toughness", "kim_punch"], ["u_toughness", "kim_punch"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  g.current = { uid: kim.uid, kind: "normal", speed: 5 };
  const acts = getLegalActions(g);
  assert.ok(!acts.some((a) => a.action.type === "skill" && a.action.skillId === "u_toughness"), "u_toughness(능동 아님) 미노출");
  assert.ok(acts.some((a) => a.action.type === "skill" && a.action.skillId === "kim_punch"), "능동기 kim_punch는 노출");
});

test("특성 statMod: 선봉장(상하이) 최전열이면 전투 시작 명중 +10", () => {
  const g = createBattle(1, enemy1, [ally("shanghai", { row: 0, col: 0 }, ["sh_pistol"])]);
  const sh = g.units.find((u) => u.charId === "shanghai")!;
  assert.equal(sh.statMods.accuracy, 10, "frontliner battleStart statMod");
});

test("특성 컴파일: traitIds + 보유 스킬 passives가 Unit.rules로 모임", () => {
  const g = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch", "u_toughness"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  // bloodlust(특성 1) + kim_punch 패시브(1) + u_toughness 패시브(1) = 3
  assert.equal(kim.rules.length, 3);
  assert.ok(kim.rules.some((r) => r.via.kind === "trait" && r.via.id === "bloodlust"));
  assert.ok(kim.rules.some((r) => r.via.kind === "skill" && r.via.id === "kim_punch"));
});

function runToEnd(seed: number): { phase: string; logLen: number; hp: string } {
  const allies = [ally("kim", { row: 0, col: 0 }, ["kim_punch", "u_toughness"]), ally("shin", { row: 1, col: 0 }, ["shin_axe"]), ally("cho", { row: 1, col: 2 }, ["cho_warn"])];
  const enc: Encounter = { id: "b", name: "b", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }, { charId: "thug2", pos: { row: 1, col: 0 } }, { charId: "jung", pos: { row: 1, col: 2 } }], boss: false };
  const g: GameState = createBattle(seed, enc, allies);
  let guard = 0;
  while (g.phase === "inProgress" && guard < 2000) { step(g, chooseAction(g)); guard++; }
  assert.ok(guard < 2000, `재진입/무한루프 없음 (guard=${guard})`); // thorns 반사·crit-bleed 등 연쇄가 종료
  return { phase: g.phase, logLen: g.log.length, hp: g.units.map((u) => `${u.uid}:${u.hp}`).join(",") };
}

test("결정론 + 재진입 가드: 특성/패시브 포함 전투가 멈추고, 같은 시드 = 같은 결과", () => {
  const a = runToEnd(7);
  const b = runToEnd(7);
  assert.deepEqual(a, b, "같은 시드 동일 결과");
  assert.ok(a.phase === "allyWin" || a.phase === "enemyWin");
});
