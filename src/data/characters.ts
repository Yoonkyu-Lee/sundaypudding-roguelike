// 캐릭터 데이터 (포켓몬式 고유 디자인, 4.1). 스탯=기본값(보정 가능).
import type { Character } from "../core/types.ts";

export const CHARACTERS: Record<string, Character> = {
  //테스트 캐릭터 소생
  elf: {
    id: "elf",
    name: "엘프",
    avatar: "/avatars/elf.webp",
    playable: true,
    hp: 40,
    speedMin: 7,
    speedMax: 7,
    evasion: 5, // 회피 낮음(둔함)
    accuracy: 0,
    critChance: 10,
    critMultiplier: 1.5,
    skillIds: ["nimble", "enemy_suck", "slide", "gangta"], // 활성 4
  },


  beef: {
    id: "beef",
    name: "비프",
    hp: 40,
    speedMin: 3,
    speedMax: 6,
    evasion: 5, // 회피 낮음(둔함)
    accuracy: 0,
    critChance: 10,
    critMultiplier: 1.5,
    skillIds: ["gangta", "milchigi", "yeongyeok", "suho"], // 활성 4
  },
  pudding: {
    id: "pudding",
    name: "푸딩",
    hp: 24,
    speedMin: 6,
    speedMax: 9,
    evasion: 12, // 회피 높음(날쌤)
    accuracy: 0,
    critChance: 20,
    critMultiplier: 1.5,
    skillIds: ["begi", "chulhyeolbegi", "dokchim", "hwayeomtan"],
  },

  jelly: {
    id: "jelly",
    name: "젤리",
    hp: 22,
    speedMin: 5,
    speedMax: 8,
    evasion: 9,
    accuracy: 0,
    critChance: 10,
    critMultiplier: 1.5,
    skillIds: ["jaesaeng", "jaechok", "gasok", "gongpo", "gwantongbuyeo", "gaho"], // 활성 4 + 보유
  },

  // 적
  slime: {
    id: "slime",
    name: "슬라임",
    hp: 16,
    speedMin: 2,
    speedMax: 5,
    evasion: 6,
    accuracy: 0,
    critChance: 5,
    critMultiplier: 1.5,
    skillIds: ["jump", "bodytackle"],
  },
  frostspirit: {
    id: "frostspirit",
    name: "서리정령",
    hp: 18,
    speedMin: 4,
    speedMax: 7,
    evasion: 10,
    accuracy: 5,
    critChance: 10,
    critMultiplier: 1.5,
    skillIds: ["bingyeol", "jump"],
  },

  // ══ 우익(대한민청) — 플레이어 파티 ══
  // learnset = 전용기(앞 4, 시작 보유) + 배정된 범용기(u_*, 학습으로 습득). u_guard는 kim·shin·cho 공유(범용 예시)
  kim: { id: "kim", name: "김두한", avatar: "/avatars/kim.webp", playable: true, traitIds: ["bloodlust", "warspirit"], hp: 46, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 0, critChance: 25, critMultiplier: 1.6, skillIds: ["kim_punch", "kim_kick", "kim_oyabun", "kim_4dollar", "u_guard", "u_war_cry"] },
  shanghai: { id: "shanghai", name: "상하이 조", avatar: "/avatars/shanghai.webp", playable: true, traitIds: ["frontliner"], hp: 28, speedMin: 6, speedMax: 9, evasion: 12, accuracy: 5, critChance: 15, critMultiplier: 1.5, skillIds: ["sh_pistol", "sh_leg", "sh_grenade", "sh_ult", "u_aimed_shot", "u_snare"] },
  shin: { id: "shin", name: "신영균", avatar: "/avatars/shin.webp", playable: true, traitIds: ["thorns"], hp: 50, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 10, critMultiplier: 1.5, skillIds: ["shin_axe", "shin_charge", "shin_awaken", "shin_ult", "u_guard", "u_war_cry"] },
  cho: { id: "cho", name: "조병옥", avatar: "/avatars/cho.webp", playable: true, traitIds: ["vindictive", "miser"], hp: 34, speedMin: 5, speedMax: 8, evasion: 9, accuracy: 0, critChance: 5, critMultiplier: 1.5, skillIds: ["cho_warn", "cho_martial", "cho_police", "cho_ult", "u_first_aid", "u_guard"] },

  // ══ 좌익(조선공산당) — 적(엘리트/보스) ══
  jung: { id: "jung", name: "정진영", avatar: "/avatars/jung.webp", traitIds: ["barbed"], hp: 32, speedMin: 6, speedMax: 9, evasion: 11, accuracy: 0, critChance: 15, critMultiplier: 1.5, skillIds: ["jung_shot", "jung_retreat", "jung_charge", "jung_ult"] },
  chunho: { id: "chunho", name: "김천호", avatar: "/avatars/chunho.webp", traitIds: ["bloodfiend", "reflexes"], hp: 26, speedMin: 7, speedMax: 10, evasion: 14, accuracy: 0, critChance: 25, critMultiplier: 1.6, skillIds: ["chunho_stab", "chunho_shadow", "chunho_dagger", "chunho_ult"] },
  shim: { id: "shim", name: "심영", avatar: "/avatars/shim.webp", traitIds: ["rally"], hp: 48, speedMin: 3, speedMax: 6, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 1.5, skillIds: ["shim_speech", "shim_mother", "shim_flag", "shim_ult"] },
  doctor: { id: "doctor", name: "의사양반", avatar: "/avatars/doctor.webp", hp: 30, speedMin: 5, speedMax: 8, evasion: 8, accuracy: 0, critChance: 5, critMultiplier: 1.5, skillIds: ["doc_tap", "doc_heal", "doc_cleanse", "doc_ult"] },

  // ══ 잡몹 ══
  thug: { id: "thug", name: "깡패", avatar: "🧢", hp: 14, speedMin: 3, speedMax: 6, evasion: 6, accuracy: 0, critChance: 5, critMultiplier: 1.5, skillIds: ["thug_punch", "thug_kick"] },
  thug2: { id: "thug2", name: "각목 깡패", avatar: "🪵", hp: 18, speedMin: 2, speedMax: 5, evasion: 5, accuracy: 0, critChance: 5, critMultiplier: 1.5, skillIds: ["thug_club", "thug_throw"] },
};
