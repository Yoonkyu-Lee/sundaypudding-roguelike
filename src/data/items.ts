// 장착 아이템 (4.3) — 데이터 주도. 스탯은 오직 장착으로만 변동(4.2).
// 무기 = 공격 측(dmgFlat·crit%), 방어구 = 생존 측(hp·쉴드획득). 지닌물건 = 후속(데이터 없음).
// 메커니즘(스탯 합산·equip)은 엔진(core), 값은 여기.
import type { ItemDef } from "../core/types.ts";

export const ITEMS: Record<string, ItemDef> = {
  // ── 무기 (공격 상수 +N, 일부 치명) ──
  wood_bat: { id: "wood_bat", name: "각목", slot: "weapon", icon: "🏏", dmgFlat: 3, tier: 1, nextTierId: "nailed_bat" },
  nailed_bat: { id: "nailed_bat", name: "대못 박은 각목", slot: "weapon", icon: "🏏", dmgFlat: 6, mods: { critChance: 5 }, tier: 2 },
  brass_knuckle: { id: "brass_knuckle", name: "황동 너클", slot: "weapon", icon: "🥊", dmgFlat: 4, mods: { critChance: 8 } },
  sashimi_knife: { id: "sashimi_knife", name: "사시미 칼", slot: "weapon", icon: "🔪", dmgFlat: 2, mods: { critChance: 12, critMultiplier: 30 } },

  // ── 방어구 (HP +N, 쉴드 획득량 +N) ──
  leather_vest: { id: "leather_vest", name: "가죽 조끼", slot: "armor", icon: "🦺", mods: { hp: 10 } },
  iron_plate: { id: "iron_plate", name: "철판 조끼", slot: "armor", icon: "🛡️", mods: { hp: 16 }, shieldGainAdd: 3 },
  thick_coat: { id: "thick_coat", name: "두꺼운 외투", slot: "armor", icon: "🧥", mods: { hp: 6, evasion: 4 }, shieldGainAdd: 4 },
};

/** 상점/보상 등장 가능한 아이템 풀 (출현 순서는 추첨). */
export const ITEM_POOL: string[] = ["wood_bat", "brass_knuckle", "sashimi_knife", "leather_vest", "iron_plate", "thick_coat"];
