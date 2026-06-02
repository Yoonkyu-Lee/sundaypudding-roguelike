// 끼어들기(2.11) — self출처/버프출처/대상끼어들기/웹 targetCell 경로.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, step } from "./engine.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import { forceTurn } from "./testutil.ts";

test("끼어들기: grantsInterrupt(self) 스킬 사용 시 서열에 interrupt 삽입, 쿨 미차감 (2.11)", () => {
  const enc = { id: "t", name: "t", allies: [{ charId: "kim", pos: { row: 0, col: 0 } }], enemies: [{ charId: "jung", pos: { row: 0, col: 0 } }] };
  const state = createBattle(42, enc);
  const jung = state.units.find((u) => u.charId === "jung")!;
  jung.cooldowns = {};
  forceTurn(state, jung.uid);

  step(state, { type: "skill", skillId: "jung_ult", targetUid: jung.uid }); // 자기진영 버프 + 본인 끼어들기(grantsInterruptTo self)

  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === jung.uid));
  // 사용 즉시 cd5 설정, 끼어들기 턴에선 차감 안 됨 → 여전히 5
  assert.equal(jung.cooldowns["jung_ult"], 5);
  assert.equal(state.current?.uid, jung.uid);
  assert.equal(state.current?.kind, "interrupt");
});

test("끼어들기 출처 일반화: 버프(신속)가 있으면 무관한 스킬로도 끼어들기 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  kim.statuses.push({ defId: "haste", stacks: 1, duration: 2, sourceUid: "x" }); // 신속 버프
  kim.cooldowns = {};
  const enemy = state.units.find((u) => u.side === "enemy" && u.pos.col === 0)!;
  enemy.evasion = -100;
  forceTurn(state, kim.uid);
  // 종로의 주먹은 grantsInterrupt 없음 → 그래도 신속 버프로 끼어들기 발생
  step(state, { type: "skill", skillId: "kim_punch", targetUid: enemy.uid });
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === kim.uid), "버프 출처 끼어들기");
  assert.equal(state.current?.kind, "interrupt");
});

test("끼어들기 주체=대상: 서포트(4달러)가 다른 아군을 끼어들기시킴 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  const cho = state.units.find((u) => u.name === "조병옥")!;
  kim.cooldowns = {};
  forceTurn(state, kim.uid);
  step(state, { type: "skill", skillId: "kim_4dollar", targetUid: cho.uid });
  // 끼어들기 주체는 시전자(김두한)가 아니라 대상(조병옥)
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === cho.uid), "조병옥이 끼어들기 주체");
  assert.equal(state.current?.uid, cho.uid);
  assert.equal(state.current?.kind, "interrupt");
});

test("끼어들기 버그수정: targetCell만 줘도(웹 경로) 대상-끼어들기 실현 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const kim = state.units.find((u) => u.name === "김두한")!;
  const cho = state.units.find((u) => u.name === "조병옥")!;
  kim.cooldowns = {};
  forceTurn(state, kim.uid);
  // 웹은 targetUid 없이 targetCell만 보냄 → 앵커 해소로 대상(조병옥) 끼어들기 발생해야
  step(state, { type: "skill", skillId: "kim_4dollar", targetCell: { ...cho.pos } });
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === cho.uid), "targetCell 경로에서도 조병옥 끼어들기");
  assert.equal(state.current?.uid, cho.uid);
  assert.equal(state.current?.kind, "interrupt");
});
