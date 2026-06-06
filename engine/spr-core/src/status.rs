//! 상태이상 적용 + 주기 틱 (TS `combat/status.ts`). 합산은 삽입순서 보존(Vec — BTreeMap 금지, 이벤트 순서).
//! 패시브 훅(statusApplied/onHeal/statusTick) 발화.
use crate::damage::deal_raw_damage;
use crate::passives::{fire_trigger, TriggerCtx};
use crate::util::StatusDefs;
use spr_types::combat::{GameEvent, GameState, StatusInstance};
use spr_types::skills::Skill;
use std::collections::HashMap;

/// 상태 부여 — 인스턴스 push(합치지 않음, 원장) + statusApplied 이벤트 + 패시브 훅. TS applyStatusInstance.
pub fn apply_status_instance(
    state: &mut GameState,
    target_idx: usize,
    source_uid: &str,
    def_id: &str,
    stacks: i64,
    duration: i64,
    source_skill_id: Option<String>,
    defs: &StatusDefs,
    skills: &HashMap<String, Skill>,
) {
    let target_uid = state.units[target_idx].uid.clone();
    state.units[target_idx].statuses.push(StatusInstance {
        def_id: def_id.to_string(),
        stacks,
        duration,
        source_uid: source_uid.to_string(),
        source_skill_id,
    });
    state.log.push(GameEvent::StatusApplied { target_uid: target_uid.clone(), status_id: def_id.to_string(), stacks, duration });
    let mut t = TriggerCtx::new("statusApplied");
    t.subject_uid = Some(target_uid);
    t.attacker_uid = Some(source_uid.to_string());
    t.status_id = Some(def_id.to_string());
    fire_trigger(state, t, defs, skills);
}

fn accumulate(list: &mut Vec<(String, i64)>, def_id: &str, amt: i64) {
    if let Some(e) = list.iter_mut().find(|(d, _)| d == def_id) {
        e.1 += amt;
    } else {
        list.push((def_id.to_string(), amt)); // 삽입순서 보존
    }
}

/// 같은 트리거의 DoT/HoT를 defId별 합산 적용 — 회복 먼저, 그다음 피해. TS tickPeriodic.
pub fn tick_periodic(state: &mut GameState, idx: usize, trigger: &str, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    if !state.units[idx].alive {
        return;
    }
    let mut dmgs: Vec<(String, i64)> = Vec::new();
    let mut heals: Vec<(String, i64)> = Vec::new();
    for s in &state.units[idx].statuses {
        if let Some(def) = defs.get(&s.def_id) {
            if let Some(dot) = &def.dot {
                if dot.trigger == trigger {
                    accumulate(&mut dmgs, &s.def_id, s.stacks * dot.dmg_per_stack);
                }
            }
            if let Some(hot) = &def.hot {
                if hot.trigger == trigger {
                    accumulate(&mut heals, &s.def_id, s.stacks * hot.heal_per_stack);
                }
            }
        }
    }
    // 회복(재생) 먼저
    for (_, amt) in &heals {
        if *amt <= 0 {
            continue;
        }
        let (uid, gained) = {
            let u = &mut state.units[idx];
            let before = u.hp;
            u.hp = (u.hp + amt).min(u.hp_max);
            (u.uid.clone(), u.hp - before)
        };
        state.log.push(GameEvent::Heal { target_uid: uid.clone(), amount: gained });
        let mut t = TriggerCtx::new("onHeal");
        t.subject_uid = Some(uid);
        fire_trigger(state, t, defs, skills);
    }
    // 지속 피해
    for (def_id, dmg) in &dmgs {
        if *dmg <= 0 {
            continue;
        }
        deal_raw_damage(state, idx, *dmg, false, None, None, defs, skills);
        let uid = state.units[idx].uid.clone();
        state.log.push(GameEvent::StatusTick { target_uid: uid.clone(), status_id: def_id.clone(), dmg: *dmg });
        let mut t = TriggerCtx::new("statusTick");
        t.subject_uid = Some(uid);
        t.status_id = Some(def_id.clone());
        fire_trigger(state, t, defs, skills);
        if !state.units[idx].alive {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use spr_types::canonical::canonical_json;

    #[test]
    fn apply_and_tick_parity() {
        let defs = spr_data::status_defs();
        let skills = spr_data::skills();
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();

        // apply: statusApplied 이벤트 + 원장 push
        let mut s = create_battle(3, &enc, &chars);
        let kim = s.units.iter().position(|u| u.uid == "a0_kim").unwrap();
        let base = s.log.len();
        apply_status_instance(&mut s, kim, "a0_kim", "burn", 2, 3, Some("kim_punch".into()), &defs, &skills);
        assert_eq!(
            canonical_json(&s.log[base..]),
            r#"[{"duration":3,"stacks":2,"statusId":"burn","t":"statusApplied","targetUid":"a0_kim"}]"#
        );
        assert_eq!(s.units[kim].statuses.len(), 1);

        // tick turnEnd: regen(1)=heal4 먼저, burn(2)=dmg6 → hp 20→18. 이벤트 heal·damage·statusTick.
        let mut s2 = create_battle(3, &enc, &chars);
        let k2 = s2.units.iter().position(|u| u.uid == "a0_kim").unwrap();
        s2.units[k2].hp = 20;
        s2.units[k2].statuses.push(StatusInstance { def_id: "burn".into(), stacks: 2, duration: 3, source_uid: "x".into(), source_skill_id: None });
        s2.units[k2].statuses.push(StatusInstance { def_id: "regen".into(), stacks: 1, duration: 3, source_uid: "x".into(), source_skill_id: None });
        let b2 = s2.log.len();
        tick_periodic(&mut s2, k2, "turnEnd", &defs, &skills);
        assert_eq!(s2.units[k2].hp, 18);
        assert_eq!(
            canonical_json(&s2.log[b2..]),
            r#"[{"amount":4,"t":"heal","targetUid":"a0_kim"},{"base":6,"final":6,"t":"damage","targetUid":"a0_kim","toHp":6,"toShield":0},{"dmg":6,"statusId":"burn","t":"statusTick","targetUid":"a0_kim"}]"#
        );
    }
}
