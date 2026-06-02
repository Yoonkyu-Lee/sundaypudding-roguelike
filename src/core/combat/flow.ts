// 전투 흐름 오케스트레이터 — 행동 1회 처리(step). 출혈(onAction)·스킬 해소·끼어들기·턴종료·승패.
import type { Action, GameState } from "../types.ts";
import { SKILLS } from "../../data/skills.ts";
import { isFrozen, unitById } from "../util.ts";
import { tickPeriodic } from "./status.ts";
import { resolveSkill, resolveAnchorUid } from "./skills.ts";
import { insertInterrupts, predictInterruptSubjects } from "./interrupt.ts";
import { getLegalActions } from "./targeting.ts";
import { advance, onNormalTurnEnd } from "./turnOrder.ts";
import { checkWin } from "./winCheck.ts";
import { fireTrigger } from "./passives/index.ts";

export function step(state: GameState, action: Action): GameState {
  if (state.phase !== "inProgress" || !state.current) return state;
  const entry = state.current;
  const actor = unitById(state, entry.uid);

  if (action.type === "skip") {
    // 빙결=강제, 쓸 스킬 있으면 자발적 대기("chosen"), 없으면 강제 스킵
    const reason = isFrozen(actor)
      ? "frozen"
      : getLegalActions(state).some((a) => a.action.type === "skill")
        ? "chosen"
        : "noUsableSkill";
    state.log.push({ t: "skip", uid: actor.uid, reason });
  } else {
    const skill = SKILLS[action.skillId];
    if (!skill) throw new Error(`unknown skill: ${action.skillId}`);
    // 합법성 최소 검증
    if ((actor.cooldowns[action.skillId] ?? 0) > 0 || isFrozen(actor)) {
      throw new Error(`illegal action: ${action.skillId} (cooldown/frozen)`);
    }
    // 출혈: 행동 시 발동 (정규 + 끼어들기 모두, 2.11)
    tickPeriodic(state, actor, "onAction");
    if (actor.alive) fireTrigger(state, { on: "beforeAction", subjectUid: actor.uid });
    if (actor.alive) {
      // 쿨타임은 사용 즉시 설정(끼어들기에서도 설정됨; 단 '감소'만 끼어들기서 안 됨)
      actor.cooldowns[action.skillId] = skill.cooldown;
      resolveSkill(state, actor, skill, action);
      // 끼어들기: 정규 턴에서만, 모든 출처(스킬+버프) 종합. 주체는 self/대상아군 (2.11). 끼어들기 턴은 연쇄 방지로 제외.
      // 앵커 uid를 action에서 해소(웹은 targetCell만 보내므로 targetUid가 비어 있을 수 있음 — 대상 끼어들기 버그 수정).
      if (entry.kind === "normal") {
        const anchorUid = resolveAnchorUid(state, actor, skill, action);
        insertInterrupts(state, predictInterruptSubjects(state, actor, skill, anchorUid));
      }
    }
  }

  // 턴 종료 처리 — 정규 턴만 (끼어들기는 차감/주기효과 없음, 2.11)
  if (entry.kind === "normal" && actor.alive) onNormalTurnEnd(state, actor);

  state.current = null;
  if (checkWin(state)) return state;
  advance(state);
  return state;
}
