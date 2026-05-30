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
    grantsInterrupt: 1, // 끼어들기 1회 (스킬 출처, 2.11)
    effects: [{ kind: "damage", amount: 8 }],
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

  // ── 젤리(서포터): 특수효과 부여 ──
  jaesaeng: {
    id: "jaesaeng",
    name: "재생술",
    target: "ally",
    cooldown: 2,
    accuracy: 0,
    alwaysHit: true,
    effects: [{ kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }],
  },
  gongpo: {
    id: "gongpo",
    name: "공포술",
    target: "enemy",
    cooldown: 3,
    accuracy: 80,
    effects: [
      { kind: "damage", amount: 3 },
      { kind: "applyStatus", statusId: "fear", stacks: 3, duration: 2 },
    ],
  },
  gwantongbuyeo: {
    id: "gwantongbuyeo",
    name: "관통부여",
    target: "ally",
    cooldown: 3,
    accuracy: 0,
    alwaysHit: true,
    effects: [{ kind: "applyStatus", statusId: "pierce", stacks: 1, duration: 2 }],
  },
  gaho: {
    id: "gaho",
    name: "가호",
    target: "ally",
    cooldown: 4,
    accuracy: 0,
    alwaysHit: true,
    effects: [{ kind: "applyStatus", statusId: "undying", stacks: 1, duration: 1 }],
  },
  gasok: {
    id: "gasok",
    name: "가속술",
    target: "ally",
    cooldown: 3,
    accuracy: 0,
    alwaysHit: true,
    // 신속(버프) 부여 → 받은 아군은 정규 턴 행동 시 끼어들기 (끼어들기 출처가 스킬이 아닌 예시)
    effects: [{ kind: "applyStatus", statusId: "haste", stacks: 1, duration: 2 }],
  },
  jaechok: {
    id: "jaechok",
    name: "재촉",
    target: "ally",
    cooldown: 3,
    accuracy: 0,
    alwaysHit: true,
    grantsInterrupt: 1,
    grantsInterruptTo: "target", // 시전자가 아닌 "대상 아군"이 끼어들기 (서포트)
    effects: [],
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

  // ══ 우익(대한민청) — 플레이어 ══
  // 김두한 (브루저/딜러, 높은 치명)
  kim_punch: { id: "kim_punch", name: "종로의 주먹", target: "enemy", cooldown: 0, accuracy: 90, targetCells: FRONT2, effects: [{ kind: "damage", amount: 14 }] },
  kim_kick: { id: "kim_kick", name: "공중 이단 발차기", target: "enemy", cooldown: 2, accuracy: 90, targetCells: FRONT2, effects: [{ kind: "move", who: "self", deltaCol: -3 }, { kind: "damage", amount: 12 }] },
  kim_oyabun: { id: "kim_oyabun", name: "오야붕의 위엄", target: "self", cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "cleanse" }, { kind: "applyStatus", statusId: "might", stacks: 1, duration: 3 }, { kind: "applyStatus", statusId: "edge", stacks: 1, duration: 3 }] },
  kim_4dollar: { id: "kim_4dollar", name: "4달러", target: "ally", cooldown: 5, accuracy: 0, alwaysHit: true, grantsInterrupt: 1, grantsInterruptTo: "target", effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },

  // 상하이 조 (원거리 디버퍼)
  sh_pistol: { id: "sh_pistol", name: "권총 사격", target: "enemy", cooldown: 0, accuracy: 90, effects: [{ kind: "damage", amount: 10 }] },
  sh_leg: { id: "sh_leg", name: "다리 조준 사격", target: "enemy", cooldown: 2, accuracy: 90, effects: [{ kind: "damage", amount: 4 }, { kind: "applyStatus", statusId: "paralyze", stacks: 2, duration: 2 }] },
  sh_grenade: { id: "sh_grenade", name: "수류탄 투척", target: "enemy", area: { kind: "square", radius: 1 }, cooldown: 3, accuracy: 85, effects: [{ kind: "damage", amount: 7 }, { kind: "applyStatus", statusId: "burn", stacks: 1, duration: 2 }] },
  sh_ult: { id: "sh_ult", name: "안 되겠소, 쏩니다!", target: "enemy", cooldown: 5, accuracy: 90, effects: [{ kind: "damage", amount: 16 }, { kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 }] },

  // 신영균 (광전사)
  shin_axe: { id: "shin_axe", name: "도끼 휘두르기", target: "enemy", cooldown: 0, accuracy: 90, targetCells: FRONT2, effects: [{ kind: "damage", amount: 12 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 3 }] },
  shin_charge: { id: "shin_charge", name: "분노의 돌격", target: "enemy", cooldown: 3, accuracy: 90, targetCells: FRONT2, effects: [{ kind: "move", who: "self", deltaCol: -3 }, { kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }, { kind: "applyStatusSelf", statusId: "weaken", stacks: 1, duration: 1 }] },
  shin_awaken: { id: "shin_awaken", name: "야수성 각성", target: "self", cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 3 }, { kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }] },
  shin_ult: { id: "shin_ult", name: "에이잇! 할아버지!", target: "enemy", area: { kind: "all" }, cooldown: 4, accuracy: 85, effects: [{ kind: "damage", amount: 9 }, { kind: "applyStatus", statusId: "bleed", stacks: 1, duration: 2 }] },

  // 조병옥 (지휘관/서포터)
  cho_warn: { id: "cho_warn", name: "경무부장의 경고", target: "enemy", cooldown: 0, accuracy: 90, effects: [{ kind: "damage", amount: 3 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },
  cho_martial: { id: "cho_martial", name: "비상계엄령", target: "ally", area: { kind: "all" }, cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 10 }] },
  cho_police: { id: "cho_police", name: "경찰 병력 호출", target: "enemy", area: { kind: "row" }, cooldown: 4, accuracy: 85, effects: [{ kind: "damage", amount: 6 }, { kind: "applyStatus", statusId: "paralyze", stacks: 1, duration: 2 }] },
  cho_ult: { id: "cho_ult", name: "당장 그만두시오!", target: "enemy", area: { kind: "all" }, cooldown: 5, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "fear", stacks: 3, duration: 2 }] },

  // ══ 좌익(조선공산당) — 적 ══
  // 정진영 (밸런스 딜러)
  jung_shot: { id: "jung_shot", name: "냉철한 사격", target: "enemy", cooldown: 0, accuracy: 90, effects: [{ kind: "applyStatusSelf", statusId: "pierce", stacks: 1, duration: 1 }, { kind: "damage", amount: 9 }] },
  jung_retreat: { id: "jung_retreat", name: "전술적 후퇴", target: "self", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "move", who: "self", deltaCol: 3 }, { kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },
  jung_charge: { id: "jung_charge", name: "전위대 돌격 명령", target: "enemy", area: { kind: "all" }, cooldown: 3, accuracy: 85, effects: [{ kind: "damage", amount: 6 }] },
  jung_ult: { id: "jung_ult", name: "이념의 이름으로", target: "ally", area: { kind: "all" }, cooldown: 5, accuracy: 0, alwaysHit: true, grantsInterrupt: 1, grantsInterruptTo: "self", effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },

  // 김천호 (암살자)
  chunho_stab: { id: "chunho_stab", name: "암습", target: "enemy", cooldown: 0, accuracy: 95, targetCells: FRONT2, effects: [{ kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 3 }] },
  chunho_shadow: { id: "chunho_shadow", name: "그림자 걸음", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "move", who: "self", deltaCol: 3 }, { kind: "applyStatus", statusId: "ambush", stacks: 1, duration: 2 }] },
  chunho_dagger: { id: "chunho_dagger", name: "독바른 단검 투척", target: "enemy", cooldown: 3, accuracy: 90, effects: [{ kind: "damage", amount: 6 }, { kind: "applyStatus", statusId: "poison", stacks: 2, duration: 3 }] },
  chunho_ult: { id: "chunho_ult", name: "잔인한 처단", target: "enemy", cooldown: 4, accuracy: 90, effects: [{ kind: "damage", amount: 18 }] },

  // 심영 (탱커/도발)
  shim_speech: { id: "shim_speech", name: "사회주의 찬양 연설", target: "enemy", area: { kind: "all" }, cooldown: 2, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }, { kind: "applyStatusSelf", statusId: "taunt", stacks: 1, duration: 2 }] },
  shim_mother: { id: "shim_mother", name: "어머니...", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 14 }, { kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }] },
  shim_flag: { id: "shim_flag", name: "님을 위한 전진", target: "ally", area: { kind: "all" }, cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 8 }] },
  shim_ult: { id: "shim_ult", name: "내가 고자라니!", target: "enemy", area: { kind: "all" }, cooldown: 5, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 }] },

  // 의사양반 (힐러)
  doc_tap: { id: "doc_tap", name: "청진기 찰싹", target: "enemy", cooldown: 0, accuracy: 90, targetCells: FRONT2, effects: [{ kind: "damage", amount: 3 }] },
  doc_heal: { id: "doc_heal", name: "안심하세요", target: "ally", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "heal", amount: 16 }, { kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }] },
  doc_cleanse: { id: "doc_cleanse", name: "치료", target: "ally", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "cleanse" }] },
  doc_ult: { id: "doc_ult", name: "백병원 강제 입원", target: "ally", cooldown: 5, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "invincible", stacks: 1, duration: 1 }] },

  // ══ 잡몹(깡패) ══
  thug_punch: { id: "thug_punch", name: "주먹질", target: "enemy", cooldown: 0, accuracy: 85, targetCells: FRONT2, effects: [{ kind: "damage", amount: 6 }] },
  thug_kick: { id: "thug_kick", name: "발길질", target: "enemy", cooldown: 1, accuracy: 85, targetCells: FRONT2, effects: [{ kind: "damage", amount: 5 }] },
  thug_club: { id: "thug_club", name: "각목 후려치기", target: "enemy", cooldown: 0, accuracy: 85, targetCells: FRONT2, effects: [{ kind: "damage", amount: 8 }] },
  thug_throw: { id: "thug_throw", name: "벽돌 던지기", target: "enemy", cooldown: 2, accuracy: 80, effects: [{ kind: "damage", amount: 6 }] },
};
