//! 스킬 해소 + 효과 디스패치 (TS `combat/skills.ts`, 2.5~3.9). 자기효과 1회 / 대상별 효과 / 동적 재배치.
//! 패시브 훅(skillUsed/onHit/onMiss/onHeal/onShieldGain/onMove/enterCell) 발화.
use crate::damage::{compute_damage, deal_raw_damage};
use crate::formation::get_formation_bonus;
use crate::passives::{fire_trigger, TriggerCtx};
use crate::status::apply_status_instance;
use crate::targeting::{area_targets, compute_hit_chance};
use crate::util::{crit_pct_of, has_status, StatusDefs};
use spr_types::combat::{GameEvent, GameState};
use spr_types::data::Pos;
use spr_types::skills::{Skill, SkillEffect};
use std::collections::HashMap;

fn idx_of_uid(state: &GameState, uid: &str) -> usize {
    state.units.iter().position(|u| u.uid == uid).expect("unit not found")
}

/// 동적 재배치(6.4): deltaCol만큼 이동(0~3 클램프), 같은 편 점유 칸이면 취소. onMove/enterCell 발화.
fn move_unit(state: &mut GameState, unit_idx: usize, delta_col: i64, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    let (new_col, from, side, uid) = {
        let u = &state.units[unit_idx];
        ((u.pos.col + delta_col).clamp(0, 3), u.pos, u.side.clone(), u.uid.clone())
    };
    if new_col == from.col {
        return;
    }
    let dest = Pos { row: from.row, col: new_col };
    let blocked = state.units.iter().enumerate().any(|(i, o)| i != unit_idx && o.alive && o.side == side && o.pos == dest);
    if blocked {
        return;
    }
    state.units[unit_idx].pos = dest;
    state.log.push(GameEvent::Move { uid: uid.clone(), from, to: dest });
    let mut t1 = TriggerCtx::new("onMove");
    t1.subject_uid = Some(uid.clone());
    fire_trigger(state, t1, defs, skills);
    let mut t2 = TriggerCtx::new("enterCell");
    t2.subject_uid = Some(uid);
    t2.cell = Some(dest);
    fire_trigger(state, t2, defs, skills);
}

/// 시전자 자기효과 1회: applyStatusSelf, move(self).
fn apply_self_effects(state: &mut GameState, actor_idx: usize, skill: &Skill, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    for eff in &skill.effects {
        match eff {
            SkillEffect::ApplyStatusSelf { status_id, stacks, duration } if state.units[actor_idx].alive => {
                let uid = state.units[actor_idx].uid.clone();
                apply_status_instance(state, actor_idx, &uid, status_id, *stacks, *duration, Some(skill.id.clone()), defs, skills);
            }
            SkillEffect::Move { who, delta_col } if who == "self" && state.units[actor_idx].alive => {
                move_unit(state, actor_idx, *delta_col, defs, skills);
            }
            _ => {}
        }
    }
}

