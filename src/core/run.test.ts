// 런 맵/흐름/진형 테스트 — 맵 생성·결정론·연결성, 완주 루프, 진형 편성.
// (육성/상점 → run-progression.test.ts · 영속/메타/다층 → run-meta.test.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, enterNode, resolveBattleEnd, chooseReward, leaveShop, chooseEncounterOption, movePartyMember } from "./run.ts";
import { step, createBattle, getFormationBonus } from "./engine.ts";
import { chooseAction } from "./ai.ts";
import { ENCOUNTER_EVENTS } from "../data/events.ts";
import type { MapGenConfig } from "./types.ts";

const ROSTER = [
  { charId: "beef", pos: { row: 1, col: 0 } },
  { charId: "pudding", pos: { row: 2, col: 1 } },
  { charId: "jelly", pos: { row: 2, col: 2 } },
];

function autoRun(seed: number): string {
  const run = createRun(seed, ROSTER);
  let guard = 0;
  while (run.phase !== "won" && run.phase !== "lost" && guard < 300) {
    guard++;
    if (run.phase === "map") {
      enterNode(run, run.reachable[0]);
    } else if (run.phase === "battle") {
      let bg = 0;
      while (run.battle!.phase === "inProgress" && bg < 600) {
        step(run.battle!, chooseAction(run.battle!));
        bg++;
      }
      resolveBattleEnd(run);
    } else if (run.phase === "reward") {
      chooseReward(run, run.rewards![0].id);
    } else if (run.phase === "shop") {
      leaveShop(run); // 자동주행: 구매 없이 나감
    } else if (run.phase === "encounter") {
      chooseEncounterOption(run, ENCOUNTER_EVENTS.find((e) => e.id === run.encounterId)!.choices[0].id);
    }
  }
  return run.phase;
}

test("런 결정론: 같은 시드 = 같은 맵", () => {
  const a = createRun(7, ROSTER);
  const b = createRun(7, ROSTER);
  assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes));
});

test("헥스맵 연결성: 시작 노드 포함 모든 셀이 start 도달 ∧ boss 도달 (프루닝 보장)", () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const run = createRun(seed, ROSTER);
    const has = (q: number, r: number) => run.nodes.some((n) => n.q === q && n.r === r);
    // 시작 노드(start)는 첫 행(r=0) 전체로 전진(허브), 그 외는 axial 인접
    const fwd = (c: { id: string; q: number; r: number; type: string }) =>
      c.type === "start"
        ? run.nodes.filter((n) => n.r === 0).map((n) => n.id)
        : [[c.q, c.r + 1], [c.q - 1, c.r + 1]].filter(([q, r]) => has(q, r)).map(([q, r]) => `${q}_${r}`);
    const minR = Math.min(...run.nodes.map((n) => n.r)); // -1 (시작)
    const maxR = Math.max(...run.nodes.map((n) => n.r)); // 보스
    const bossId = run.nodes.find((n) => n.type === "boss")!.id;
    const canBoss = new Set<string>([bossId]);
    for (let r = maxR - 1; r >= minR; r--) for (const c of run.nodes.filter((x) => x.r === r)) if (fwd(c).some((id) => canBoss.has(id))) canBoss.add(c.id);
    const fromStart = new Set<string>(run.nodes.filter((n) => n.type === "start").map((n) => n.id));
    for (let r = minR; r < maxR; r++) for (const c of run.nodes.filter((x) => x.r === r)) if (fromStart.has(c.id)) for (const id of fwd(c)) fromStart.add(id);
    for (const n of run.nodes) {
      assert.ok(canBoss.has(n.id), `seed ${seed}: ${n.id} 보스 도달 불가`);
      assert.ok(fromStart.has(n.id), `seed ${seed}: ${n.id} start 도달 불가`);
    }
  }
});

