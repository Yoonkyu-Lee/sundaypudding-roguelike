//! 효과 적용(then) — 전투 프리미티브 재사용 (TS `passives/effects.ts`). move는 인라인(skills 사이클 회피, 훅 없음).
use super::ctx::RuleCtx;
use crate::damage::{compute_damage, deal_raw_damage};
use crate::interrupt::insert_interrupts;
use crate::skills::resolve_skill;
use crate::status::apply_status_instance;
use crate::targeting::valid_targets;
use crate::util::{has_status, round_div, StatusDefs};
use spr_types::combat::{GameEvent, GameState};
use spr_types::data::Pos;
use spr_types::passives::Effect;
use spr_types::skills::Skill;
use std::collections::HashMap;

/// EffTarget → 대상 인덱스 목록(state.units 순서 보존). random*는 RNG 소비. TS resolveTargets.
fn resolve_targets(state: &mut GameState, rctx: &RuleCtx, t: &str) -> Vec<usize> {
    let owner = rctx.owner;
    let owner_side = state.units[owner].side.clone();
    match t {
        "self" => vec![owner],
        "subject" => rctx.subject.into_iter().collect(),
        "target" => rctx.target.or(rctx.subject).into_iter().collect(),
        "allAllies" => state.units.iter().enumerate().filter(|(_, u)| u.alive && u.side == owner_side).map(|(i, _)| i).collect(),
        "allEnemies" => state.units.iter().enumerate().filter(|(_, u)| u.alive && u.side != owner_side).map(|(i, _)| i).collect(),
        "otherAllies" => state.units.iter().enumerate().filter(|(i, u)| u.alive && u.side == owner_side && *i != owner).map(|(i, _)| i).collect(),
        "otherEnemies" => {
            let subj = rctx.subject;
            state.units.iter().enumerate().filter(|(i, u)| u.alive && u.side != owner_side && Some(*i) != subj).map(|(i, _)| i).collect()
        }
        "randomEnemy" => {
            let e: Vec<usize> = state.units.iter().enumerate().filter(|(_, u)| u.alive && u.side != owner_side).map(|(i, _)| i).collect();
            if e.is_empty() {
                vec![]
            } else {
                vec![e[state.rng.int(0, e.len() as i64 - 1) as usize]]
            }
        }
        "randomAlly" => {
            let a: Vec<usize> = state.units.iter().enumerate().filter(|(_, u)| u.alive && u.side == owner_side).map(|(i, _)| i).collect();
            if a.is_empty() {
                vec![]
            } else {
                vec![a[state.rng.int(0, a.len() as i64 - 1) as usize]]
            }
        }
        _ => vec![],
    }
}

/// 이동(passive 효과 — onMove/enterCell 훅 없음, TS effects.moveUnit).
fn move_unit_silent(state: &mut GameState, unit_idx: usize, delta_col: i64) {
    let (new_col, from, side, uid) = {
        let u = &state.units[unit_idx];
        ((u.pos.col + delta_col).clamp(0, 3), u.pos, u.side.clone(), u.uid.clone())
    };
    if new_col == from.col {
        return;
    }
    let dest = Pos { row: from.row, col: new_col };
    if state.units.iter().enumerate().any(|(i, o)| i != unit_idx && o.alive && o.side == side && o.pos == dest) {
        return;
    }
    state.units[unit_idx].pos = dest;
    state.log.push(GameEvent::Move { uid, from, to: dest });
}

