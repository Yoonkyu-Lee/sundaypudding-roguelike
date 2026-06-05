//! 끼어들기 (TS `combat/interrupt.ts`, 2.11) — 주체 예측 + 동적 삽입. 스킬 grantsInterrupt + 버프(grantsInterrupt).
use crate::util::StatusDefs;
use spr_types::combat::{GameEvent, GameState, QueueEntry};
use spr_types::skills::Skill;

/// 이 행동이 발생시킬 끼어들기 주체 uid 목록(스킬 + 보유 버프). TS predictInterruptSubjects.
pub fn predict_interrupt_subjects(state: &GameState, actor_idx: usize, skill: Option<&Skill>, target_uid: Option<&str>, defs: &StatusDefs) -> Vec<String> {
    let actor = &state.units[actor_idx];
    let mut subjects: Vec<String> = Vec::new();
    if let Some(sk) = skill {
        if let Some(n) = sk.grants_interrupt {
            let subj = if sk.grants_interrupt_to.as_deref() == Some("target") { target_uid.map(|s| s.to_string()) } else { Some(actor.uid.clone()) };
            if let Some(subj) = subj {
                for _ in 0..n {
                    subjects.push(subj.clone());
                }
            }
        }
    }
    for s in &actor.statuses {
        if s.stacks > 0 && defs.get(&s.def_id).map(|d| d.grants_interrupt).unwrap_or(false) {
            subjects.push(actor.uid.clone());
        }
    }
    subjects
}

/// 끼어들기 칸을 현재 칸 바로 뒤(cursor+1)에 삽입 — subjects 순서 보존(역순 splice) + interrupt 이벤트. TS insertInterrupts.
pub fn insert_interrupts(state: &mut GameState, subjects: &[String]) {
    for i in (0..subjects.len()).rev() {
        let at = (state.cursor + 1) as usize;
        state.round_order.insert(at, QueueEntry { uid: subjects[i].clone(), kind: "interrupt".into(), speed: 0 });
        state.log.push(GameEvent::Interrupt { uid: subjects[i].clone() });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use spr_types::canonical::canonical_json;

    #[test]
    fn insert_interrupts_order_and_events() {
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let mut s = create_battle(42, &enc, &chars);
        // cursor=0(첫 턴 cho). 2주체 삽입 → cursor+1에 [a,b] 순서 보존, interrupt 이벤트 2건.
        let before_len = s.round_order.len();
        let base = s.log.len();
        insert_interrupts(&mut s, &["a0_kim".into(), "a1_shanghai".into()]);
        assert_eq!(s.round_order.len(), before_len + 2);
        assert_eq!(s.round_order[1].uid, "a0_kim");
        assert_eq!(s.round_order[1].kind, "interrupt");
        assert_eq!(s.round_order[2].uid, "a1_shanghai");
        // roundOrder는 subjects 순서[kim,shanghai], 그러나 이벤트는 역순 루프라 [shanghai,kim] (TS 일치).
        assert_eq!(
            canonical_json(&s.log[base..]),
            r#"[{"t":"interrupt","uid":"a1_shanghai"},{"t":"interrupt","uid":"a0_kim"}]"#
        );
    }

    #[test]
    fn predict_from_buff_grants_interrupt() {
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let defs = spr_data::status_defs();
        let mut s = create_battle(42, &enc, &chars);
        let kim = s.units.iter().position(|u| u.uid == "a0_kim").unwrap();
        // grantsInterrupt 버프 보유 → 주체=보유자 1회.
        let gi = defs.values().find(|d| d.grants_interrupt).map(|d| d.id.clone());
        if let Some(gid) = gi {
            s.units[kim].statuses.push(spr_types::combat::StatusInstance { def_id: gid, stacks: 1, duration: 3, source_uid: "x".into(), source_skill_id: None });
            let subs = predict_interrupt_subjects(&s, kim, None, None, &defs);
            assert_eq!(subs, vec!["a0_kim".to_string()]);
        }
    }
}
