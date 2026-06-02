// 상점 (7.2) — 골드 구매. 강화권은 상점에서만(4.6). 진열 생성 + 구매 + 나가기.
import type { PartyMemberState } from "../types.ts";
import type { RunState, ShopOffer } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";
import { unlockedTier, ownsUpgradeLine } from "./rewards.ts";
import { genItemOffers } from "./items.ts";
import { healParty, upgradeOwned, learnOwned, completeNode } from "./helpers.ts";

export function generateShop(run: RunState): ShopOffer[] {
  let k = 0;
  const mk = () => `shop${run.visited.length}_${k++}`;
  const pool: ShopOffer[] = [];
  const tierOk = (m: PartyMemberState, sid: string) => !run.useMastery || (SKILLS[sid]?.tier ?? 1) <= unlockedTier(m.masteryLevel); // 숙련도 tier 게이팅(4.4)
  for (const m of run.party.filter((p) => p.hp > 0)) {
    const c = CHARACTERS[m.charId];
    for (const sid of m.ownedSkillIds) {
      const sk = SKILLS[sid];
      const to = sk?.nextTierId ? SKILLS[sk.nextTierId] : undefined;
      if (sk && to && tierOk(m, sk.nextTierId!)) pool.push({ id: mk(), kind: "upgrade", cost: 25, charId: m.charId, fromSkillId: sid, toSkillId: sk.nextTierId!, label: `강화권: ${c.name} 「${sk.name}」→「${to.name}」` });
    }
    for (const sid of c.skillIds) {
      if (!ownsUpgradeLine(m.ownedSkillIds, sid) && !SKILLS[sid]?.exclusiveTo && tierOk(m, sid)) pool.push({ id: mk(), kind: "learn", cost: 20, charId: m.charId, skillId: sid, label: `스킬: ${c.name} 「${SKILLS[sid].name}」(범용)` });
    }
  }
  const picked: ShopOffer[] = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(run.rng.int(0, pool.length - 1), 1)[0]);
  picked.push(...genItemOffers(run, mk, 2)); // 장착 아이템 진열 (4.3)
  picked.push({ id: mk(), kind: "heal", cost: 15, pct: 0.5, label: "치료: 파티 50% 회복" });
  return picked;
}

export function buyShopOffer(run: RunState, offerId: string): void {
  if (run.phase !== "shop" || !run.shop) return;
  const o = run.shop.find((x) => x.id === offerId);
  if (!o || run.gold < o.cost) return;
  run.gold -= o.cost;
  if (o.kind === "upgrade") { const m = run.party.find((p) => p.charId === o.charId); if (m) upgradeOwned(m, o.fromSkillId, o.toSkillId); }
  else if (o.kind === "learn") { const m = run.party.find((p) => p.charId === o.charId); if (m) learnOwned(m, o.skillId); }
  else if (o.kind === "buyItem") run.inventory.push(o.itemId); // 인벤토리에 추가 → 시트에서 장착
  else if (o.kind === "heal") healParty(run, o.pct);
  run.shop = run.shop.filter((x) => x.id !== offerId); // 구매한 항목 제거(재구매 방지)
  run.log.push(`구매: ${o.label} (−${o.cost}G)`);
}

export function leaveShop(run: RunState): void {
  if (run.phase !== "shop") return;
  run.shop = null;
  completeNode(run, run.activeNodeId!);
}
