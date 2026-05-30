// 결정론 휴리스틱 AI 정책. rng 미사용(순수) → 결정론 보존. 데모 자동플레이/적 조종.
// (적 전용 패턴이 늘어나면 여기서 정책을 분기/확장 — ai/ 폴더로 성장)
import type { Action, GameState, LegalAction } from "../types.ts";
import { getLegalActions } from "../engine.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";

/** 가장 체력 낮은 대상에게, 명중 높은 스킬을 — 단순 그리디. 도발 우선. 동점은 인덱스. */
export function chooseAction(state: GameState): Action {
  const legal = getLegalActions(state);
  if (legal.length === 0) return { type: "skip" };

  let skills = legal.filter((a) => a.action.type === "skill");
  if (skills.length === 0) return legal[0].action; // 스킵뿐

  // 도발: 상대편에 도발 보유 유닛이 있으면 그들을 우선 타겟 (있을 때만 강제)
  const cur = state.current;
  const actor = cur ? state.units.find((u) => u.uid === cur.uid) : null;
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
