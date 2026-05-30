// 캐릭터 데이터 (포켓몬式 고유 디자인, 4.1). 스탯=기본값(보정 가능).
import type { Character } from "../core/types.ts";

export const CHARACTERS: Record<string, Character> = {
  beef: {
    id: "beef",
    name: "비프",
    hp: 40,
    spdMin: 3,
    spdMax: 6,
    dex: 5, // 회피 낮음(둔함)
    accuracy: 0,
    critPct: 10,
    critMult: 1.5,
    skillIds: ["gangta", "milchigi", "yeongyeok", "suho"], // 활성 4
  },
  pudding: {
    id: "pudding",
    name: "푸딩",
    hp: 24,
    spdMin: 6,
    spdMax: 9,
    dex: 12, // 회피 높음(날쌤)
    accuracy: 0,
    critPct: 20,
    critMult: 1.5,
    skillIds: ["begi", "chulhyeolbegi", "dokchim", "hwayeomtan"],
  },

  jelly: {
    id: "jelly",
    name: "젤리",
    hp: 22,
    spdMin: 5,
    spdMax: 8,
    dex: 9,
    accuracy: 0,
    critPct: 10,
    critMult: 1.5,
    skillIds: ["jaesaeng", "jaechok", "gasok", "gongpo", "gwantongbuyeo", "gaho"], // 활성 4 + 보유
  },

  // 적
  slime: {
    id: "slime",
    name: "슬라임",
    hp: 16,
    spdMin: 2,
    spdMax: 5,
    dex: 6,
    accuracy: 0,
    critPct: 5,
    critMult: 1.5,
    skillIds: ["jump", "bodytackle"],
  },
  frostspirit: {
    id: "frostspirit",
    name: "서리정령",
    hp: 18,
    spdMin: 4,
    spdMax: 7,
    dex: 10,
    accuracy: 5,
    critPct: 10,
    critMult: 1.5,
    skillIds: ["bingyeol", "jump"],
  },

  // ══ 우익(대한민청) — 플레이어 파티 ══
  kim: { id: "kim", name: "김두한", avatar: "/avatars/kim.webp", hp: 46, spdMin: 4, spdMax: 7, dex: 8, accuracy: 0, critPct: 25, critMult: 1.6, skillIds: ["kim_punch", "kim_kick", "kim_oyabun", "kim_4dollar"] },
  shanghai: { id: "shanghai", name: "상하이 조", avatar: "/avatars/shanghai.webp", hp: 28, spdMin: 6, spdMax: 9, dex: 12, accuracy: 5, critPct: 15, critMult: 1.5, skillIds: ["sh_pistol", "sh_leg", "sh_grenade", "sh_ult"] },
  shin: { id: "shin", name: "신영균", avatar: "/avatars/shin.webp", hp: 50, spdMin: 3, spdMax: 6, dex: 6, accuracy: 0, critPct: 10, critMult: 1.5, skillIds: ["shin_axe", "shin_charge", "shin_awaken", "shin_ult"] },
  cho: { id: "cho", name: "조병옥", avatar: "/avatars/cho.webp", hp: 34, spdMin: 5, spdMax: 8, dex: 9, accuracy: 0, critPct: 5, critMult: 1.5, skillIds: ["cho_warn", "cho_martial", "cho_police", "cho_ult"] },

  // ══ 좌익(조선공산당) — 적(엘리트/보스) ══
  jung: { id: "jung", name: "정진영", avatar: "/avatars/jung.webp", hp: 32, spdMin: 6, spdMax: 9, dex: 11, accuracy: 0, critPct: 15, critMult: 1.5, skillIds: ["jung_shot", "jung_retreat", "jung_charge", "jung_ult"] },
  chunho: { id: "chunho", name: "김천호", avatar: "/avatars/chunho.webp", hp: 26, spdMin: 7, spdMax: 10, dex: 14, accuracy: 0, critPct: 25, critMult: 1.6, skillIds: ["chunho_stab", "chunho_shadow", "chunho_dagger", "chunho_ult"] },
  shim: { id: "shim", name: "심영", avatar: "/avatars/shim.webp", hp: 48, spdMin: 3, spdMax: 6, dex: 5, accuracy: 0, critPct: 5, critMult: 1.5, skillIds: ["shim_speech", "shim_mother", "shim_flag", "shim_ult"] },
  doctor: { id: "doctor", name: "의사양반", avatar: "/avatars/doctor.webp", hp: 30, spdMin: 5, spdMax: 8, dex: 8, accuracy: 0, critPct: 5, critMult: 1.5, skillIds: ["doc_tap", "doc_heal", "doc_cleanse", "doc_ult"] },

  // ══ 잡몹 ══
  thug: { id: "thug", name: "깡패", avatar: "🧢", hp: 14, spdMin: 3, spdMax: 6, dex: 6, accuracy: 0, critPct: 5, critMult: 1.5, skillIds: ["thug_punch", "thug_kick"] },
  thug2: { id: "thug2", name: "각목 깡패", avatar: "🪵", hp: 18, spdMin: 2, spdMax: 5, dex: 5, accuracy: 0, critPct: 5, critMult: 1.5, skillIds: ["thug_club", "thug_throw"] },
};
