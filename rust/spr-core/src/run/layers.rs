//! 코어 레이어 시퀀서 (TS `core/run/layers.ts` + `data/nodeCores.ts`). 노드 core[]를 순서 실행.
//! 데코=즉시(helpers), 상호작용(combat/reward/shop/event)=phase 블록 후 advance_core 복귀.
use super::data::RunData;
use super::encounter::start_encounter_layer;
use super::helpers::{complete_node, node, run_instant_layers};
use super::rewards::gen_rewards;
use super::shop::generate_shop;
use super::types::RunState;
use crate::battle::create_battle_grown;
use spr_types::data::{Encounter, Placement};
use spr_types::map::{Layer, MapNode, NodeRule};

fn copy_roster(d: &RunData, key: &str) -> Vec<Placement> {
    d.node_rosters.get(key).or_else(|| d.node_rosters.get("battle")).cloned().unwrap_or_default()
}

/// 타입별 기본 core 시드. TS defaultCore.
pub fn default_core(node_type: &str, d: &RunData) -> Vec<Layer> {
    match node_type {
        "battle" => vec![Layer::Combat { roster: Some(copy_roster(d, "battle")), boss: false, rules: None }, Layer::Gold { amount: 8 }, Layer::Reward { tier: Some(1) }],
        "elite" => vec![Layer::Combat { roster: Some(copy_roster(d, "elite")), boss: false, rules: None }, Layer::Gold { amount: 16 }, Layer::Reward { tier: Some(2) }],
        "boss" => vec![Layer::Combat { roster: Some(copy_roster(d, "boss")), boss: true, rules: None }, Layer::Gold { amount: 24 }, Layer::Reward { tier: Some(3) }],
        "shop" => vec![Layer::Shop { offers: None, keep_generated: None }],
        "rest" => vec![Layer::Heal { pct: 50, revive: Some(true) }],
        "encounter" => vec![Layer::Event { event: None }],
        _ => vec![],
    }
}

/// 노드 실행 core — 인라인 우선, 없으면 타입 기본. TS nodeCore.
pub fn node_core(n: &MapNode, d: &RunData) -> Vec<Layer> {
    match &n.core {
        Some(c) if !c.is_empty() => c.clone(),
        _ => default_core(&n.node_type, d),
    }
}

/// core 시퀀스 시작.
pub fn start_core(run: &mut RunState, node_id: &str, d: &RunData) {
    run.core_cursor = Some(0);
    step_core(run, node_id, d);
}

/// 현재 커서부터 진행: 데코 즉시 소비, 상호작용 만나면 블록, 소진 시 노드 완료.
pub fn step_core(run: &mut RunState, node_id: &str, d: &RunData) {
    let core = node_core(node(run, node_id), d);
    loop {
        let cursor = run.core_cursor.unwrap() as usize;
        if cursor >= core.len() {
            run.core_cursor = None;
            complete_node(run, node_id, d);
            return;
        }
        match &core[cursor] {
            Layer::Combat { roster, boss, rules } => {
                start_combat(run, roster.clone(), *boss, rules.clone().unwrap_or_default(), d);
                return;
            }
            Layer::Reward { tier } => {
                let rewards = gen_rewards(run, tier.unwrap_or(1), &d.chars, &d.skills, &d.items, &d.item_pool);
                run.rewards = Some(rewards);
                run.phase = "reward".to_string();
                run.log.push("보상 선택".to_string());
                return;
            }
            Layer::Shop { offers, keep_generated } => {
                let shop = generate_shop(run, offers.clone(), keep_generated.unwrap_or(false), d);
                run.shop = Some(shop);
                run.phase = "shop".to_string();
                run.log.push("상점 진입".to_string());
                return;
            }
            Layer::Event { event } => {
                start_encounter_layer(run, event.clone(), d);
                return;
            }
            other => {
                run_instant_layers(run, std::slice::from_ref(other), d);
                run.core_cursor = Some(cursor as i64 + 1);
            }
        }
    }
}

/// 전투 레이어 시작 — 적 구성(override 우선) + 계승상태 + 노드룰 주입.
fn start_combat(run: &mut RunState, roster: Option<Vec<Placement>>, boss: bool, rules: Vec<NodeRule>, d: &RunData) {
    let seed = run.rng.int(0, 2_000_000_000) as u32;
    let enemies = match roster {
        Some(r) if !r.is_empty() => r,
        _ => copy_roster(d, "battle"),
    };
    let enc = Encounter { id: "combat".to_string(), name: "전투".to_string(), allies: vec![], enemies, boss };
    let battle = create_battle_grown(seed, &enc, &run.party, &run.pending_statuses, &rules, &d.chars, &d.skills, &d.traits, &d.items, &d.defs);
    run.battle = Some(battle);
    run.pending_statuses.clear();
    run.phase = "battle".to_string();
    run.log.push("전투 진입".to_string());
}

/// 상호작용 종료 후 다음 스텝.
pub fn advance_core(run: &mut RunState, d: &RunData) {
    run.battle = None;
    let cur = run.core_cursor.unwrap();
    run.core_cursor = Some(cur + 1);
    let aid = run.active_node_id.clone().unwrap();
    step_core(run, &aid, d);
}
