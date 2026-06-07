//! 상점 (TS `core/run/shop.ts`, 7.2) — 진열 생성(저작+절차) + 구매 + 나가기. RNG 추첨 결정론.
use super::data::RunData;
use super::helpers::{complete_node, heal_party, learn_owned, upgrade_owned};
use super::items::gen_item_offers;
use super::layers::advance_core;
use super::rewards::{owns_upgrade_line, reward_gate_ok};
use super::types::{RunState, ShopOffer};
use spr_types::map::ShopOfferDef;
use spr_types::party::PartyMemberState;

fn tier_ok(run: &RunState, m: &PartyMemberState, sid: &str, d: &RunData) -> bool {
    d.skills.get(sid).map(|sk| reward_gate_ok(sk, run.use_mastery, m.mastery_level, m.class_tier)).unwrap_or(false)
}

fn materialize_offers(run: &RunState, defs: &[ShopOfferDef], mk: &mut dyn FnMut() -> String, d: &RunData) -> Vec<ShopOffer> {
    let mut out = Vec::new();
    for sd in defs {
        match sd {
            ShopOfferDef::BuyItem { item_id, cost } => {
                if let Some(it) = d.items.get(item_id) {
                    out.push(ShopOffer::BuyItem { id: mk(), cost: *cost, item_id: it.id.clone(), label: format!("「{}」", it.name) });
                }
            }
            ShopOfferDef::Heal { pct, cost } => out.push(ShopOffer::Heal { id: mk(), cost: *cost, pct: *pct, label: format!("치료: 파티 {}% 회복", pct) }),
            ShopOfferDef::Learn { char_id, skill_id, cost } => {
                if let (Some(c), Some(sk)) = (d.chars.get(char_id), d.skills.get(skill_id)) {
                    if run.party.iter().any(|p| &p.char_id == char_id && p.hp > 0) {
                        out.push(ShopOffer::Learn { id: mk(), cost: *cost, char_id: char_id.clone(), skill_id: skill_id.clone(), label: format!("스킬: {} 「{}」", c.name, sk.name) });
                    }
                }
            }
        }
    }
    out
}

fn generate_procedural(run: &mut RunState, mk: &mut dyn FnMut() -> String, d: &RunData) -> Vec<ShopOffer> {
    let living: Vec<PartyMemberState> = run.party.iter().filter(|m| m.hp > 0).cloned().collect();
    let mut pool: Vec<ShopOffer> = Vec::new();
    for m in &living {
        let c = &d.chars[&m.char_id];
        for sid in &m.owned_skill_ids {
            if let Some(sk) = d.skills.get(sid) {
                if let Some(next) = &sk.next_tier_id {
                    if let Some(to) = d.skills.get(next) {
                        if tier_ok(run, m, next, d) {
                            pool.push(ShopOffer::Upgrade { id: mk(), cost: 25, char_id: m.char_id.clone(), from_skill_id: sid.clone(), to_skill_id: next.clone(), label: format!("강화권: {} 「{}」→「{}」", c.name, sk.name, to.name) });
                        }
                    }
                }
            }
        }
        for sid in &c.skill_ids {
            let sk = match d.skills.get(sid) {
                Some(s) => s,
                None => continue,
            };
            if !owns_upgrade_line(&m.owned_skill_ids, sid, &d.skills) && sk.exclusive_to.is_none() && tier_ok(run, m, sid, d) {
                pool.push(ShopOffer::Learn { id: mk(), cost: 20, char_id: m.char_id.clone(), skill_id: sid.clone(), label: format!("스킬: {} 「{}」(범용)", c.name, sk.name) });
            }
        }
    }
    let mut picked: Vec<ShopOffer> = Vec::new();
    while picked.len() < 3 && !pool.is_empty() {
        let idx = run.rng.int(0, pool.len() as i64 - 1) as usize;
        picked.push(pool.remove(idx));
    }
    picked.extend(gen_item_offers(run, mk, 2, &d.items, &d.item_pool));
    picked.push(ShopOffer::Heal { id: mk(), cost: 15, pct: 50, label: "치료: 파티 50% 회복".to_string() });
    picked
}

/// 노드 상점 진열 — offers 있으면 저작(+keepGenerated 절차), 없으면 절차. TS generateShop.
pub fn generate_shop(run: &mut RunState, offers: Option<Vec<ShopOfferDef>>, keep_generated: bool, d: &RunData) -> Vec<ShopOffer> {
    let visited_len = run.visited.len();
    let mut k = 0i64;
    let mut mk = move || {
        let s = format!("shop{}_{}", visited_len, k);
        k += 1;
        s
    };
    if let Some(o) = &offers {
        if !o.is_empty() {
            let authored = materialize_offers(run, o, &mut mk, d);
            if keep_generated {
                let mut a = authored;
                a.extend(generate_procedural(run, &mut mk, d));
                return a;
            }
            return authored;
        }
    }
    generate_procedural(run, &mut mk, d)
}

/// 상점 구매. TS buyShopOffer.
pub fn buy_shop_offer(run: &mut RunState, offer_id: &str, d: &RunData) {
    if run.phase != "shop" {
        return;
    }
    let o = match &run.shop {
        Some(s) => match s.iter().find(|x| offer_id_of(x) == offer_id) {
            Some(o) => o.clone(),
            None => return,
        },
        None => return,
    };
    let cost = cost_of(&o);
    if run.gold < cost {
        return;
    }
    run.gold -= cost;
    match &o {
        ShopOffer::Upgrade { char_id, from_skill_id, to_skill_id, .. } => {
            if let Some(mi) = run.party.iter().position(|p| &p.char_id == char_id) {
                upgrade_owned(&mut run.party[mi], from_skill_id, to_skill_id);
            }
        }
        ShopOffer::Learn { char_id, skill_id, .. } => {
            if let Some(mi) = run.party.iter().position(|p| &p.char_id == char_id) {
                learn_owned(&mut run.party[mi], skill_id);
            }
        }
        ShopOffer::BuyItem { item_id, .. } => run.inventory.push(item_id.clone()),
        ShopOffer::Heal { pct, .. } => heal_party(run, *pct, false, d),
    }
    if let Some(s) = &mut run.shop {
        s.retain(|x| offer_id_of(x) != offer_id);
    }
    run.log.push(format!("구매: {} (−{}G)", label_of(&o), cost));
}

/// 상점 나가기 → 시퀀스 복귀(coreCursor) 또는 노드 완료. TS leaveShop.
pub fn leave_shop(run: &mut RunState, d: &RunData) {
    if run.phase != "shop" {
        return;
    }
    run.shop = None;
    if run.core_cursor.is_some() {
        advance_core(run, d);
    } else if let Some(aid) = run.active_node_id.clone() {
        complete_node(run, &aid, d);
    }
}

fn offer_id_of(o: &ShopOffer) -> &str {
    match o {
        ShopOffer::Upgrade { id, .. } | ShopOffer::Learn { id, .. } | ShopOffer::BuyItem { id, .. } | ShopOffer::Heal { id, .. } => id,
    }
}
fn cost_of(o: &ShopOffer) -> i64 {
    match o {
        ShopOffer::Upgrade { cost, .. } | ShopOffer::Learn { cost, .. } | ShopOffer::BuyItem { cost, .. } | ShopOffer::Heal { cost, .. } => *cost,
    }
}
fn label_of(o: &ShopOffer) -> &str {
    match o {
        ShopOffer::Upgrade { label, .. } | ShopOffer::Learn { label, .. } | ShopOffer::BuyItem { label, .. } | ShopOffer::Heal { label, .. } => label,
    }
}
