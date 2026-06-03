// 노드 레이어 (NODE-DESIGN Phase A 슬라이스1) — 즉시 레이어 onEnter/onResolve 실행·순서·세이브 왕복.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward, leaveShop, chooseEncounterOption, serializeRun, deserializeRun, curFloor } from "../run.ts";
import type { RunDef } from "../run.ts";
import { ENCOUNTER_EVENTS } from "../../data/events.ts";

// start(0,0) → rest(0,1) → clear(0,2). rest에 레이어 부착.
function def(): RunDef {
  return {
    id: "L", name: "레이어", useMastery: false, entryFloorId: "f",
    roster: [{ charId: "kim", pos: { row: 1, col: 0 } }, { charId: "shanghai", pos: { row: 2, col: 0 } }], // 골드 트레잇 없는 조합(수전노 교란 회피)
    floors: [{ id: "f", entryNodeId: "s", nodes: [
      { id: "s", type: "start", q: 0, r: 0 },
      { id: "r", type: "rest", q: 0, r: 1, layers: {
        onEnter: [{ kind: "gold", amount: 5 }, { kind: "grantStatus", charId: "kim", statusId: "rally", stacks: 2, duration: 3 }],
        onResolve: [{ kind: "text", text: "노드 종료 연출" }],
      } },
      { id: "c", type: "clear", q: 0, r: 2 },
    ], edges: [{ from: "s", to: "r" }, { from: "r", to: "c" }] }],
  };
}

test("즉시 레이어: rest 노드 진입 시 onEnter(골드+상태) → onResolve(텍스트) 순서 실행", () => {
  const run = createRun(1, def().roster, def());
  const g0 = run.gold;
  assert.ok(run.reachable.includes("r"), "rest가 진입 가능해야");
  enterNode(run, "r");
  // onEnter: 골드 +5
  assert.equal(run.gold, g0 + 5);
  // onEnter: kim에게 다음 전투 계승 상태
  assert.deepEqual(run.pendingStatuses["kim"], [{ statusId: "rally", stacks: 2, duration: 3 }]);
  assert.equal(run.pendingStatuses["shanghai"], undefined, "charId 지정 시 그 캐릭터만");
  // onResolve: 텍스트 로그(rest는 즉시 completeNode → onResolve 발동)
  assert.ok(run.log.includes("노드 종료 연출"));
});

test("grantStatus: charId 없으면 파티 전원 계승", () => {
  const d = def();
  d.floors[0].nodes[1].layers = { onEnter: [{ kind: "grantStatus", statusId: "guard", stacks: 1, duration: 2 }] };
  const run = createRun(2, d.roster, d);
  enterNode(run, "r");
  assert.deepEqual(run.pendingStatuses["kim"], [{ statusId: "guard", stacks: 1, duration: 2 }]);
  assert.deepEqual(run.pendingStatuses["shanghai"], [{ statusId: "guard", stacks: 1, duration: 2 }]);
});

test("레이어는 세이브 왕복에 보존(runDef 일부)", () => {
  const run = createRun(3, def().roster, def());
  const back = deserializeRun(serializeRun(run))!;
  const r = curFloor(back).nodes.find((n) => n.id === "r")!;
  assert.equal(r.layers?.onEnter?.[0].kind, "gold");
  assert.equal(r.layers?.onResolve?.[0].kind, "text");
});

test("레이어 없는 노드는 기존 거동 동일(회귀 가드)", () => {
  const d = def();
  delete d.floors[0].nodes[1].layers;
  const run = createRun(4, d.roster, d);
  const g0 = run.gold;
  enterNode(run, "r");
  assert.equal(run.gold, g0, "레이어 없으면 골드 불변");
  assert.equal(run.pendingStatuses["kim"], undefined);
});

// ── Phase A2: 코어 시퀀서(combat 웨이브) — RNG 회피 위해 battle.phase 강제 주입 ──
// start(0,0) → b(0,1) [core] → clear(0,2).
function coreDef(core: RunDef["floors"][0]["nodes"][0]["core"]): RunDef {
  return {
    id: "C", name: "코어", useMastery: false, entryFloorId: "f",
    roster: [{ charId: "kim", pos: { row: 1, col: 0 } }, { charId: "shanghai", pos: { row: 2, col: 0 } }],
    floors: [{ id: "f", entryNodeId: "s", nodes: [
      { id: "s", type: "start", q: 0, r: 0 },
      { id: "b", type: "battle", q: 0, r: 1, core },
      { id: "c", type: "clear", q: 0, r: 2 },
    ], edges: [{ from: "s", to: "b" }, { from: "b", to: "c" }] }],
  };
}
const winBattle = (run: { battle: { phase: string } | null }) => { run.battle!.phase = "allyWin"; };

