//! 런 공유 변이 헬퍼 (TS `core/run/helpers.ts`). 노드 조회·파티 회복·즉시 레이어·노드 완료·스킬 변이.
use super::data::RunData;
use super::passives::{fire_run_trigger, RunTriggerCtx};
use super::types::RunState;
use crate::graph::live_reachable;
use crate::util::round_div;
use spr_types::map::{FloorDef, Layer};
use spr_types::party::{PartyMemberState, PendingStatus};
use std::collections::HashSet;

/// 현재 층 그래프(RunState 단일 진실원).
pub fn cur_floor(run: &RunState) -> &FloorDef {
    &run.run_def.floors[run.floor]
}

/// 노드 조회(없으면 panic — TS throw).
pub fn node<'a>(run: &'a RunState, id: &str) -> &'a spr_types::map::MapNode {
    cur_floor(run).nodes.iter().find(|n| n.id == id).unwrap_or_else(|| panic!("node not found: {}", id))
}

/// 파티 회복. pct=정수퍼센트. revive=true면 전투불능(hp≤0)도 maxHp×pct%로 부활. TS healParty.
pub fn heal_party(run: &mut RunState, pct: i64, revive: bool, d: &RunData) {
    for m in &mut run.party {
        if m.hp <= 0 {
            if revive {
                m.hp = round_div(m.max_hp * pct, 100).max(1);
            }
            continue;
        }
        m.hp = (m.hp + round_div(m.max_hp * pct, 100)).min(m.max_hp);
    }
    let mut ctx = RunTriggerCtx::new("partyHpChange");
    ctx.dir = Some("heal".to_string());
    fire_run_trigger(run, &ctx, d);
}

/// 즉시 데코레이터 레이어 실행 — gold/heal/grantStatus/text 순서 적용 + 로그. TS runInstantLayers.
pub fn run_instant_layers(run: &mut RunState, layers: &[Layer], d: &RunData) {
    for l in layers {
        match l {
            Layer::Gold { amount } => {
                run.gold = (run.gold + amount).max(0);
                run.log.push(format!("{}{}G", if *amount >= 0 { "+" } else { "" }, amount));
                if *amount > 0 {
                    fire_run_trigger(run, &RunTriggerCtx::new("goldGain"), d);
                }
            }
            Layer::Heal { pct, revive } => {
                heal_party(run, *pct, revive.unwrap_or(false), d);
                run.log.push(format!("파티 {}% 회복", pct));
            }
            Layer::GrantStatus { char_id, status_id, stacks, duration } => {
                let ids: Vec<String> = match char_id {
                    Some(c) => vec![c.clone()],
                    None => run.party.iter().map(|m| m.char_id.clone()).collect(),
                };
                for id in ids {
                    run.pending_statuses.entry(id).or_default().push(PendingStatus { status_id: status_id.clone(), stacks: *stacks, duration: *duration });
                }
                run.log.push(format!("상태 부여(다음 전투): {}", status_id));
            }
            Layer::Text { text } => run.log.push(text.clone()),
            _ => {} // 상호작용 레이어는 시퀀서가 처리
        }
    }
}

/// 노드 완료 — visited 추가 + onResolve 데코 + reachable 갱신 + nodeClear. TS completeNode.
pub fn complete_node(run: &mut RunState, node_id: &str, d: &RunData) {
    if !run.visited.iter().any(|v| v == node_id) {
        run.visited.push(node_id.to_string());
    }
    let (on_resolve, ntype) = {
        let n = node(run, node_id);
        (n.layers.as_ref().and_then(|l| l.on_resolve.clone()).unwrap_or_default(), n.node_type.clone())
    };
    run_instant_layers(run, &on_resolve, d);
    run.current_node_id = node_id.to_string();
    let visited_set: HashSet<String> = run.visited.iter().cloned().collect();
    let reach = {
        let floor = cur_floor(run);
        live_reachable(floor, node_id, &visited_set)
    };
    run.reachable = reach;
    run.active_node_id = None;
    run.phase = "map".to_string();
    let mut ctx = RunTriggerCtx::new("nodeClear");
    ctx.node_type = Some(ntype);
    fire_run_trigger(run, &ctx, d);
}

/// 스킬 티어 교체(강화) — 보유/활성 양쪽. TS upgradeOwned.
pub fn upgrade_owned(m: &mut PartyMemberState, from_id: &str, to_id: &str) {
    for a in [&mut m.owned_skill_ids, &mut m.active_skill_ids] {
        if let Some(i) = a.iter().position(|s| s == from_id) {
            a[i] = to_id.to_string();
        }
    }
}

/// 스킬 학습 — 보유 추가 + 여유 있으면 활성. TS learnOwned.
pub fn learn_owned(m: &mut PartyMemberState, skill_id: &str) {
    if m.owned_skill_ids.iter().any(|s| s == skill_id) {
        return;
    }
    m.owned_skill_ids.push(skill_id.to_string());
    if m.active_skill_ids.len() < 4 {
        m.active_skill_ids.push(skill_id.to_string());
    }
}
