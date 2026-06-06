//! 장착 아이템 — 인벤토리/장착/해제 + 상점·보상 오퍼 생성 (TS `core/run/items.ts`, 4.3).
use super::types::{RunState, ShopOffer};
use super::RewardOption;
use spr_types::data::{Character, ItemDef};
use spr_types::party::PartyMemberState;
use std::collections::HashMap;

pub fn slot_name(slot: &str) -> &'static str {
    match slot {
        "weapon" => "무기",
        "armor" => "방어구",
        _ => "지닌물건",
    }
}

/// 장착 방어구 HP 보정 반영해 maxHp 재계산 + hp 조정. TS recomputeHp.
pub fn recompute_hp(m: &mut PartyMemberState, chars: &HashMap<String, Character>, items: &HashMap<String, ItemDef>) {
    let base = chars[&m.char_id].hp;
    let mut hp_bonus = 0;
    for id in [&m.equipped.weapon, &m.equipped.armor, &m.equipped.held].into_iter().flatten() {
        hp_bonus += items.get(id).and_then(|it| it.mods.as_ref()).map(|md| md.hp).unwrap_or(0);
    }
    let new_max = base + hp_bonus;
    let delta = new_max - m.max_hp;
    m.max_hp = new_max;
    if m.hp > 0 {
        m.hp = if delta > 0 { m.hp + delta } else { m.hp.min(new_max) };
    }
}

/// 인벤토리 아이템 슬롯 장착(비전투). 기존 장착은 인벤토리로 반환. TS equipItem.
pub fn equip_item(run: &mut RunState, char_id: &str, slot: &str, item_id: &str, chars: &HashMap<String, Character>, items: &HashMap<String, ItemDef>) {
    if run.phase == "battle" {
        return;
    }
    let it = match items.get(item_id) {
        Some(it) if it.slot == slot => it.clone(),
        _ => return,
    };
    let mi = match run.party.iter().position(|p| p.char_id == char_id) {
        Some(i) => i,
        None => return,
    };
    let inv_i = match run.inventory.iter().position(|x| x == item_id) {
        Some(i) => i,
        None => return,
    };
    run.inventory.remove(inv_i);
    let prev = slot_get(&run.party[mi], slot);
    if let Some(p) = prev {
        run.inventory.push(p);
    }
    slot_set(&mut run.party[mi], slot, Some(item_id.to_string()));
    recompute_hp(&mut run.party[mi], chars, items);
    run.log.push(format!("{} 장착: 「{}」", chars[char_id].name, it.name));
}

/// 장착 해제 → 인벤토리. TS unequipItem.
pub fn unequip_item(run: &mut RunState, char_id: &str, slot: &str, chars: &HashMap<String, Character>, items: &HashMap<String, ItemDef>) {
    if run.phase == "battle" {
        return;
    }
    let mi = match run.party.iter().position(|p| p.char_id == char_id) {
        Some(i) => i,
        None => return,
    };
    let cur = match slot_get(&run.party[mi], slot) {
        Some(c) => c,
        None => return,
    };
    slot_set(&mut run.party[mi], slot, None);
    run.inventory.push(cur);
    recompute_hp(&mut run.party[mi], chars, items);
}

fn slot_get(m: &PartyMemberState, slot: &str) -> Option<String> {
    match slot {
        "weapon" => m.equipped.weapon.clone(),
        "armor" => m.equipped.armor.clone(),
        _ => m.equipped.held.clone(),
    }
}
fn slot_set(m: &mut PartyMemberState, slot: &str, v: Option<String>) {
    match slot {
        "weapon" => m.equipped.weapon = v,
        "armor" => m.equipped.armor = v,
        _ => m.equipped.held = v,
    }
}

/// 상점 장착 아이템 진열(n개, 풀 중복없이 추첨). TS genItemOffers.
pub fn gen_item_offers(run: &mut RunState, mk: &mut dyn FnMut() -> String, n: i64, items: &HashMap<String, ItemDef>, item_pool: &[String]) -> Vec<ShopOffer> {
    let mut pool = item_pool.to_vec();
    let mut out = Vec::new();
    let mut k = 0;
    while k < n && !pool.is_empty() {
        let idx = run.rng.int(0, pool.len() as i64 - 1) as usize;
        let it = &items[&pool.remove(idx)];
        out.push(ShopOffer::BuyItem { id: mk(), cost: 30, item_id: it.id.clone(), label: format!("{}: 「{}」", slot_name(&it.slot), it.name) });
        k += 1;
    }
    out
}

/// 보상용 장착 아이템 옵션(장신구, 가끔 풀 진입). TS itemRewardOptions.
pub fn item_reward_options(run: &mut RunState, mk: &mut dyn FnMut() -> String, n: i64, items: &HashMap<String, ItemDef>, item_pool: &[String]) -> Vec<RewardOption> {
    let mut pool = item_pool.to_vec();
    let mut out = Vec::new();
    let mut k = 0;
    while k < n && !pool.is_empty() {
        let idx = run.rng.int(0, pool.len() as i64 - 1) as usize;
        let it = &items[&pool.remove(idx)];
        out.push(RewardOption::Item { id: mk(), item_id: it.id.clone(), label: format!("장신구: 「{}」 ({})", it.name, slot_name(&it.slot)) });
        k += 1;
    }
    out
}
