//! 조건 평가(if) — 순수, 모든 조건 AND. who 대상 없으면 false. TS `passives/conditions.ts`.
//! hpPct는 TS와 동일 f64 연산((hp/hpMax)*100) — 정수화는 동작변경(D2)이라 포팅 범위 밖. NUMERIC-POLICY §3.5.
use super::ctx::{cmp, cmp_i, is_frontline, RuleCtx, TriggerCtx};
use crate::util::{has_status, total_stacks};
use spr_types::combat::GameState;
use spr_types::passives::Condition;

fn alive_count(state: &GameState, side: &str) -> i64 {
    state.units.iter().filter(|u| u.alive && u.side == side).count() as i64
}

/// who(self/subject/target) → 유닛 인덱스. target 없으면 subject 폴백(TS pick).
fn pick(rctx: &RuleCtx, who: &str) -> Option<usize> {
    match who {
        "self" => Some(rctx.owner),
        "subject" => rctx.subject,
        _ => rctx.target.or(rctx.subject),
    }
}

pub fn eval_conditions(state: &mut GameState, tctx: &TriggerCtx, rctx: &RuleCtx, conds: &Option<Vec<Condition>>) -> bool {
    match conds {
        None => true,
        Some(cs) if cs.is_empty() => true,
        Some(cs) => {
            // every: 단락. chance가 RNG를 소비하므로 순서 보존 필수(TS every와 동일 좌→우).
            for c in cs {
                if !eval_one(state, tctx, rctx, c) {
                    return false;
                }
            }
            true
        }
    }
}

fn eval_one(state: &mut GameState, tctx: &TriggerCtx, rctx: &RuleCtx, c: &Condition) -> bool {
    let owner = rctx.owner;
    match c {
        Condition::HpPct { who, cmp: op, v } => match pick(rctx, who) {
            Some(i) => {
                let u = &state.units[i];
                cmp((u.hp as f64 / u.hp_max as f64) * 100.0, op, *v as f64)
            }
            None => false,
        },
        Condition::Round { cmp: op, v } => cmp_i(state.round, op, *v),
        Condition::SelfTurnCount { cmp: op, v } => cmp_i(state.units[owner].turn_count, op, *v),
        Condition::EveryN { n, of } => {
            let t = if of == "round" { state.round } else { state.units[owner].turn_count };
            t > 0 && t % n == 0
        }
        Condition::FirstTurn => state.units[owner].turn_count == 1,
        Condition::HasStatus { who, status_id, min_stacks } => match pick(rctx, who) {
            Some(i) => total_stacks(&state.units[i], status_id) >= min_stacks.unwrap_or(1),
            None => false,
        },
        Condition::MissingStatus { who, status_id } => match pick(rctx, who) {
            Some(i) => !has_status(&state.units[i], status_id),
            None => false,
        },
        Condition::AtColumn { who, cmp: op, v } => pick(rctx, who).map(|i| cmp_i(state.units[i].pos.col, op, *v)).unwrap_or(false),
        Condition::AtRow { who, cmp: op, v } => pick(rctx, who).map(|i| cmp_i(state.units[i].pos.row, op, *v)).unwrap_or(false),
        Condition::AtCell { who, row, col } => pick(rctx, who).map(|i| state.units[i].pos.row == *row && state.units[i].pos.col == *col).unwrap_or(false),
        Condition::IsFrontline { who } => pick(rctx, who).map(|i| is_frontline(state, i)).unwrap_or(false),
        Condition::SideCount { side, cmp: op, v } => cmp_i(alive_count(state, side), op, *v),
        Condition::Outnumbered => {
            let mine = state.units[owner].side.clone();
            let other = if mine == "ally" { "enemy" } else { "ally" };
            alive_count(state, &mine) < alive_count(state, other)
        }
        Condition::SubjectCharId { char_id } => rctx.subject.map(|i| state.units[i].char_id == *char_id).unwrap_or(false),
        Condition::SubjectSide { side } => rctx.subject.map(|i| state.units[i].side == *side).unwrap_or(false),
        Condition::WasCrit => tctx.crit == Some(true),
        Condition::DamageAtLeast { v } => tctx.damage.unwrap_or(0) >= *v,
        Condition::SkillIs { skill_id } => tctx.skill_id.as_deref() == Some(skill_id.as_str()),
        Condition::Chance { pct } => state.rng.chance(*pct),
        Condition::NodeTypeIs { .. } | Condition::GoldAtLeast { .. } => false, // 모험 스코프 — 전투 미충족
    }
}
