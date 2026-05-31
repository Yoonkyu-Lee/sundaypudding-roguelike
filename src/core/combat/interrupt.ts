// 끼어들기 (2.11) — 주체 예측 + 동적 삽입. 출처: 스킬 grantsInterrupt(self/target) + 버프(grantsInterrupt).
import type { GameState, Skill, Unit } from "../types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";

/**
 * 이 행동이 발생시킬 끼어들기의 **주체 uid 목록** — 모든 출처 종합 (2.11).
 * 출처: ① 스킬 grantsInterrupt(주체=self 또는 대상 아군) ② 보유 버프/상태(grantsInterrupt, 주체=보유자) ③ 향후 특성.
 * 주체가 행동자 본인이 아닐 수 있음(서포트가 다른 아군을 끼어들기시킴).
 * 실행(step)과 미리보기(웹)가 이 함수를 공유 → 분기 없음.
 */
export function predictInterruptSubjects(state: GameState, actor: Unit, skill: Skill | null, targetUid?: string): string[] {
  const subjects: string[] = [];
  if (skill?.grantsInterrupt) {
    const subj = skill.grantsInterruptTo === "target" ? targetUid : actor.uid;
    if (subj) for (let i = 0; i < skill.grantsInterrupt; i++) subjects.push(subj);
  }
  for (const s of actor.statuses) {
    if (STATUS_DEFS[s.defId].grantsInterrupt && s.stacks > 0) subjects.push(actor.uid); // 버프 1건당 1회(보유자)
  }
  return subjects;
}

/** 끼어들기 칸(주체별)을 현재 칸 바로 뒤에 동적 삽입 (2.11). */
export function insertInterrupts(state: GameState, subjects: string[]): void {
  // 역순 삽입으로 subjects 순서가 보존되도록 (모두 cursor+1에 꽂음)
  for (let i = subjects.length - 1; i >= 0; i--) {
    state.roundOrder.splice(state.cursor + 1, 0, { uid: subjects[i], kind: "interrupt", speed: 0 });
    state.log.push({ t: "interrupt", uid: subjects[i] });
  }
}
