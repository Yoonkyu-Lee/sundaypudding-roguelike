// 패시브 디스패치 컨텍스트 타입 + 공용 헬퍼.
import type { GameState, Pos, Side, Trigger, Unit } from "../../types.ts";

/** 트리거 발생 컨텍스트(엔진이 훅에서 채워 fireTrigger에 전달). */
export interface TriggerCtx {
  on: Trigger["on"];
  subjectUid?: string; // 이벤트 1차 대상(피격자/턴 주체/상태 대상 등)
  attackerUid?: string; // 가해자/시전자(있으면)
  crit?: boolean;
  damage?: number;
  statusId?: string;
  skillId?: string;
  cell?: Pos;
  winnerSide?: Side; // battleEnd 전용 — 승리 진영
}

/** 한 룰을 평가할 때의 관점: self=룰 소유자 / subject=상대(이벤트 카운터파트) / target=현재 행동 대상. */
export interface RuleCtx {
  owner: Unit;
  subject?: Unit;
  target?: Unit;
  damage?: number; // 흡혈/비율반사용 — 트리거의 피해량(dealtDamage/damaged)
}

export function cmp(a: number, op: "lt" | "lte" | "eq" | "gte" | "gt", b: number): boolean {
  switch (op) {
    case "lt": return a < b;
    case "lte": return a <= b;
    case "eq": return a === b;
    case "gte": return a >= b;
    case "gt": return a > b;
  }
}

/** 그 유닛이 자기 진영 점유 최전열(살아있는 같은 편 최소 열)에 있는가. */
export function isFrontline(state: GameState, u: Unit): boolean {
  let front = Infinity;
  for (const o of state.units) if (o.alive && o.side === u.side) front = Math.min(front, o.pos.col);
  return u.pos.col === front;
}
