// 장착 아이템 — 인벤토리/장착/해제 + 상점·보상 오퍼 생성 (4.3). run.ts에서 분리(파일 크기).
// 메커니즘: equip 시 maxHp 재계산(방어구 HP 보정), 나머지 스탯은 전투 생성(makeUnit)에서 합산.
import type { EquipSlot, PartyMemberState } from "../types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { ITEMS, ITEM_POOL } from "../../data/items.ts";
import type { RewardOption, RunState, ShopOffer } from "./types.ts";

const SLOT_NAME: Record<EquipSlot, string> = { weapon: "무기", armor: "방어구", held: "지닌물건" };

/** 장착 방어구의 HP 보정을 반영해 maxHp 재계산 + 현재 hp 조정(증가분 부여/감소 클램프). */
function recomputeHp(m: PartyMemberState): void {
  const base = CHARACTERS[m.charId].hp;
  let hpBonus = 0;
  for (const id of [m.equipped.weapon, m.equipped.armor, m.equipped.held]) {
    hpBonus += (id ? ITEMS[id]?.mods?.hp : 0) ?? 0;
  }
  const newMax = base + hpBonus;
  const delta = newMax - m.maxHp;
  m.maxHp = newMax;
  if (m.hp > 0) m.hp = delta > 0 ? m.hp + delta : Math.min(m.hp, newMax); // 전투불능(0)은 부활 안 함
}

/** 인벤토리 아이템을 슬롯에 장착(비전투 중 언제나). 기존 장착은 인벤토리로 반환. */
export function equipItem(run: RunState, charId: string, slot: EquipSlot, itemId: string): void {
  if (run.phase === "battle") return;
  const m = run.party.find((p) => p.charId === charId);
  const it = ITEMS[itemId];
  if (!m || !it || it.slot !== slot) return; // 슬롯-아이템 불일치 거부
  const i = run.inventory.indexOf(itemId);
  if (i < 0) return; // 인벤토리에 있어야 장착 가능
  run.inventory.splice(i, 1);
  const prev = m.equipped[slot];
  if (prev) run.inventory.push(prev);
  m.equipped[slot] = itemId;
  recomputeHp(m);
  run.log.push(`${m.charId ? CHARACTERS[m.charId].name : charId} 장착: 「${it.name}」`);
}

/** 장착 해제 → 인벤토리로(비전투 중 언제나). */
export function unequipItem(run: RunState, charId: string, slot: EquipSlot): void {
  if (run.phase === "battle") return;
  const m = run.party.find((p) => p.charId === charId);
  if (!m) return;
  const cur = m.equipped[slot];
  if (!cur) return;
  delete m.equipped[slot];
  run.inventory.push(cur);
  recomputeHp(m);
}

/** 상점 장착 아이템 진열 (n개, 풀에서 중복 없이 추첨). */
export function genItemOffers(run: RunState, mk: () => string, n = 2): ShopOffer[] {
  const pool = [...ITEM_POOL];
  const out: ShopOffer[] = [];
  for (let k = 0; k < n && pool.length; k++) {
    const it = ITEMS[pool.splice(run.rng.int(0, pool.length - 1), 1)[0]];
    out.push({ id: mk(), kind: "buyItem", cost: 30, itemId: it.id, label: `${SLOT_NAME[it.slot]}: 「${it.name}」` });
  }
  return out;
}

/** 보상 후보용 장착 아이템 옵션 (4.5 장신구 — 가끔 풀에 진입). */
export function itemRewardOptions(run: RunState, mk: () => string, n = 1): RewardOption[] {
  const pool = [...ITEM_POOL];
  const out: RewardOption[] = [];
  for (let k = 0; k < n && pool.length; k++) {
    const it = ITEMS[pool.splice(run.rng.int(0, pool.length - 1), 1)[0]];
    out.push({ id: mk(), kind: "item", itemId: it.id, label: `장신구: 「${it.name}」 (${SLOT_NAME[it.slot]})` });
  }
  return out;
}
