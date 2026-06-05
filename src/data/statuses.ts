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
    damageDealtMult: 50, // 주는 데미지 50%↓ (전역 곱연산 예외, 3.7)
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
  haste: {
    id: "haste",
    name: "신속",
    icon: "💨",
    buff: true,
    grantsInterrupt: true, // 정규 턴 행동 시 끼어들기 (끼어들기 출처가 스킬이 아닌 예: 버프)
  },

  // ── 공격/치명 보정 (3.6 공위증류) ──
  might: { id: "might", name: "투지", icon: "💪", buff: true, dmgDealtFlat: 6 }, // 공격력↑(공위증)
  weaken: { id: "weaken", name: "약화", icon: "📉", dmgDealtFlat: -5 }, // 공격력↓
  edge: { id: "edge", name: "예리", icon: "🎯", buff: true, critChanceAdd: 30, critMultiplierAdd: 50 }, // 치명↑
  ambush: { id: "ambush", name: "은신", icon: "🥷", buff: true, critChanceAdd: 100 }, // 다음 공격 무조건 치명
  invincible: { id: "invincible", name: "무적", icon: "💠", buff: true, invincible: true }, // 모든 피해 0
  taunt: { id: "taunt", name: "도발", icon: "📣", taunt: true }, // 적 공격 집중 유도(AI 참조)
  paralyze: { id: "paralyze", name: "마비", icon: "💫", speedMod: -3 }, // 속도↓(음수) → 서열 밀림 (3.5)
};