/// 대상별 효과(광역=타겟마다). self 전용 효과는 건너뜀(apply_self_effects 처리).
fn apply_target_effects(state: &mut GameState, actor_idx: usize, skill: &Skill, target_idx: usize, crit: bool, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    for eff in &skill.effects {
        match eff {
            SkillEffect::Damage { amount } => {
                let (final_dmg, ignore_shield) = {
                    let actor = &state.units[actor_idx];
                    let atk = get_formation_bonus(state, actor, "attackPower");
                    let up = *actor.skill_dmg_bonus.get(&skill.id).unwrap_or(&0);
                    (compute_damage(actor, amount + atk + up, crit, defs), has_status(actor, "pierce"))
                };
                let auid = state.units[actor_idx].uid.clone();
                deal_raw_damage(state, target_idx, final_dmg, ignore_shield, Some(&auid), Some(crit), defs, skills);
            }
            SkillEffect::ApplyStatus { status_id, stacks, duration } => {
                if state.units[target_idx].alive {
                    let auid = state.units[actor_idx].uid.clone();
                    apply_status_instance(state, target_idx, &auid, status_id, *stacks, *duration, Some(skill.id.clone()), defs, skills);
                }
            }
            SkillEffect::Cleanse => {
                let t = &mut state.units[target_idx];
                let before = t.statuses.len();
                t.statuses.retain(|s| defs.get(&s.def_id).map(|d| d.buff).unwrap_or(false));
                if t.statuses.len() != before {
                    let uid = t.uid.clone();
                    state.log.push(GameEvent::Cleanse { target_uid: uid });
                }
            }
            SkillEffect::Shield { amount } => {
                let amt = {
                    let actor = &state.units[actor_idx];
                    let def = get_formation_bonus(state, actor, "defensePower");
                    amount + def + state.units[target_idx].equip_shield_gain_add
                };
                let uid = {
                    let t = &mut state.units[target_idx];
                    t.shield += amt;
                    t.uid.clone()
                };
                state.log.push(GameEvent::ShieldGain { target_uid: uid.clone(), amount: amt });
                let mut tg = TriggerCtx::new("onShieldGain");
                tg.subject_uid = Some(uid);
                tg.attacker_uid = Some(state.units[actor_idx].uid.clone());
                fire_trigger(state, tg, defs, skills);
            }
            SkillEffect::Heal { amount } => {
                let add = {
                    let actor = &state.units[actor_idx];
                    get_formation_bonus(state, actor, "defensePower")
                };
                let (uid, gained) = {
                    let t = &mut state.units[target_idx];
                    let before = t.hp;
                    t.hp = (t.hp + amount + add).min(t.hp_max);
                    (t.uid.clone(), t.hp - before)
                };
                state.log.push(GameEvent::Heal { target_uid: uid.clone(), amount: gained });
                let mut tg = TriggerCtx::new("onHeal");
                tg.subject_uid = Some(uid);
                tg.attacker_uid = Some(state.units[actor_idx].uid.clone());
                fire_trigger(state, tg, defs, skills);
            }
            SkillEffect::Move { who, delta_col } => {
                if who == "target" && state.units[target_idx].alive {
                    move_unit(state, target_idx, *delta_col, defs, skills);
                }
            }
            SkillEffect::ApplyStatusSelf { .. } => {} // apply_self_effects가 처리
        }
    }
}

