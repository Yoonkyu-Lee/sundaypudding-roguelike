//! 패시브 디스패처 (TS `passives/dispatch.ts`) — 매칭 수집 → 결정론 정렬 → if 평가 → then 실행.
//! 재진입 가드: 깊이 캡 + (소유자#룰idx) 콜스택 차단 + maxPerTurn/Battle. 상태는 GameState 귀속(P0-3).
//! Codex 최대리스크: 매칭 순서(ord→uid→idx) + RNG 소비 순서 = TS와 바이트 동일해야.
use super::conditions::eval_conditions;
use super::ctx::{RuleCtx, TriggerCtx};
use super::effects::apply_effect;
use crate::util::StatusDefs;
use spr_types::combat::{GameState, SpeedRoll};
use spr_types::passives::{Effect, Trigger};
use spr_types::skills::Skill;
use std::collections::HashMap;

const MAX_DEPTH: i64 = 4;

fn unit_idx(state: &GameState, uid: &Option<String>) -> Option<usize> {
    uid.as_ref().and_then(|u| state.units.iter().position(|x| &x.uid == u))
}

fn who_match(state: &GameState, owner: usize, other: Option<usize>, who: &Option<String>) -> bool {
    match who.as_deref().unwrap_or("self") {
        "self" => other == Some(owner),
        "ally" => other.map(|o| state.units[o].side == state.units[owner].side).unwrap_or(false),
        "enemy" => other.map(|o| state.units[o].side != state.units[owner].side).unwrap_or(false),
        "any" => other.is_some(),
        _ => false,
    }
}

fn order_index_of(state: &GameState, uid: &str) -> i64 {
    match state.round_order.iter().position(|q| q.uid == uid) {
        Some(i) => i as i64,
        None => state.round_order.len() as i64 + 1,
    }
}

/// death용: owner가 아닌 cand 우선, 아니면 fallback, 아니면 cand?:fallback. TS other().
fn other(owner: usize, cand: Option<usize>, fallback: Option<usize>) -> Option<usize> {
    if let Some(c) = cand {
        if c != owner {
            return Some(c);
        }
    }
    if let Some(f) = fallback {
        if f != owner {
            return Some(f);
        }
    }
    cand.or(fallback)
}

