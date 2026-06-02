// 결정론 휴리스틱 AI 정책. rng 미사용(순수) → 결정론 보존. 데모 자동플레이/적 조종.
// 행동자에 aiProfileId가 있으면 data/ai.ts 프로파일(우선순위 룰)을 먼저 적용, 미적용이면 공유 그리디.
import type { Action, GameState, LegalAction } from "../types.ts";
import { getLegalActions } from "../engine.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { AI_PROFILES } from "../../data/ai.ts";
import { applyProfile } from "./profile.ts";

/** 행동 선택: 프로파일(있으면) → 공유 그리디 fallback. 동점은 인덱스. */
export function chooseAction(state: GameState): Action {
  const legal = getLegalActions(state);
  if (legal.length === 0) return { type: "skip" };

  const skills = legal.filter((a) => a.action.type === "skill");
  if (skills.length === 0) return legal[0].action; // 스킵뿐

  const cur = state.current;
  const actor = (cur ? state.units.find((u) => u.uid === cur.uid) : null) ?? null;

  // 프로파일 우선 (적 전용 패턴). 룰이 하나도 적용 안 되면 null → 그리디로.
  if (actor?.aiProfileId) {
    const profile = AI_PROFILES[actor.aiProfileId];
    if (profile) {
      const chosen = applyProfile(state, actor, profile, skills);
      if (chosen) return chosen;
    }
  }

  return greedy(state, actor, skills);
}

/** 공유 그리디 fallback: 도발 우선 → 최저 HP 대상 + 최고 명중. (프로파일 없는 유닛의 기본) */
function greedy(state: GameState, actor: GameState["units"][number] | null, skillsIn: LegalAction[]): Action {
  let skills = skillsIn;
  // 도발: 상대편에 도발 보유 유닛이 있으면 그들을 우선 타겟 (있을 때만 강제)
  if (actor) {
    const oppSide = actor.side === "ally" ? "enemy" : "ally";
    const taunters = new Set(
      state.units
        .filter((u) => u.alive && u.side === oppSide && u.statuses.some((s) => STATUS_DEFS[s.defId].taunt && s.stacks > 0))
        .map((u) => u.uid),
    );
    if (taunters.size) {
      const forced = skills.filter((a) => a.targetUid && taunters.has(a.targetUid));
      if (forced.length) skills = forced;
    }
  }

  const hpOf = (uid?: string): number => {
    const u = state.units.find((x) => x.uid === uid);
    return u ? u.hp : Infinity;
  };

  let best: LegalAction = skills[0];
  let bestScore = Number.POSITIVE_INFINITY;
  skills.forEach((a) => {
    // 점수↓ 우선: 대상 HP 낮을수록, 명중 높을수록
    const score = hpOf(a.targetUid) * 1000 - (a.hitChance ?? 0);
    if (score < bestScore) {
      bestScore = score;
      best = a;
    }
  });
  return best.action;
}
