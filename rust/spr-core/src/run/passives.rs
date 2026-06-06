//! 모험(run) 스코프 패시브 디스패처 (TS `core/run/passives.ts`) — 노드/골드/파티HP 사건 반응.
//! 상태=RunState/PartyMemberState, 룰 컴파일은 전투와 공유. 재진입 가드=RunState.firing(P0-3). RNG·f64(hpPct) TS 동일.
use super::data::RunData;
use crate::passives::compile::compile_rules;
use crate::util::round_div;
use spr_types::passives::{Condition, Effect, Trigger};

/// run 트리거 컨텍스트.
pub struct RunTriggerCtx {
    pub on: String,
    pub node_type: Option<String>,
    pub dir: Option<String>,
}

impl RunTriggerCtx {
    pub fn new(on: &str) -> Self {
        RunTriggerCtx { on: on.to_string(), node_type: None, dir: None }
    }
}

fn cmp(a: f64, op: &str, b: f64) -> bool {
    match op {
        "lt" => a < b,
        "lte" => a <= b,
        "eq" => a == b,
        "gte" => a >= b,
        _ => a > b,
    }
}

fn eval_run_cond(run: &mut super::types::RunState, ctx: &RunTriggerCtx, pi: usize, c: &Condition) -> bool {
    match c {
        Condition::HpPct { who, cmp: op, v } => {
            if who != "self" {
                return false;
            }
            let m = &run.party[pi];
            cmp((m.hp as f64 / m.max_hp as f64) * 100.0, op, *v as f64)
        }
        Condition::Chance { pct } => run.rng.chance(*pct),
        Condition::NodeTypeIs { node_type } => ctx.node_type.as_deref() == Some(node_type.as_str()),
        Condition::GoldAtLeast { v } => run.gold >= *v,
        _ => false, // 전투 전용 조건은 모험 스코프 미충족
    }
}

fn target_char_ids(run: &super::types::RunState, owner_char: &str, t: &str) -> Vec<String> {
    match t {
        "allAllies" => run.party.iter().filter(|m| m.hp > 0).map(|m| m.char_id.clone()).collect(),
        "otherAllies" => run.party.iter().filter(|m| m.hp > 0 && m.char_id != owner_char).map(|m| m.char_id.clone()).collect(),
        _ => vec![owner_char.to_string()],
    }
}

fn apply_run_effect(run: &mut super::types::RunState, owner_char: &str, e: &Effect) {
    match e {
        Effect::GoldDelta { amount } => {
            run.gold = (run.gold + amount).max(0);
            run.log.push(format!("골드 {}{} (패시브)", if *amount >= 0 { "+" } else { "" }, amount));
        }
        Effect::HealParty { pct } => {
            for m in &mut run.party {
                if m.hp > 0 {
                    m.hp = (m.hp + round_div(m.max_hp * pct, 100)).min(m.max_hp);
                }
            }
        }
        Effect::GrantRunStatus { status_id, stacks, duration, target } => {
            for cid in target_char_ids(run, owner_char, target) {
                run.pending_statuses.entry(cid).or_default().push(spr_types::party::PendingStatus { status_id: status_id.clone(), stacks: *stacks, duration: *duration });
            }
        }
        _ => {} // 전투 전용 효과는 모험 스코프 무시
    }
}

/// 모험 트리거 발동 — 살아있는 파티원의 (보유스킬 passives + 특성) 룰 매칭 실행. 파티순→룰idx. TS fireRunTrigger.
pub fn fire_run_trigger(run: &mut super::types::RunState, ctx: &RunTriggerCtx, d: &RunData) {
    if run.firing {
        return;
    }
    run.firing = true;
    for pi in 0..run.party.len() {
        if run.party[pi].hp <= 0 {
            continue;
        }
        let char_id = run.party[pi].char_id.clone();
        let active = run.party[pi].active_skill_ids.clone();
        let rules = compile_rules(&char_id, &active, &d.chars, &d.skills, &d.traits);
        for cr in &rules {
            let w = &cr.rule.when;
            if w.on() != ctx.on {
                continue;
            }
            // nodeType/dir 필터
            match w {
                Trigger::NodeEnter { node_type } | Trigger::NodeClear { node_type } => {
                    if let Some(nt) = node_type {
                        if ctx.node_type.as_deref() != Some(nt.as_str()) {
                            continue;
                        }
                    }
                }
                Trigger::PartyHpChange { dir } => {
                    if let Some(dr) = dir {
                        if ctx.dir.as_deref() != Some(dr.as_str()) {
                            continue;
                        }
                    }
                }
                _ => {}
            }
            if let Some(conds) = &cr.rule.if_conds {
                if !conds.iter().all(|c| eval_run_cond(run, ctx, pi, c)) {
                    continue;
                }
            }
            let effects = cr.rule.then.clone();
            for eff in &effects {
                apply_run_effect(run, &char_id, eff);
            }
        }
    }
    run.firing = false;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::run::{create_run, RunData};
    use std::collections::HashMap;

    #[test]
    fn fire_run_trigger_parity() {
        // miser(cho): nodeClear → +3G. warspirit(kim): nodeEnter(boss) → 전원 might 계승. TS 동일.
        let d = RunData::load();
        let rd = spr_data::default_run();
        let mut r = create_run(42, &rd.roster.clone(), &rd, &HashMap::new(), false, &d.chars);
        let mut c1 = RunTriggerCtx::new("nodeClear");
        c1.node_type = Some("battle".into());
        fire_run_trigger(&mut r, &c1, &d);
        assert_eq!(r.gold, 3);
        let mut c2 = RunTriggerCtx::new("nodeEnter");
        c2.node_type = Some("boss".into());
        fire_run_trigger(&mut r, &c2, &d);
        for cid in ["kim", "shin", "shanghai", "cho"] {
            let ps = &r.pending_statuses[cid];
            assert_eq!(ps.len(), 1);
            assert_eq!(ps[0].status_id, "might");
            assert_eq!((ps[0].stacks, ps[0].duration), (1, 99));
        }
    }
}
