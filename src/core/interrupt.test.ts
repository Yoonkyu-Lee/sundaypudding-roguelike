// 끼어들기(2.11) — 연격/버프출처/대상끼어들기/웹 targetCell 경로.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBattle, step } from "./engine.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import { forceTurn } from "./testutil.ts";

test("끼어들기: 연격 사용 시 서열에 interrupt 삽입, 쿨타임 미차감 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const beef = state.units.find((u) => u.name === "비프")!;
  const slime = state.units.find((u) => u.side === "enemy" && u.pos.col <= 1)!;
  slime.evasion = -100; // 명중 100% 보장
  beef.cooldowns = {};
  forceTurn(state, beef.uid);

  step(state, { type: "skill", skillId: "yeongyeok", targetUid: slime.uid });

  // 끼어들기 이벤트 발생
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === beef.uid));
  // 연격은 사용 즉시 cd4 설정, 끼어들기 턴에선 차감 안 됨 → 여전히 4
  assert.equal(beef.cooldowns["yeongyeok"], 4);
  // 현재 차례 = 비프의 끼어들기 턴
  assert.equal(state.current?.uid, beef.uid);
  assert.equal(state.current?.kind, "interrupt");
});

test("끼어들기 출처 일반화: 버프(신속)가 있으면 무관한 스킬로도 끼어들기 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const beef = state.units.find((u) => u.name === "비프")!;
  beef.statuses.push({ defId: "haste", stacks: 1, duration: 2, sourceUid: "x" }); // 신속 버프
  beef.cooldowns = {};
  const slime = state.units.find((u) => u.side === "enemy" && u.pos.col <= 1)!;
  slime.evasion = -100;
  forceTurn(state, beef.uid);
  // 강타는 grantsInterrupt 없음 → 그래도 신속 버프로 끼어들기 발생
  step(state, { type: "skill", skillId: "gangta", targetUid: slime.uid });
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === beef.uid), "버프 출처 끼어들기");
  assert.equal(state.current?.kind, "interrupt");
});

test("끼어들기 주체=대상: 서포트(재촉)가 다른 아군을 끼어들기시킴 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const jelly = state.units.find((u) => u.name === "젤리")!;
  const pudding = state.units.find((u) => u.name === "푸딩")!;
  jelly.cooldowns = {};
  forceTurn(state, jelly.uid);
  step(state, { type: "skill", skillId: "jaechok", targetUid: pudding.uid });
  // 끼어들기 주체는 시전자(젤리)가 아니라 대상(푸딩)
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === pudding.uid), "푸딩이 끼어들기 주체");
  assert.equal(state.current?.uid, pudding.uid);
  assert.equal(state.current?.kind, "interrupt");
});

test("끼어들기 버그수정: targetCell만 줘도(웹 경로) 대상-끼어들기 실현 (2.11)", () => {
  const state = createBattle(42, DEMO_ENCOUNTER);
  const jelly = state.units.find((u) => u.name === "젤리")!;
  const pudding = state.units.find((u) => u.name === "푸딩")!;
  jelly.cooldowns = {};
  forceTurn(state, jelly.uid);
  // 웹은 targetUid 없이 targetCell만 보냄 → 앵커 해소로 대상(푸딩) 끼어들기 발생해야
  step(state, { type: "skill", skillId: "jaechok", targetCell: { ...pudding.pos } });
  assert.ok(state.log.some((e) => e.t === "interrupt" && e.uid === pudding.uid), "targetCell 경로에서도 푸딩 끼어들기");
  assert.equal(state.current?.uid, pudding.uid);
  assert.equal(state.current?.kind, "interrupt");
});
