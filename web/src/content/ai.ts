// AI 행동결정 정책(우선순위 룰) — 디자이너 작성. 엔진(core/ai)이 해석.
// 캐릭터가 characters.ts의 aiProfileId로 참조. 룰은 위→아래, 첫 적용가능 룰이 행동 결정.
// 스키마: core/types/ai.ts (AiProfile). 작성법: src/content/README.md "AI 프로파일" 절.
import type { AiProfile } from "../contract/types.ts";

export const AI_PROFILES: Record<string, AiProfile> = {
  // 힐러: 위험한 아군 우선 치료 → 없으면 공격. (의사양반)
  healer: {
    id: "healer", name: "헌신", desc: "아군 HP 60% 미만이면 가장 위급한 아군을 치료, 아니면 공격.",
    rules: [
      { if: [{ c: "allyHpPctBelow", v: 60 }], prefer: "heal", target: "lowestHpAlly" },
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },

  // 암살자: 후열의 최저 HP 적을 노린다. (김천호)
  assassin: {
    id: "assassin", name: "암살", desc: "뒷열·저체력 적을 우선 저격.",
    rules: [
      { prefer: "damage", target: "lowestHpEnemy", weight: { backlineTarget: 6, lowHpTarget: 2 } },
    ],
  },

  // 수호자/탱커: 위급하면 자기 보호, 아니면 적 전체 약화·제어. (심영)
  guardian: {
    id: "guardian", name: "수호", desc: "HP 45% 미만이면 자기 방어, 아니면 적 약화/제어.",
    rules: [
      { if: [{ c: "selfHpPct", cmp: "lt", v: 45 }], prefer: "shield", target: "self" },
      { prefer: "applyStatus", target: "anyEnemy" },
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },

  // 유격병/밸런스 딜러: 위급하면 후퇴(버프), 아니면 최저 HP 적 공격. (정진영)
  skirmisher: {
    id: "skirmisher", name: "유격", desc: "HP 40% 미만이면 후퇴 태세, 아니면 최저 HP 적 공격.",
    rules: [
      { if: [{ c: "selfHpPct", cmp: "lt", v: 40 }], prefer: "applyStatus", target: "self" },
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },

  // ── 야인시대 런1 ── (gamedata/run01-youth.md)
  // 군림형 폭력배: 자기 강화(군림) 가능하면 먼저, 아니면 최저 HP 적 강타. (왕초)
  bruiser: {
    id: "bruiser", name: "군림", desc: "자기 강화 가능하면 군림, 아니면 최저 HP 적 공격.",
    rules: [
      { prefer: "applyStatus", target: "self" },
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },
  // 지휘관: 적 전체 약화/제어 우선, 아니면 공격. (미와)
  commander: {
    id: "commander", name: "지휘", desc: "적 약화/제어 우선, 아니면 최저 HP 적 공격.",
    rules: [
      { prefer: "applyStatus", target: "anyEnemy" },
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },
  // 겁쟁이: 자기 방어막부터, 여유 있으면 약하게 공격. (가네야마)
  coward: {
    id: "coward", name: "보신", desc: "HP 80% 미만이면 자기 방어, 아니면 소극 공격.",
    rules: [
      { if: [{ c: "selfHpPct", cmp: "lt", v: 80 }], prefer: "shield", target: "self" },
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },
  // 떼거리: 무지성 최저 HP 적 집중 가격(다수 압박). (일본 학생)
  swarm: {
    id: "swarm", name: "떼거리", desc: "최저 HP 적에 떼로 달려든다.",
    rules: [
      { prefer: "damage", target: "lowestHpEnemy" },
    ],
  },
};