/// 트리거+소유자 매칭 → RuleCtx(owner/subject) 또는 None. TS match().
fn match_rule(state: &GameState, tctx: &TriggerCtx, owner: usize, w: &Trigger) -> Option<RuleCtx> {
    let subj = unit_idx(state, &tctx.subject_uid);
    let atk = unit_idx(state, &tctx.attacker_uid);
    match w {
        Trigger::BattleStart | Trigger::RoundStart | Trigger::RoundEnd => Some(RuleCtx::of(owner)),
        Trigger::BattleEnd { result } => {
            if let Some(res) = result {
                let won = Some(state.units[owner].side.clone()) == tctx.winner_side;
                if (res == "win") != won {
                    return None;
                }
            }
            Some(RuleCtx::of(owner))
        }
        Trigger::TurnStart { who } | Trigger::TurnEnd { who } | Trigger::BeforeAction { who } => {
            if who_match(state, owner, subj, who) {
                Some(RuleCtx::with_subject(owner, subj))
            } else {
                None
            }
        }
        Trigger::InterruptStart => {
            if subj == Some(owner) {
                Some(RuleCtx::of(owner))
            } else {
                None
            }
        }
        Trigger::EveryNTurns { n } => {
            let tc = state.units[owner].turn_count;
            if subj == Some(owner) && tc > 0 && tc % n == 0 {
                Some(RuleCtx::of(owner))
            } else {
                None
            }
        }
        Trigger::SkillUsed { who, skill_id } => {
            if let Some(sid) = skill_id {
                if tctx.skill_id.as_deref() != Some(sid.as_str()) {
                    return None;
                }
            }
            if who_match(state, owner, subj, who) {
                Some(RuleCtx::with_subject(owner, subj))
            } else {
                None
            }
        }
        Trigger::OnMove { who } => {
            if who_match(state, owner, subj, who) {
                Some(RuleCtx::with_subject(owner, subj))
            } else {
                None
            }
        }
        Trigger::EnterCell { row, col } => {
            if subj != Some(owner) {
                return None;
            }
            let p = state.units[owner].pos;
            if row.map(|r| p.row != r).unwrap_or(false) || col.map(|c| p.col != c).unwrap_or(false) {
                return None;
            }
            Some(RuleCtx::of(owner))
        }
        Trigger::OnHit { as_role, crit } => {
            if let Some(c) = crit {
                if tctx.crit != Some(*c) {
                    return None;
                }
            }
            if as_role.as_deref().unwrap_or("attacker") == "attacker" {
                if atk == Some(owner) {
                    Some(RuleCtx::with_subject(owner, subj))
                } else {
                    None
                }
            } else if subj == Some(owner) {
                Some(RuleCtx::with_subject(owner, atk))
            } else {
                None
            }
        }
        Trigger::OnMiss { as_role } => {
            if as_role.as_deref().unwrap_or("attacker") == "attacker" {
                if atk == Some(owner) {
                    Some(RuleCtx::with_subject(owner, subj))
                } else {
                    None
                }
            } else if subj == Some(owner) {
                Some(RuleCtx::with_subject(owner, atk))
            } else {
                None
            }
        }
        Trigger::DealtDamage | Trigger::Kill => {
            if atk == Some(owner) {
                Some(RuleCtx::with_subject(owner, subj))
            } else {
                None
            }
        }
        Trigger::Damaged => {
            if subj == Some(owner) {
                Some(RuleCtx::with_subject(owner, atk))
            } else {
                None
            }
        }
        Trigger::Death { who } => {
            if who_match(state, owner, subj, who) {
                Some(RuleCtx::with_subject(owner, other(owner, atk, subj)))
            } else {
                None
            }
        }
        Trigger::OnHeal { as_role } => {
            if as_role.as_deref().unwrap_or("target") == "healer" {
                if atk == Some(owner) {
                    Some(RuleCtx::with_subject(owner, subj))
                } else {
                    None
                }
            } else if subj == Some(owner) {
                Some(RuleCtx::with_subject(owner, atk))
            } else {
                None
            }
        }
        Trigger::OnShieldGain => {
            if subj == Some(owner) {
                Some(RuleCtx::of(owner))
            } else {
                None
            }
        }
        Trigger::StatusApplied { status_id, as_role } => {
            if let Some(sid) = status_id {
                if tctx.status_id.as_deref() != Some(sid.as_str()) {
                    return None;
                }
            }
            if as_role.as_deref().unwrap_or("target") == "applier" {
                if atk == Some(owner) {
                    Some(RuleCtx::with_subject(owner, subj))
                } else {
                    None
                }
            } else if subj == Some(owner) {
                Some(RuleCtx::with_subject(owner, atk))
            } else {
                None
            }
        }
        Trigger::StatusTick { status_id } => {
            if let Some(sid) = status_id {
                if tctx.status_id.as_deref() != Some(sid.as_str()) {
                    return None;
                }
            }
            if subj == Some(owner) {
                Some(RuleCtx::of(owner))
            } else {
                None
            }
        }
        // speedRoll은 apply_speed_roll_passives가 따로 처리. run 스코프는 전투서 미발동.
        Trigger::SpeedRoll
        | Trigger::NodeEnter { .. }
        | Trigger::NodeClear { .. }
        | Trigger::ActStart
        | Trigger::GoldGain
        | Trigger::PartyHpChange { .. } => None,
    }
}

struct Matched {
    owner: usize,
    pos: usize, // u.rules 내 위치
    rctx: RuleCtx,
    ord: i64,
    owner_uid: String,
    idx: i64,
}

