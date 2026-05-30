// 상태이상 정의 레지스트리 (데이터 주도). 거동=엔진, 값=여기. (3.5, 8.6)
import type { StatusDef, StatusDefId } from "../core/types.ts";

export const STATUS_DEFS: Record<StatusDefId, StatusDef> = {
  burn: {
    id: "burn",
    name: "화상",
    icon: "🔥",
    dot: { trigger: "turnEnd", dmgPerStack: 3 }, // 턴 종료 시 (3.5)
  },
  poison: {
    id: "poison",
    name: "중독",
    icon: "🧪",
    dot: { trigger: "turnStart", dmgPerStack: 3 }, // 턴 시작 시
  },
  bleed: {
    id: "bleed",
    name: "출혈",
    icon: "🩸",
    dot: { trigger: "onAction", dmgPerStack: 2 }, // 행동 시 (정규+끼어들기, 2.11)
  },
  freeze: {
    id: "freeze",
    name: "빙결",
    icon: "❄️",
    actionDenial: true, // 그 턴 행동불가
  },
  frost: {
    id: "frost",
    name: "동상",
    icon: "🥶",
    damageDealtMult: 0.5, // 주는 데미지 50%↓ (전역 곱연산 예외, 3.7)
  },
};
