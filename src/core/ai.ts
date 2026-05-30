// 결정론 휴리스틱 AI. rng 미사용(순수 함수) → 결정론 보존. 데모 자동플레이/적 조종용.
import type { Action, GameState, LegalAction } from "./types.ts";
import { getLegalActions } from "./engine.ts";

/** 가장 체력 낮은 대상에게, 명중 높은 스킬을 — 단순 그리디. 동점은 인덱스. */
export function chooseAction(state: GameState): Action {
  const legal = getLegalActions(state);
  if (legal.length === 0) return { type: "skip" };

  const skills = legal.filter((a) => a.action.type === "skill");
  if (skills.length === 0) return legal[0].action; // 스킵뿐

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
