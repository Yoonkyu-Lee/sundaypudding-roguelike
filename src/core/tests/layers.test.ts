// 노드 레이어 (NODE-DESIGN Phase A 슬라이스1) — 즉시 레이어 onEnter/onResolve 실행·순서·세이브 왕복.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, serializeRun, deserializeRun, curFloor } from "../run.ts";
import type { RunDef } from "../run.ts";

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

test("코어 커서는 세이브 왕복 보존(웨이브 도중 재개 가능)", () => {
  const run = createRun(5, coreDef([{ kind: "combat" }, { kind: "combat" }]).roster, coreDef([{ kind: "combat" }, { kind: "combat" }]));
  enterNode(run, "b"); // 웨이브1 진행 중(coreCursor 0, phase battle)
  const back = deserializeRun(serializeRun(run))!;
  assert.equal(back.coreCursor, 0);
  assert.equal(back.phase, "battle");
  assert.equal(curFloor(back).nodes.find((n) => n.id === "b")!.core!.length, 2);
});