test("코어 시퀀서: 2웨이브 — 전투1 블록→승리→전투2 생성→승리→노드 완료(맵)", () => {
  const run = createRun(1, coreDef([{ kind: "combat" }, { kind: "combat" }]).roster, coreDef([{ kind: "combat" }, { kind: "combat" }]));
  enterNode(run, "b");
  assert.equal(run.phase, "battle"); assert.equal(run.coreCursor, 0); assert.notEqual(run.battle, null);
  const b1 = run.battle;
  winBattle(run); resolveBattleEnd(run); // 웨이브1 승 → 웨이브2
  assert.equal(run.phase, "battle"); assert.equal(run.coreCursor, 1); assert.notEqual(run.battle, b1, "새 전투(웨이브2) 생성");
  winBattle(run); resolveBattleEnd(run); // 웨이브2 승 → 코어 소진 → 완료
  assert.equal(run.phase, "map"); assert.equal(run.coreCursor, null);
  assert.ok(run.visited.includes("b"));
});

test("코어 시퀀서: 전투 사이 데코레이터(gold) 실행", () => {
  const run = createRun(2, coreDef([{ kind: "combat" }, { kind: "gold", amount: 10 }]).roster, coreDef([{ kind: "combat" }, { kind: "gold", amount: 10 }]));
  const g0 = run.gold;
  enterNode(run, "b");
  winBattle(run); resolveBattleEnd(run); // 전투 후 gold 데코 실행 → 코어 소진
  assert.equal(run.gold, g0 + 10);
  assert.equal(run.phase, "map"); assert.equal(run.coreCursor, null);
});

test("코어 시퀀서: 전멸(enemyWin) = 런 실패(시퀀스 중단)", () => {
  const run = createRun(3, coreDef([{ kind: "combat" }, { kind: "combat" }]).roster, coreDef([{ kind: "combat" }, { kind: "combat" }]));
  enterNode(run, "b");
  run.battle!.phase = "enemyWin"; resolveBattleEnd(run);
  assert.equal(run.phase, "lost");
});

test("보상 레이어: combat→gold→reward 코어 = 전투 후 골드+보상 3택1 (패리티)", () => {
  const mk = () => coreDef([{ kind: "combat" }, { kind: "gold", amount: 8 }, { kind: "reward" }]);
  const run = createRun(7, mk().roster, mk());
  const g0 = run.gold;
  enterNode(run, "b");
  assert.equal(run.phase, "battle");
  winBattle(run); resolveBattleEnd(run); // 전투 승 → gold 데코 → reward 레이어(블록)
  assert.equal(run.gold, g0 + 8, "전투 사이 gold 데코 적용");
  assert.equal(run.phase, "reward"); assert.notEqual(run.rewards, null);
  chooseReward(run, run.rewards![0].id); // 보상 선택 → 코어 소진 → 노드 완료
  assert.equal(run.phase, "map"); assert.equal(run.coreCursor, null);
  assert.ok(run.visited.includes("b"));
});

test("보상 레이어: treasure 노드 = core:[reward] (전투 없이 보상)", () => {
  const run = createRun(8, coreDef([{ kind: "reward" }]).roster, coreDef([{ kind: "reward" }]));
  enterNode(run, "b");
  assert.equal(run.phase, "reward"); assert.notEqual(run.rewards, null); // 전투 없이 바로 보상
  chooseReward(run, run.rewards![0].id);
  assert.equal(run.phase, "map"); assert.equal(run.coreCursor, null);
});

test("yain 마이그레이션: f1_rest = core:[heal] — 전투불능 부활 + 50% 회복 후 맵 복귀", () => {
  const run = createRun(3); // DEFAULT_RUN(야인시대)
  // 전투불능 1명 + 부상 1명 세팅
  run.party[0].hp = 0;
  run.party[1].hp = 1;
  run.reachable = ["f1_rest"];
  enterNode(run, "f1_rest");
  assert.equal(run.party[0].hp, Math.max(1, Math.round(run.party[0].maxHp * 0.5)), "전투불능 부활(maxHp*0.5)");
  assert.equal(run.party[1].hp, Math.min(run.party[1].maxHp, 1 + Math.round(run.party[1].maxHp * 0.5)), "생존자 50% 회복");
  assert.equal(run.phase, "map", "휴식 즉시 해소 → 맵");
  assert.equal(run.coreCursor, null, "코어 소진(완료)");
  assert.ok(run.visited.includes("f1_rest"));
});

test("yain 마이그레이션: f1_boss가 core 경로 + boss 프리셋 roster + 진형 보너스", () => {
  const run = createRun(2); // DEFAULT_RUN(야인시대)
  run.reachable = ["f1_boss"];
  enterNode(run, "f1_boss");
  assert.equal(run.phase, "battle");
  assert.equal(run.coreCursor, 0, "core 경로(레거시 type 분기 아님)");
  const enemyIds = run.battle!.units.filter((u) => u.side === "enemy").map((u) => u.charId);
  assert.ok(enemyIds.includes("shim") && enemyIds.includes("chunho"), "rosterPreset 'boss' 적용");
  assert.notEqual(run.battle!.enemyFormation, null, "보스=진형 보너스");
});

