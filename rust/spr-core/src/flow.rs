//! 전투 흐름 오케스트레이터 — 행동 1회 처리(step). TS `combat/flow.ts`.
//! onAction 출혈·beforeAction·스킬해소·끼어들기(정규턴)·턴종료·승패·advance.
use crate::battle::{advance, check_win, on_normal_turn_end};
use crate::interrupt::{insert_interrupts, predict_interrupt_subjects};
use crate::passives::{fire_trigger, TriggerCtx};
use crate::skills::{resolve_anchor_uid, resolve_skill};
use crate::status::tick_periodic;
use crate::targeting::get_legal_actions;
use crate::util::{is_frozen, StatusDefs};
use spr_types::combat::{Action, GameEvent, GameState};
use spr_types::skills::Skill;
use std::collections::HashMap;

/// 행동 1회 처리. 행동벡터 재생의 단위(Rust는 자가생성 안 함). TS step.
pub fn step(state: &mut GameState, action: &Action, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    if state.phase != "inProgress" || state.current.is_none() {
        return;
    }
    let entry = state.current.clone().unwrap();
    let actor_idx = match state.units.iter().position(|u| u.uid == entry.uid) {
        Some(i) => i,
        None => return,
    };

    match action {
        Action::Skip => {
            let reason = if is_frozen(&state.units[actor_idx], defs) {
                "frozen"
            } else if get_legal_actions(state, skills, defs).iter().any(|a| matches!(a, Action::Skill { .. })) {
                "chosen"
            } else {
                "noUsableSkill"
            };
            let uid = state.units[actor_idx].uid.clone();
            state.log.push(GameEvent::Skip { uid, reason: reason.to_string() });
        }
        Action::Skill { skill_id, target_uid, target_cell, cells } => {
            let skill: Skill = skills.get(skill_id).expect("unknown skill").clone();
            let cd = *state.units[actor_idx].cooldowns.get(skill_id).unwrap_or(&0);
            if cd > 0 || is_frozen(&state.units[actor_idx], defs) {
                panic!("illegal action: {} (cooldown/frozen)", skill_id);
            }
            tick_periodic(state, actor_idx, "onAction", defs, skills);
            if state.units[actor_idx].alive {
                let uid = state.units[actor_idx].uid.clone();
                let mut t = TriggerCtx::new("beforeAction");
                t.subject_uid = Some(uid);
                fire_trigger(state, t, defs, skills);
            }
            if state.units[actor_idx].alive {
                state.units[actor_idx].cooldowns.insert(skill_id.clone(), skill.cooldown);
                resolve_skill(state, actor_idx, &skill, target_uid.as_deref(), *target_cell, cells.as_deref(), defs, skills);
                if entry.kind == "normal" {
                    let anchor = resolve_anchor_uid(state, actor_idx, &skill, target_uid.as_deref(), *target_cell, cells.as_deref());
                    let subs = predict_interrupt_subjects(state, actor_idx, Some(&skill), anchor.as_deref(), defs);
                    insert_interrupts(state, &subs);
                }
            }
        }
    }

    if entry.kind == "normal" && state.units[actor_idx].alive {
        on_normal_turn_end(state, actor_idx, defs, skills);
    }
    state.current = None;
    if check_win(state, defs, skills) {
        return;
    }
    advance(state, defs, skills);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use spr_types::canonical::canonical_json;

    /// 풀 differential: TS가 기록한 행동벡터(seed42, first-legal 정책)를 재생 → 전체 이벤트 로그 TS 바이트 동일.
    #[test]
    fn full_battle_differential_seed42() {
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        // TS 기록 행동벡터(scripts로 추출, first-legal). 재생 전용.
        let actions: Vec<Action> = serde_json::from_str(ACTIONS_42).expect("행동벡터 파싱");
        let mut s = create_battle(42, &enc, &chars);
        for a in &actions {
            if s.phase != "inProgress" {
                break;
            }
            step(&mut s, a, &defs, &skills);
        }
        assert_eq!(s.phase, EXPECTED_PHASE_42);
        assert_eq!(canonical_json(&s.log), EXPECTED_LOG_42, "전체 전투 로그 TS 바이트 동일");
    }

    const ACTIONS_42: &str = r#"[{"skillId":"cho_warn","targetUid":"e0_thug","type":"skill"},{"skillId":"sh_pistol","targetUid":"e0_thug","type":"skill"},{"skillId":"kim_punch","targetUid":"e1_thug","type":"skill"},{"skillId":"thug_club","targetUid":"a0_kim","type":"skill"},{"skillId":"sh_pistol","targetUid":"e2_thug2","type":"skill"},{"skillId":"cho_warn","targetUid":"e2_thug2","type":"skill"},{"skillId":"kim_punch","targetUid":"e2_thug2","type":"skill"}]"#;
    const EXPECTED_PHASE_42: &str = "allyWin";
    const EXPECTED_LOG_42: &str = r#"[{"order":[{"kind":"normal","speed":8,"uid":"a2_cho"},{"kind":"normal","speed":7,"uid":"a1_shanghai"},{"kind":"normal","speed":6,"uid":"a0_kim"},{"kind":"normal","speed":5,"uid":"e0_thug"},{"kind":"normal","speed":4,"uid":"e2_thug2"},{"kind":"normal","speed":3,"uid":"e1_thug"}],"rolls":[{"roll":6,"speed":6,"speedMax":7,"speedMin":4,"speedMod":0,"uid":"a0_kim"},{"roll":7,"speed":7,"speedMax":9,"speedMin":6,"speedMod":0,"uid":"a1_shanghai"},{"roll":8,"speed":8,"speedMax":8,"speedMin":5,"speedMod":0,"uid":"a2_cho"},{"roll":5,"speed":5,"speedMax":6,"speedMin":3,"speedMod":0,"uid":"e0_thug"},{"roll":3,"speed":3,"speedMax":6,"speedMin":3,"speedMod":0,"uid":"e1_thug"},{"roll":4,"speed":4,"speedMax":5,"speedMin":2,"speedMod":0,"uid":"e2_thug2"}],"round":1,"t":"roundStart"},{"kind":"normal","t":"turnStart","uid":"a2_cho"},{"skillId":"cho_warn","t":"skillUsed","targetUid":"e0_thug","uid":"a2_cho"},{"chance":84,"crit":false,"t":"hit","targetUid":"e0_thug","uid":"a2_cho"},{"base":3,"final":3,"t":"damage","targetUid":"e0_thug","toHp":3,"toShield":0},{"duration":2,"stacks":1,"statusId":"weaken","t":"statusApplied","targetUid":"e0_thug"},{"kind":"normal","t":"turnStart","uid":"a1_shanghai"},{"skillId":"sh_pistol","t":"skillUsed","targetUid":"e0_thug","uid":"a1_shanghai"},{"chance":89,"crit":false,"t":"hit","targetUid":"e0_thug","uid":"a1_shanghai"},{"base":14,"final":14,"t":"damage","targetUid":"e0_thug","toHp":14,"toShield":0},{"t":"death","uid":"e0_thug"},{"kind":"normal","t":"turnStart","uid":"a0_kim"},{"skillId":"kim_punch","t":"skillUsed","targetUid":"e1_thug","uid":"a0_kim"},{"chance":84,"crit":false,"t":"hit","targetUid":"e1_thug","uid":"a0_kim"},{"base":18,"final":18,"t":"damage","targetUid":"e1_thug","toHp":18,"toShield":0},{"t":"death","uid":"e1_thug"},{"amount":0,"t":"heal","targetUid":"a0_kim"},{"kind":"normal","t":"turnStart","uid":"e2_thug2"},{"skillId":"thug_club","t":"skillUsed","targetUid":"a0_kim","uid":"e2_thug2"},{"chance":77,"crit":false,"t":"hit","targetUid":"a0_kim","uid":"e2_thug2"},{"base":8,"final":8,"t":"damage","targetUid":"a0_kim","toHp":8,"toShield":0},{"order":[{"kind":"normal","speed":8,"uid":"a1_shanghai"},{"kind":"normal","speed":7,"uid":"a2_cho"},{"kind":"normal","speed":4,"uid":"a0_kim"},{"kind":"normal","speed":4,"uid":"e2_thug2"}],"rolls":[{"roll":4,"speed":4,"speedMax":7,"speedMin":4,"speedMod":0,"uid":"a0_kim"},{"roll":8,"speed":8,"speedMax":9,"speedMin":6,"speedMod":0,"uid":"a1_shanghai"},{"roll":7,"speed":7,"speedMax":8,"speedMin":5,"speedMod":0,"uid":"a2_cho"},{"roll":4,"speed":4,"speedMax":5,"speedMin":2,"speedMod":0,"uid":"e2_thug2"}],"round":2,"t":"roundStart"},{"kind":"normal","t":"turnStart","uid":"a1_shanghai"},{"skillId":"sh_pistol","t":"skillUsed","targetUid":"e2_thug2","uid":"a1_shanghai"},{"chance":90,"crit":false,"t":"hit","targetUid":"e2_thug2","uid":"a1_shanghai"},{"base":14,"final":14,"t":"damage","targetUid":"e2_thug2","toHp":14,"toShield":0},{"kind":"normal","t":"turnStart","uid":"a2_cho"},{"skillId":"cho_warn","t":"skillUsed","targetUid":"e2_thug2","uid":"a2_cho"},{"chance":85,"crit":false,"t":"hit","targetUid":"e2_thug2","uid":"a2_cho"},{"base":3,"final":3,"t":"damage","targetUid":"e2_thug2","toHp":3,"toShield":0},{"duration":2,"stacks":1,"statusId":"weaken","t":"statusApplied","targetUid":"e2_thug2"},{"kind":"normal","t":"turnStart","uid":"a0_kim"},{"skillId":"kim_punch","t":"skillUsed","targetUid":"e2_thug2","uid":"a0_kim"},{"chance":85,"crit":true,"t":"hit","targetUid":"e2_thug2","uid":"a0_kim"},{"duration":2,"stacks":1,"statusId":"bleed","t":"statusApplied","targetUid":"e2_thug2"},{"base":29,"final":29,"t":"damage","targetUid":"e2_thug2","toHp":29,"toShield":0},{"t":"death","uid":"e2_thug2"},{"amount":8,"t":"heal","targetUid":"a0_kim"},{"phase":"allyWin","t":"battleEnd"}]"#;
}
