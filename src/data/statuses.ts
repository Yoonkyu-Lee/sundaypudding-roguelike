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
  fear: {
    id: "fear",
    name: "공포",
    icon: "😱",
    shieldShred: true, // 쉴드 잠식 가속 (스택만큼), HP 효율 불변 (3.5)
  },

  // ── 특수효과 (출처 의존, 3.6) ──
  pierce: {
    id: "pierce",
    name: "관통",
    icon: "🗡️",
    buff: true,
    pierce: true, // 공격이 쉴드 무시
  },
  undying: {
    id: "undying",
    name: "불사",
    icon: "✨",
    buff: true,
    undying: true, // 1턴 생존
  },
  regen: {
    id: "regen",
    name: "재생",
    icon: "💚",
    buff: true,
    hot: { trigger: "turnEnd", healPerStack: 4 }, // 턴 종료 시 회복
  },
};