test("노드 트리거 룰(Phase C): combat 진입 시 showDialog → battle.log에 dialog 이벤트(전투 안 벗어남)", () => {
  const d = coreDef([{ kind: "combat", rules: [{ when: { on: "battleStart" }, then: [{ do: "showDialog", speaker: "적장", text: "감히 여기까지…" }] }] }]);
  const run = createRun(7, d.roster, d);
  enterNode(run, "b");
  assert.equal(run.phase, "battle", "phase는 여전히 전투(연출은 phase 전환 아님)");
  const dlg = run.battle!.log.find((e) => e.t === "dialog");
  assert.ok(dlg && dlg.t === "dialog" && dlg.text === "감히 여기까지…" && dlg.speaker === "적장", "battleStart 룰이 dialog 이벤트 push");
});

test("룰 소유자(개체 기준): owner 지정 유닛에 주입(self=그 개체), 소유자 부재 시 스킵", () => {
  // 적 2명(thug@e0, jung@e1) + 룰 owner=jung → jung 유닛에만 주입(첫 적 thug 아님)
  const d = coreDef([{ kind: "combat", roster: [{ charId: "thug", pos: { row: 1, col: 0 } }, { charId: "jung", pos: { row: 0, col: 0 } }],
    rules: [{ owner: { side: "enemy", charId: "jung" }, when: { on: "battleStart" }, then: [{ do: "showDialog", text: "정진영 등장" }] }] }]);
  const run = createRun(1, d.roster, d);
  enterNode(run, "b");
  const jung = run.battle!.units.find((u) => u.charId === "jung")!;
  const thug = run.battle!.units.find((u) => u.charId === "thug")!;
  assert.equal(jung.rules.some((cr) => cr.via.kind === "node"), true, "소유자(jung)에 노드 룰 주입");
  assert.equal(thug.rules.some((cr) => cr.via.kind === "node"), false, "첫 적(thug)엔 주입 안 됨");
  assert.ok(run.battle!.log.some((e) => e.t === "dialog" && e.text === "정진영 등장"));

  // 소유자 부재(파티에 없는 charId)면 그 룰 스킵 — 에러 없이
  const d2 = coreDef([{ kind: "combat", roster: [{ charId: "thug", pos: { row: 1, col: 0 } }],
    rules: [{ owner: { side: "ally", charId: "doctor" }, when: { on: "battleStart" }, then: [{ do: "showDialog", text: "없는 화자" }] }] }]);
  const run2 = createRun(2, d2.roster, d2);
  enterNode(run2, "b");
  assert.equal(run2.battle!.log.some((e) => e.t === "dialog"), false, "소유자 부재 → 룰 스킵");
});

test("shop 레이어(DI): core:[shop] 진입 → 상점 블록 → leaveShop이 advanceCore로 복귀", () => {
  const run = createRun(4, coreDef([{ kind: "shop" }]).roster, coreDef([{ kind: "shop" }]));
  enterNode(run, "b");
  assert.equal(run.phase, "shop"); assert.equal(run.coreCursor, 0); assert.notEqual(run.shop, null);
  leaveShop(run);
  assert.equal(run.phase, "map"); assert.equal(run.coreCursor, null);
  assert.ok(run.visited.includes("b"));
});

test("event 레이어(DI): core:[event] 진입 → 인카운터 블록 → 선택 후 advanceCore로 복귀", () => {
  const run = createRun(6, coreDef([{ kind: "event" }]).roster, coreDef([{ kind: "event" }]));
  enterNode(run, "b");
  assert.equal(run.phase, "encounter"); assert.equal(run.coreCursor, 0); assert.notEqual(run.encounterId, null);
  const ev = ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId)!;
  chooseEncounterOption(run, ev.choices[0].id);
  assert.equal(run.phase, "map"); assert.equal(run.coreCursor, null);
  assert.ok(run.visited.includes("b"));
});

test("코어 커서는 세이브 왕복 보존(웨이브 도중 재개 가능)", () => {
  const run = createRun(5, coreDef([{ kind: "combat" }, { kind: "combat" }]).roster, coreDef([{ kind: "combat" }, { kind: "combat" }]));
  enterNode(run, "b"); // 웨이브1 진행 중(coreCursor 0, phase battle)
  const back = deserializeRun(serializeRun(run))!;
  assert.equal(back.coreCursor, 0);
  assert.equal(back.phase, "battle");
  assert.equal(curFloor(back).nodes.find((n) => n.id === "b")!.core!.length, 2);
});