/// 스킬 해소 진입점. TS resolveSkill. sel = (target_uid, target_cell, cells).
pub fn resolve_skill(
    state: &mut GameState,
    actor_idx: usize,
    skill: &Skill,
    target_uid: Option<&str>,
    target_cell: Option<Pos>,
    cells: Option<&[Pos]>,
    defs: &StatusDefs,
    skills: &HashMap<String, Skill>,
) {
    let actor_uid = state.units[actor_idx].uid.clone();
    state.log.push(GameEvent::SkillUsed {
        uid: actor_uid.clone(),
        skill_id: skill.id.clone(),
        target_uid: target_uid.map(|s| s.to_string()),
    });
    let mut t = TriggerCtx::new("skillUsed");
    t.subject_uid = Some(actor_uid.clone());
    t.skill_id = Some(skill.id.clone());
    fire_trigger(state, t, defs, skills);

    apply_self_effects(state, actor_idx, skill, defs, skills);

    // 앵커 칸: 명시 칸 > 대상 유닛 위치 > 시전자 위치
    let anchor = if let Some(tc) = target_cell {
        tc
    } else if let Some(tu) = target_uid {
        state.units[idx_of_uid(state, tu)].pos
    } else {
        state.units[actor_idx].pos
    };
    let free_cells: Vec<Pos> = cells.map(|c| c.to_vec()).unwrap_or_default();
    let targets = area_targets(state, actor_idx, skill, anchor, &free_cells);

    for target_idx in targets {
        if !state.units[target_idx].alive {
            continue;
        }
        if skill.target == "enemy" {
            let chance = compute_hit_chance(&state.units[actor_idx], skill, &state.units[target_idx]);
            let tuid = state.units[target_idx].uid.clone();
            if !skill.always_hit && !state.rng.chance(chance) {
                state.log.push(GameEvent::Miss { uid: actor_uid.clone(), target_uid: tuid.clone(), chance });
                let mut tm = TriggerCtx::new("onMiss");
                tm.attacker_uid = Some(actor_uid.clone());
                tm.subject_uid = Some(tuid);
                fire_trigger(state, tm, defs, skills);
                continue;
            }
            let crit = state.rng.chance(crit_pct_of(&state.units[actor_idx], defs));
            state.log.push(GameEvent::Hit { uid: actor_uid.clone(), target_uid: tuid.clone(), chance, crit });
            let mut th = TriggerCtx::new("onHit");
            th.attacker_uid = Some(actor_uid.clone());
            th.subject_uid = Some(tuid);
            th.crit = Some(crit);
            fire_trigger(state, th, defs, skills);
            apply_target_effects(state, actor_idx, skill, target_idx, crit, defs, skills);
        } else {
            apply_target_effects(state, actor_idx, skill, target_idx, false, defs, skills);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use spr_types::canonical::canonical_json;
    use spr_types::data::{Encounter, Placement};

    // 패시브-프리 시나리오: thug(무특성/무패시브) vs thug → fire_trigger no-op이 TS와 바이트 동일.
    // 효과 다양성(applyStatus/shield/heal/cleanse/move)·패시브 발화는 9h 풀 differential서 검증.
    fn thug_duel() -> Encounter {
        Encounter {
            id: "t".into(),
            name: "t".into(),
            allies: vec![Placement { char_id: "thug".into(), pos: Pos { row: 0, col: 0 } }],
            enemies: vec![Placement { char_id: "thug".into(), pos: Pos { row: 0, col: 0 } }],
            boss: false,
        }
    }

    fn run(seed: u32) -> String {
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        let mut s = create_battle(seed, &thug_duel(), &chars);
        let a = s.units.iter().position(|u| u.uid == "a0_thug").unwrap();
        let base = s.log.len();
        resolve_skill(&mut s, a, &skills["thug_punch"], Some("e0_thug"), None, None, &defs, &skills);
        canonical_json(&s.log[base..])
    }

    #[test]
    fn resolve_skill_hit_parity() {
        // seed1: 명중 비크리. base 6 + 포메이션 atk4(단독 col0) = 10. RNG 2소비(명중·크리).
        assert_eq!(
            run(1),
            r#"[{"skillId":"thug_punch","t":"skillUsed","targetUid":"e0_thug","uid":"a0_thug"},{"chance":79,"crit":false,"t":"hit","targetUid":"e0_thug","uid":"a0_thug"},{"base":10,"final":10,"t":"damage","targetUid":"e0_thug","toHp":10,"toShield":0}]"#
        );
    }

    #[test]
    fn resolve_skill_with_passives_parity() {
        // 9f 엔드투엔드: 김두한(bloodlust/warspirit 특성 + kim_punch 패시브)이 잡몹 타격 →
        // 스킬효과(applyStatus bleed) + 패시브(흡혈 heal) 발화. seed7=크리. TS 전체 로그 바이트 동일.
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        let mut s = create_battle(7, &enc, &chars);
        let kim = s.units.iter().position(|u| u.uid == "a0_kim").unwrap();
        let base = s.log.len();
        resolve_skill(&mut s, kim, &skills["kim_punch"], Some("e0_thug"), None, None, &defs, &skills);
        assert_eq!(
            canonical_json(&s.log[base..]),
            r#"[{"skillId":"kim_punch","t":"skillUsed","targetUid":"e0_thug","uid":"a0_kim"},{"chance":84,"crit":true,"t":"hit","targetUid":"e0_thug","uid":"a0_kim"},{"duration":2,"stacks":1,"statusId":"bleed","t":"statusApplied","targetUid":"e0_thug"},{"base":29,"final":29,"t":"damage","targetUid":"e0_thug","toHp":29,"toShield":0},{"t":"death","uid":"e0_thug"},{"amount":0,"t":"heal","targetUid":"a0_kim"}]"#
        );
    }

    #[test]
    fn resolve_skill_miss_parity() {
        // seed7: 빗나감 → miss 이벤트만(RNG 1소비). hit 분기 RNG 순서 일치 확인.
        assert_eq!(
            run(7),
            r#"[{"skillId":"thug_punch","t":"skillUsed","targetUid":"e0_thug","uid":"a0_thug"},{"chance":79,"t":"miss","targetUid":"e0_thug","uid":"a0_thug"}]"#
        );
    }
}
