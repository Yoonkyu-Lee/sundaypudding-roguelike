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
    skillIds: ["jaesaeng", "gongpo", "gwantongbuyeo", "gaho"], // 서포터
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
};