/// 한 효과 적용. modSpeedRoll/rerollSpeed는 speedRoll 전용(여기선 무시). TS applyEffect.
pub fn apply_effect(state: &mut GameState, rctx: &RuleCtx, eff: &Effect, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    let owner = rctx.owner;
    match eff {
        Effect::Damage { amount, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                let (dmg, ignore) = {
                    let o = &state.units[owner];
                    (compute_damage(o, *amount, false, defs), has_status(o, "pierce"))
                };
                let auid = state.units[owner].uid.clone();
                deal_raw_damage(state, tgt, dmg, ignore, Some(&auid), None, defs, skills);
            }
        }
        Effect::Heal { amount, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                if !state.units[tgt].alive {
                    continue;
                }
                let t = &mut state.units[tgt];
                let b = t.hp;
                t.hp = (t.hp + amount).min(t.hp_max);
                let g = t.hp - b;
                let uid = t.uid.clone();
                state.log.push(GameEvent::Heal { target_uid: uid, amount: g });
            }
        }
        Effect::Shield { amount, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                if !state.units[tgt].alive {
                    continue;
                }
                let t = &mut state.units[tgt];
                let amt = amount + t.equip_shield_gain_add;
                t.shield += amt;
                let uid = t.uid.clone();
                state.log.push(GameEvent::ShieldGain { target_uid: uid, amount: amt });
            }
        }
        Effect::ApplyStatus { status_id, stacks, duration, target } => {
            let auid = state.units[owner].uid.clone();
            for tgt in resolve_targets(state, rctx, target) {
                if state.units[tgt].alive {
                    apply_status_instance(state, tgt, &auid, status_id, *stacks, *duration, None, defs, skills);
                }
            }
        }
        Effect::Cleanse { target } => {
            for tgt in resolve_targets(state, rctx, target) {
                let t = &mut state.units[tgt];
                let before = t.statuses.len();
                t.statuses.retain(|s| defs.get(&s.def_id).map(|d| d.buff).unwrap_or(false));
                if t.statuses.len() != before {
                    let uid = t.uid.clone();
                    state.log.push(GameEvent::Cleanse { target_uid: uid });
                }
            }
        }
        Effect::Move { delta_col, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                if state.units[tgt].alive {
                    move_unit_silent(state, tgt, *delta_col);
                }
            }
        }
        Effect::GrantInterrupt { count, target } => {
            let mut subs: Vec<String> = Vec::new();
            for tgt in resolve_targets(state, rctx, target) {
                for _ in 0..*count {
                    subs.push(state.units[tgt].uid.clone());
                }
            }
            insert_interrupts(state, &subs);
        }
        Effect::StatMod { stat, delta, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                *state.units[tgt].stat_mods.entry(stat.clone()).or_insert(0) += delta;
            }
        }
        Effect::ModCooldown { skill_id, delta, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                let ids: Vec<String> = match skill_id {
                    Some(id) => vec![id.clone()],
                    None => state.units[tgt].cooldowns.keys().cloned().collect(),
                };
                for id in ids {
                    let cur = *state.units[tgt].cooldowns.get(&id).unwrap_or(&0);
                    state.units[tgt].cooldowns.insert(id, (cur + delta).max(0));
                }
            }
        }
        Effect::HealByDamage { pct, target } => {
            let amt = round_div(rctx.damage.unwrap_or(0) * pct, 100);
            if amt > 0 {
                for tgt in resolve_targets(state, rctx, target) {
                    if !state.units[tgt].alive {
                        continue;
                    }
                    let t = &mut state.units[tgt];
                    let b = t.hp;
                    t.hp = (t.hp + amt).min(t.hp_max);
                    let g = t.hp - b;
                    let uid = t.uid.clone();
                    state.log.push(GameEvent::Heal { target_uid: uid, amount: g });
                }
            }
        }
        Effect::ReflectByDamage { pct, target } => {
            let amt = round_div(rctx.damage.unwrap_or(0) * pct, 100);
            if amt > 0 {
                let auid = state.units[owner].uid.clone();
                for tgt in resolve_targets(state, rctx, target) {
                    deal_raw_damage(state, tgt, amt, false, Some(&auid), None, defs, skills);
                }
            }
        }
        Effect::RemoveStatus { status_id, target } => {
            for tgt in resolve_targets(state, rctx, target) {
                state.units[tgt].statuses.retain(|s| &s.def_id != status_id);
            }
        }
        Effect::CastSkill { skill_id } => {
            let sk = match skills.get(skill_id) {
                Some(s) => s,
                None => return,
            };
            let has_passives = sk.passives.as_ref().map(|p| !p.is_empty()).unwrap_or(false);
            if has_passives || !state.units[owner].alive {
                return; // leaf 스킬만(재귀 방지) · 죽은 시전자 무시
            }
            let sk = sk.clone();
            let sel: Option<String> = if sk.target == "self" {
                Some(state.units[owner].uid.clone())
            } else {
                let ts = valid_targets(state, owner, &sk);
                ts.first().map(|&i| state.units[i].uid.clone())
            };
            if let Some(tu) = sel {
                resolve_skill(state, owner, &sk, Some(&tu), None, None, defs, skills);
            }
        }
        Effect::ShowDialog { speaker, text } => {
            state.log.push(GameEvent::Dialog { speaker: speaker.clone(), text: text.clone() });
        }
        Effect::ModSpeedRoll { .. } | Effect::RerollSpeed => {} // speedRoll 트리거서 처리
        Effect::GoldDelta { .. } | Effect::HealParty { .. } | Effect::GrantRunStatus { .. } => {} // 모험 스코프
    }
}
