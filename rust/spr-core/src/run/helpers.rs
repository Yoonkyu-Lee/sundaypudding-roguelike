//! 런 공유 변이 헬퍼 (TS `core/run/helpers.ts`). 노드 조회·파티 회복·스킬 보유/강화 변이.
//! 시퀀서/runInstantLayers·completeNode는 P2-6서.
use super::data::RunData;
use super::passives::{fire_run_trigger, RunTriggerCtx};
use super::types::RunState;
use crate::util::round_div;
use spr_types::map::FloorDef;
use spr_types::party::PartyMemberState;

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
