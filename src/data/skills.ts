// 스킬 데이터 (데이터 주도). 위치 마스크·쿨타임·명중·효과 전부 데이터로. (2.4~2.10)
import type { Pos, Skill } from "../core/types.ts";

// 전방 2개 열(근접 사정권). 비어있으면 = 어디든(원거리).
const FRONT2: Pos[] = [];
for (let row = 0; row < 4; row++) {
  FRONT2.push({ row, col: 0 }, { row, col: 1 });
}

export const SKILLS: Record<string, Skill> = {
  // ── 비프(브루저: 데미지 + 재배치 + 끼어들기 + 쉴드) ──
  gangta: {
    id: "gangta",
    name: "강타",
    target: "enemy",
    cooldown: 0,
    accuracy: 90,
    targetCells: FRONT2, // 근접: 전방만 (2.4)
    effects: [{ kind: "damage", amount: 12 }],
  },
  milchigi: {
    id: "milchigi",
    name: "밀치기",
    target: "enemy",
    cooldown: 2,
    accuracy: 95,
    targetCells: FRONT2,
    effects: [
      { kind: "damage", amount: 6 },
      { kind: "move", who: "target", deltaCol: 1 }, // 뒤로 밀기 (6.4)
    ],
  },
  yeongyeok: {
    id: "yeongyeok",
    name: "연격",
    target: "enemy",
    cooldown: 4,
    accuracy: 90,
    targetCells: FRONT2,
    effects: [
      { kind: "damage", amount: 8 },
      { kind: "interruptSelf" }, // 끼어들기 1회 (2.11)
    ],
  },
  suho: {
    id: "suho",
    name: "수호",
    target: "self",
    cooldown: 3,
    accuracy: 0,
    alwaysHit: true,
    effects: [{ kind: "shield", amount: 12 }], // 쉴드 부여 (2.9)
  },

  // ── 푸딩(딜러: 상태이상 특화) ──
  begi: {
    id: "begi",
    name: "베기",
    target: "enemy",
    cooldown: 0,
    accuracy: 95,
    targetCells: FRONT2,
    effects: [{ kind: "damage", amount: 10 }],
  },
  chulhyeolbegi: {
    id: "chulhyeolbegi",
    name: "출혈베기",
    target: "enemy",
    cooldown: 2,
    accuracy: 95,
    targetCells: FRONT2,
    effects: [
      { kind: "damage", amount: 6 },
      { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 3 },
    ],
  },
  dokchim: {
    id: "dokchim",
    name: "독침",
    target: "enemy",
    cooldown: 2,
    accuracy: 90,
    // 원거리: targetCells 생략 = 아무 칸
    effects: [
      { kind: "damage", amount: 4 },
      { kind: "applyStatus", statusId: "poison", stacks: 2, duration: 3 },
    ],
  },
  hwayeomtan: {
    id: "hwayeomtan",
    name: "화염탄",
    target: "enemy",
    cooldown: 3,
    accuracy: 85,
    effects: [
      { kind: "damage", amount: 8 },
      { kind: "applyStatus", statusId: "burn", stacks: 2, duration: 3 },
    ],
  },

  // ── 적 ──
  jump: {
    id: "jump",
    name: "점프공격",
    target: "enemy",
    cooldown: 0,
    accuracy: 85,
    effects: [{ kind: "damage", amount: 7 }],
  },
  bodytackle: {
    id: "bodytackle",
    name: "몸통박치기",
    target: "enemy",
    cooldown: 1,
    accuracy: 90,
    targetCells: FRONT2,
    effects: [{ kind: "damage", amount: 5 }],
  },
  bingyeol: {
    id: "bingyeol",
    name: "빙결술",
    target: "enemy",
    cooldown: 3,
    accuracy: 80,
    effects: [
      { kind: "damage", amount: 3 },
      { kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 },
    ],
  },
};