test("시작 노드: createRun 시 current=start, 다음 선택지=첫 행", () => {
  const run = createRun(7, ROSTER);
  assert.equal(run.currentNodeId, "start");
  assert.ok(run.nodes.some((n) => n.type === "start"));
  assert.ok(run.reachable.length > 0);
  assert.ok(run.reachable.every((id) => run.nodes.find((n) => n.id === id)!.r === 0));
});

test("런 완주: map→battle→reward 루프가 보스까지 가서 승/패로 종료", () => {
  for (const s of [1, 2, 3, 7, 42, 100]) {
    const phase = autoRun(s);
    assert.ok(phase === "won" || phase === "lost", `seed ${s}: ${phase}`);
  }
});

test("맵 데이터화: 커스텀 MapGenConfig가 깊이·첫행·타입 가중치를 제어 (7.1/7.3)", () => {
  const cfg: MapGenConfig = {
    rows: 5,
    startWidth: [2, 2],
    firstRowType: "rest",
    nodeWeights: { battle: 1 }, // 행1+는 battle만
    branch: { keepQChance: 50, extraSameChance: 0, extraLeftChance: 0 },
  };
  const run = createRun(7, ROSTER, [cfg]); // 1액트 런
  assert.equal(Math.max(...run.nodes.map((n) => n.r)), 5, "보스가 rows(=5) 깊이");
  assert.ok(run.nodes.some((n) => n.r === 0 && n.type === "rest"), "첫 행 = firstRowType");
  assert.ok(run.nodes.filter((n) => n.r >= 1 && n.r <= 4).every((n) => n.type === "battle"), "행1+ = nodeWeights(battle)만");
});

test("보스전은 적 진형 보너스 활성(6.3) — boss 노드 진입 시 enemyFormation 설정", () => {
  const run = createRun(2, ROSTER);
  const bossId = run.nodes.find((n) => n.type === "boss")!.id;
  run.reachable = [bossId];
  enterNode(run, bossId);
  assert.notEqual(run.battle, null);
  assert.notEqual(run.battle!.enemyFormation, null);
});

test("진형 편성: movePartyMember 이동/교대/같은칸 무시 (맵)", () => {
  const run = createRun(5, ROSTER); // beef(1,0) pudding(2,1) jelly(2,2)
  const beef = run.party.find((p) => p.charId === "beef")!;
  const pud = run.party.find((p) => p.charId === "pudding")!;
  // 빈 칸 이동
  movePartyMember(run, "beef", { row: 0, col: 3 });
  assert.deepEqual(beef.pos, { row: 0, col: 3 });
  // 점유 칸 → 위치 교대 (beef ↔ pudding)
  movePartyMember(run, "beef", { row: 2, col: 1 });
  assert.deepEqual(beef.pos, { row: 2, col: 1 });
  assert.deepEqual(pud.pos, { row: 0, col: 3 }); // pudding이 beef 직전 칸으로
  // 같은 칸 무시
  movePartyMember(run, "beef", { row: 2, col: 1 });
  assert.deepEqual(beef.pos, { row: 2, col: 1 });
});

test("진형 편성: 배치 변경이 전투 진형 보너스(열 분배)에 반영", () => {
  const run = createRun(5, ROSTER);
  movePartyMember(run, "beef", { row: 0, col: 0 }); // 0열(공격)
  movePartyMember(run, "pudding", { row: 1, col: 0 }); // 0열(공격) — 둘이 분배
  movePartyMember(run, "jelly", { row: 0, col: 3 }); // 3열(방어) 혼자
  const enc = { id: "t", name: "t", allies: [], enemies: [{ charId: "thug", pos: { row: 0, col: 0 } }], boss: false };
  const g = createBattle(9, enc, run.party);
  const ub = g.units.find((u) => u.charId === "beef")!;
  const uj = g.units.find((u) => u.charId === "jelly")!;
  assert.equal(ub.pos.col, 0);
  assert.equal(getFormationBonus(g, ub, "attackPower"), 2); // 0열 총량4 ÷ 2명
  assert.equal(getFormationBonus(g, uj, "defensePower"), 4); // 3열 총량4 ÷ 1명
});