/// 트리거 발화 — 매칭 수집·정렬·조건평가·효과실행. TS fireTrigger.
pub fn fire_trigger(state: &mut GameState, mut tctx: TriggerCtx, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    if state.fire_depth >= MAX_DEPTH {
        return;
    }
    let mut matched: Vec<Matched> = Vec::new();
    for u in 0..state.units.len() {
        let dead_ok = tctx.on == "battleEnd" || (tctx.on == "death" && Some(state.units[u].uid.clone()) == tctx.subject_uid);
        if !state.units[u].alive && !dead_ok {
            continue;
        }
        for pos in 0..state.units[u].rules.len() {
            if state.units[u].rules[pos].rule.when.on() != tctx.on {
                continue;
            }
            let when = state.units[u].rules[pos].rule.when.clone();
            if let Some(mut rctx) = match_rule(state, &tctx, u, &when) {
                rctx.damage = tctx.damage;
                let owner_uid = state.units[u].uid.clone();
                let idx = state.units[u].rules[pos].idx;
                let ord = order_index_of(state, &owner_uid);
                matched.push(Matched { owner: u, pos, rctx, ord, owner_uid, idx });
            }
        }
    }
    if matched.is_empty() {
        return;
    }
    matched.sort_by(|a, b| a.ord.cmp(&b.ord).then_with(|| a.owner_uid.cmp(&b.owner_uid)).then_with(|| a.idx.cmp(&b.idx)));

    state.fire_depth += 1;
    for m in &matched {
        let (over_cap, key, conds, effects): (bool, String, Option<Vec<_>>, Vec<Effect>) = {
            let cr = &state.units[m.owner].rules[m.pos];
            let over_turn = cr.rule.max_per_turn.map(|c| cr.fired_this_turn >= c).unwrap_or(false);
            let over_battle = cr.rule.max_per_battle.map(|c| cr.fired_this_battle >= c).unwrap_or(false);
            (over_turn || over_battle, format!("{}#{}", m.owner_uid, cr.idx), cr.rule.if_conds.clone(), cr.rule.then.clone())
        };
        if over_cap {
            continue;
        }
        if state.fire_active_keys.contains(&key) {
            continue;
        }
        if !eval_conditions(state, &tctx, &m.rctx, &conds) {
            continue;
        }
        state.fire_active_keys.push(key.clone());
        for eff in &effects {
            apply_effect(state, &m.rctx, eff, defs, skills);
        }
        if let Some(p) = state.fire_active_keys.iter().position(|k| k == &key) {
            state.fire_active_keys.remove(p);
        }
        let cr = &mut state.units[m.owner].rules[m.pos];
        cr.fired_this_turn += 1;
        cr.fired_this_battle += 1;
    }
    state.fire_depth -= 1;
    let _ = &mut tctx;
}

/// 소유자 정규 턴 시작: 턴 카운터++ + 턴당 발동 카운터 리셋. TS onUnitTurnStart.
pub fn on_unit_turn_start(state: &mut GameState, unit_idx: usize) {
    let u = &mut state.units[unit_idx];
    u.turn_count += 1;
    for cr in &mut u.rules {
        cr.fired_this_turn = 0;
    }
}

/// speedRoll 트리거 — modSpeedRoll(가산)/rerollSpeed(재굴림). rolls 순서=결정론. TS applySpeedRollPassives.
pub fn apply_speed_roll_passives(state: &mut GameState, rolls: &mut [SpeedRoll]) {
    for r in rolls.iter_mut() {
        let u = match state.units.iter().position(|x| x.uid == r.uid) {
            Some(i) => i,
            None => continue,
        };
        // speedRoll 룰 idx 정렬.
        let mut rule_positions: Vec<usize> = (0..state.units[u].rules.len())
            .filter(|&p| matches!(state.units[u].rules[p].rule.when, Trigger::SpeedRoll))
            .collect();
        rule_positions.sort_by_key(|&p| state.units[u].rules[p].idx);
        let (smin, smax) = (state.units[u].speed_min, state.units[u].speed_max);
        for p in rule_positions {
            let conds = state.units[u].rules[p].rule.if_conds.clone();
            let tctx = TriggerCtx::new("speedRoll");
            if !eval_conditions(state, &tctx, &RuleCtx::of(u), &conds) {
                continue;
            }
            let effects = state.units[u].rules[p].rule.then.clone();
            for eff in &effects {
                match eff {
                    Effect::ModSpeedRoll { delta } => r.roll += delta,
                    Effect::RerollSpeed => r.roll = state.rng.int(smin, smax),
                    _ => {}
                }
            }
        }
        r.speed = (r.roll + r.speed_mod).max(1);
    }
}
