// 특성/패시브 룰 엔진 — 결정론·발동·재진입 가드·보유 기준·active 배제 테스트.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, getLegalActions, step } from "./engine.ts";
import { applyEffect } from "./combat/passives/index.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, leaveShop, chooseEncounterOption, fireRunTrigger, type RunState } from "./run.ts";
import { chooseAction } from "./ai.ts";
import type { GameState, PartyMemberState } from "./types.ts";
import type { Encounter } from "../data/encounters.ts";
import { ENCOUNTER_EVENTS } from "../data/events.ts";

function ally(charId: string, pos: { row: number; col: number }, owned: string[], active = owned): PartyMemberState {
  return { charId, pos, hp: 60, maxHp: 60, skillDmgBonus: {}, ownedSkillIds: owned, activeSkillIds: active, equipped: {}, masteryLevel: 0 };
}
const enemy1: Encounter = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };

test("패시브(활성 기준): u_toughness는 출전(활성)해야 발동 — 보유만으론 미발동", () => {
  // 보유하지만 미편성(활성 X) → 패시브 미발동
  const g0 = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch", "u_toughness"], ["kim_punch"])]);
  assert.equal(g0.units.find((u) => u.charId === "kim")!.shield, 0, "보유만으론 미발동");
  // 출전(활성 슬롯에 편성) → battleStart 패시브로 쉴드
  const g1 = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch", "u_toughness"], ["kim_punch", "u_toughness"])]);
  assert.equal(g1.units.find((u) => u.charId === "kim")!.shield, 6, "출전 시 발동");
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
  // 특성 2(bloodlust·warspirit) + kim_punch 패시브(1) + u_toughness 패시브(1) = 4
  assert.equal(kim.rules.length, 4);
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

// ── 모험(run) 스코프 ──
test("모험 특성: 수전노(조병옥) nodeClear → 골드 +3", () => {
  const run = createRun(1, [{ charId: "cho", pos: { row: 0, col: 0 } }]);
  const before = run.gold;
  fireRunTrigger(run, { on: "nodeClear", nodeType: "battle" });
  assert.equal(run.gold, before + 3, "miser goldDelta");
});

test("모험 특성: 전의(김두한) 보스 진입 → 다음 전투 계승 + 비-보스는 미발동", () => {
  const run = createRun(1, [{ charId: "kim", pos: { row: 0, col: 0 } }]);
  fireRunTrigger(run, { on: "nodeEnter", nodeType: "battle" });
  assert.ok(!run.pendingStatuses["kim"], "비-보스 진입은 계승 없음");
  fireRunTrigger(run, { on: "nodeEnter", nodeType: "boss" });
  const pend: { statusId: string; stacks: number; duration: number }[] = run.pendingStatuses["kim"] ?? [];
  assert.ok(pend.some((s) => s.statusId === "might"), "보스 진입 → pending might");
  // 계승 주입: startStatuses → 전투 시작 시 아군 상태로
  const enc: Encounter = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const g = createBattle(1, enc, [{ charId: "kim", pos: { row: 0, col: 0 }, hp: 46, maxHp: 46, skillDmgBonus: {}, activeSkillIds: ["kim_punch"], startStatuses: run.pendingStatuses["kim"] }]);
  assert.ok(g.units.find((u) => u.charId === "kim")!.statuses.some((s) => s.defId === "might"), "계승 상태 전투 주입");
});

function autoRun(seed: number): { phase: string; gold: number } {
  const run: RunState = createRun(seed, [{ charId: "cho", pos: { row: 1, col: 0 } }, { charId: "kim", pos: { row: 2, col: 0 } }]);
  let guard = 0;
  while (run.phase !== "won" && run.phase !== "lost" && guard < 400) {
    guard++;
    if (run.phase === "map") enterNode(run, run.reachable[0]);
    else if (run.phase === "battle") { let bg = 0; while (run.battle!.phase === "inProgress" && bg < 600) { step(run.battle!, chooseAction(run.battle!)); bg++; } resolveBattleEnd(run); }
    else if (run.phase === "reward") chooseReward(run, run.rewards![0].id);
    else if (run.phase === "shop") leaveShop(run);
    else if (run.phase === "encounter") chooseEncounterOption(run, ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId)!.choices[0].id);
  }
  assert.ok(guard < 400, `run 종료(재진입/무한루프 없음) guard=${guard}`);
  return { phase: run.phase, gold: run.gold };
}

test("모험 스코프 통합: 특성 파티 런이 종료되고(가드), 같은 시드 = 같은 결과", () => {
  const a = autoRun(3);
  const b = autoRun(3);
  assert.deepEqual(a, b, "결정론");
  assert.ok(a.phase === "won" || a.phase === "lost");
});

// ── 신규 어휘 (흡혈·비율반사·상태제거·자신제외 광역·적 broadcast) ──
test("흡혈(healByDamage): 가한 피해 비례 회복", () => {
  const g = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  kim.hp = 10;
  applyEffect(g, { owner: kim, damage: 20 }, { do: "healByDamage", pct: 50, target: "self" });
  assert.equal(kim.hp, 20); // +50% of 20
});

test("비율 반사(reflectByDamage): 받은 피해 비례 피해", () => {
  const g = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  const thug = g.units.find((u) => u.side === "enemy")!;
  const before = thug.hp;
  applyEffect(g, { owner: kim, subject: thug, damage: 10 }, { do: "reflectByDamage", pct: 50, target: "subject" });
  assert.equal(thug.hp, before - 5);
});

test("removeStatus: 특정 상태 1종만 제거(다른 상태 유지)", () => {
  const g = createBattle(1, enemy1, [ally("kim", { row: 0, col: 0 }, ["kim_punch"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  kim.statuses.push({ defId: "bleed", stacks: 1, duration: 2, sourceUid: kim.uid });
  kim.statuses.push({ defId: "might", stacks: 1, duration: 2, sourceUid: kim.uid });
  applyEffect(g, { owner: kim }, { do: "removeStatus", statusId: "bleed", target: "self" });
  assert.ok(!kim.statuses.some((s) => s.defId === "bleed"), "bleed 제거");
  assert.ok(kim.statuses.some((s) => s.defId === "might"), "might 유지");
});

test("otherAllies: 소유자 제외 아군만", () => {
  const enc: Encounter = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const g = createBattle(1, enc, [ally("kim", { row: 0, col: 0 }, ["kim_punch"]), ally("shin", { row: 1, col: 0 }, ["shin_axe"])]);
  const kim = g.units.find((u) => u.charId === "kim")!;
  const shin = g.units.find((u) => u.charId === "shin")!;
  kim.hp = 10; shin.hp = 10;
  applyEffect(g, { owner: kim }, { do: "heal", amount: 5, target: "otherAllies" });
  assert.equal(kim.hp, 10, "자신 제외");
  assert.equal(shin.hp, 15, "다른 아군만 회복");
});

test("적 특성 broadcast: 심영(rally) battleStart → 적 진영 전체 공위증, 아군엔 미적용", () => {
  const enc: Encounter = { id: "t", name: "t", allies: [], enemies: [{ charId: "shim", pos: { row: 0, col: 0 } }, { charId: "chunho", pos: { row: 1, col: 0 } }], boss: false };
  const g = createBattle(1, enc, [ally("kim", { row: 0, col: 0 }, ["kim_punch"])]);
  const has = (cid: string) => g.units.find((u) => u.charId === cid)!.statuses.some((s) => s.defId === "might");
  assert.ok(has("shim") && has("chunho"), "적 진영 전체 broadcast");
  assert.ok(!has("kim"), "아군엔 미적용");
});
