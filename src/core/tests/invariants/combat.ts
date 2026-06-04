// 전투 상태 불변식 검사기 (INVARIANTS-FROM-CLAUDE-CODE.md Part 1).
// 매 step 후(또는 임의 시점) GameState를 받아 위반 목록을 반환. 순수·무throw.
// 관측 경계에서만 판정(8.2) — units·roundOrder·cursor·phase + buildObservation 투영.
import type { GameState } from "../../types.ts";
import { buildObservation } from "../../engine.ts";
import { STATUS_DEFS } from "../../../data/statuses.ts";
import { Violations, type Violation } from "./types.ts";

const ACTION_CONST = 10000; // turnOrder.ts와 동일(서열 = ACTION_CONST/speed)

export function checkCombatInvariants(s: GameState): Violation[] {
  const v = new Violations();

  // ── A. 유닛 상태 무결성 ──
  const seen = new Set<string>();
  for (const u of s.units) {
    v.check(u.hp >= 0, "A1", "CRIT", () => `${u.uid} hp<0 (${u.hp})`);
    v.check(u.hp <= u.hpMax, "A2", "CRIT", () => `${u.uid} hp>hpMax (${u.hp}/${u.hpMax})`);
    v.check(u.shield >= 0, "A3", "NORM", () => `${u.uid} shield<0 (${u.shield})`);
    v.check(u.alive === u.hp > 0, "A4", "CRIT", () => `${u.uid} alive↔hp 불일치 (alive=${u.alive}, hp=${u.hp})`);
    v.check(!seen.has(u.uid), "A6", "CRIT", () => `uid 중복: ${u.uid}`);
    seen.add(u.uid);
    v.check(u.activeSkillIds.length <= 4, "A8", "NORM", () => `${u.uid} activeSkillIds>4 (${u.activeSkillIds.length})`);
    // C9 쿨다운 비음수
    for (const id of Object.keys(u.cooldowns)) {
      v.check(u.cooldowns[id] >= 0, "C9", "NORM", () => `${u.uid} 쿨다운<0 (${id}=${u.cooldowns[id]})`);
    }
    // E (참조 무결성): 모든 상태 defId가 정의에 존재
    for (const st of u.statuses) {
      v.check(!!STATUS_DEFS[st.defId], "E-ref", "CRIT", () => `${u.uid} 미정의 상태 defId=${st.defId}`);
    }
  }

  // ── C. 턴/라운드 서열 ──
  const normals = s.roundOrder.filter((e) => e.kind === "normal");
  for (const e of normals) {
    v.check(e.speed >= 1, "C3", "CRIT", () => `정규 엔트리 speed<1 (${e.uid}=${e.speed})`);
  }
  // C2: 정규 엔트리 서열 정렬(ACTION_CONST/speed 오름차순, 동점 uid 사전순) — roundOrder 내 정규 부분열이 정렬돼야
  for (let i = 1; i < normals.length; i++) {
    const a = normals[i - 1];
    const b = normals[i];
    const av = ACTION_CONST / a.speed;
    const bv = ACTION_CONST / b.speed;
    const ordered = av < bv || (av === bv && a.uid < b.uid) || (av === bv && a.uid === b.uid);
    v.check(ordered, "C2", "CRIT", () => `정규 서열 정렬 위반: ${a.uid}(${av}) 다음 ${b.uid}(${bv})`);
  }
  // C5/C7: current가 있으면 roundOrder[cursor]와 동일 ∧ 그 유닛 생존
  if (s.current !== null) {
    const atCursor = s.roundOrder[s.cursor];
    v.check(atCursor === s.current, "C7", "CRIT", () => `current ≠ roundOrder[cursor] (cursor=${s.cursor})`);
    const u = s.units.find((x) => x.uid === s.current!.uid);
    v.check(!!u && u.alive, "C5", "CRIT", () => `current가 죽은/없는 유닛 (${s.current!.uid})`);
  }

  // ── J. 관측 충실성(8.2) — buildObservation이 상태를 그대로 투영 ──
  const obs = buildObservation(s);
  v.check(obs.round === s.round, "J1", "CRIT", () => `obs.round≠state.round (${obs.round}/${s.round})`);
  v.check(obs.phase === s.phase, "J1", "CRIT", () => `obs.phase≠state.phase (${obs.phase}/${s.phase})`);
  v.check(obs.cursorIndex === s.cursor, "J1", "CRIT", () => `obs.cursorIndex≠state.cursor (${obs.cursorIndex}/${s.cursor})`);
  v.check(obs.order.length === s.roundOrder.length, "J1", "CRIT", () => `obs.order 길이≠roundOrder (${obs.order.length}/${s.roundOrder.length})`);
  v.check(
    obs.allies.length + obs.enemies.length === s.units.length,
    "J2", "NORM", () => `allies+enemies≠units (${obs.allies.length}+${obs.enemies.length}/${s.units.length})`,
  );

  return v.list;
}
