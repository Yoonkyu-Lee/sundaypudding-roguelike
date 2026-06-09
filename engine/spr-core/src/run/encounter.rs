//! 인카운터 (TS `core/run/encounter.ts`, 7.2) — 선택지/도박, 생존보장(최소 HP1). RNG 결정론.
use super::data::RunData;
use super::helpers::{complete_node, heal_party, learn_owned, modify_resource, node, upgrade_owned};
use super::layers::advance_core;
use super::passives::{fire_run_trigger, RunTriggerCtx};
use super::rewards::owns_upgrade_line;
use super::types::RunState;
use crate::util::round_div;
use spr_types::map::{cmp_ok, EncounterEvent, EncounterOutcome};

fn apply_outcome(run: &mut RunState, o: &EncounterOutcome, d: &RunData) {
    match o {
        EncounterOutcome::Heal { pct } => {
            heal_party(run, *pct, false, d);
            run.log.push(format!("파티 {}% 회복", pct));
        }
        EncounterOutcome::Hurt { pct } => {
            for m in &mut run.party {
                if m.hp > 0 {
                    m.hp = (m.hp - round_div(m.max_hp * pct, 100)).max(1);
                }
            }
            run.log.push(format!("파티 {}% 피해", pct));
            let mut ctx = RunTriggerCtx::new("partyHpChange");
            ctx.dir = Some("hurt".to_string());
            fire_run_trigger(run, &ctx, d);
        }
        EncounterOutcome::Gold { amount } => {
            run.gold = (run.gold + amount).max(0);
            run.log.push(format!("골드 {}{}", if *amount >= 0 { "+" } else { "" }, amount));
        }
        EncounterOutcome::UpgradeRandom => {
            let cand: Vec<(usize, String, String)> = run
                .party
                .iter()
                .enumerate()
                .filter(|(_, m)| m.hp > 0)
                .flat_map(|(mi, m)| m.owned_skill_ids.iter().filter_map(move |sid| d.skills.get(sid).and_then(|s| s.next_tier_id.clone()).map(|next| (mi, sid.clone(), next))).collect::<Vec<_>>())
                .collect();
            if !cand.is_empty() {
                let pick = run.rng.int(0, cand.len() as i64 - 1) as usize;
                let (mi, sid, next) = cand[pick].clone();
                upgrade_owned(&mut run.party[mi], &sid, &next);
                run.log.push(format!("{} 「{}」 강화!", d.chars[&run.party[mi].char_id].name, d.skills[&sid].name));
            }
        }
        EncounterOutcome::LearnUniversal => {
            let cand: Vec<(usize, String)> = run
                .party
                .iter()
                .enumerate()
                .filter(|(_, m)| m.hp > 0)
                .flat_map(|(mi, m)| {
                    d.chars[&m.char_id]
                        .skill_ids
                        .iter()
                        .filter(|sid| !owns_upgrade_line(&m.owned_skill_ids, sid, &d.skills) && d.skills.get(*sid).and_then(|s| s.exclusive_to.as_ref()).is_none())
                        .map(move |sid| (mi, sid.clone()))
                        .collect::<Vec<_>>()
                })
                .collect();
            if !cand.is_empty() {
                let pick = run.rng.int(0, cand.len() as i64 - 1) as usize;
                let (mi, sid) = cand[pick].clone();
                learn_owned(&mut run.party[mi], &sid);
                run.log.push(format!("{} 「{}」 습득!", d.chars[&run.party[mi].char_id].name, d.skills[&sid].name));
            }
        }
        EncounterOutcome::Resource { id, delta } => modify_resource(run, id, *delta),
        EncounterOutcome::Nothing => {}
    }
}

/// event 레이어 시작 — 인라인 event 우선, 없으면 전역 풀 랜덤. TS registerLayerStarter("event").
pub fn start_encounter_layer(run: &mut RunState, event: Option<EncounterEvent>, d: &RunData) {
    let ev = event.unwrap_or_else(|| {
        let i = run.rng.int(0, d.encounter_events.len() as i64 - 1) as usize;
        d.encounter_events[i].clone()
    });
    run.log.push(format!("인카운터 — {}", ev.title));
    run.encounter = Some(ev);
    run.phase = "encounter".to_string();
}

/// 인카운터 선택. TS chooseEncounterOption.
pub fn choose_encounter_option(run: &mut RunState, choice_id: &str, d: &RunData) {
    if run.phase != "encounter" {
        return;
    }
    let ev = match &run.encounter {
        Some(e) => e.clone(),
        None => return,
    };
    let ch = match ev.choices.iter().find(|c| c.id == choice_id) {
        Some(c) => c.clone(),
        None => return,
    };
    // R1: 자원 게이팅 — 요구 미충족 선택은 무시(방어; 프론트도 비활성).
    if let Some(req) = &ch.requires {
        let val = *run.resources.get(&req.resource_id).unwrap_or(&0);
        if !cmp_ok(&req.cmp, val, req.value) {
            return;
        }
    }
    let mut outcome = ch.result.unwrap_or(EncounterOutcome::Nothing);
    if let Some(g) = &ch.gamble {
        let win = run.rng.chance(g.chance);
        run.log.push(format!("{}: {}", ev.title, if win { "성공!" } else { "실패…" }));
        outcome = if win { g.win.clone() } else { g.lose.clone() };
    }
    apply_outcome(run, &outcome, d);
    run.encounter = None;
    if run.core_cursor.is_some() {
        advance_core(run, d);
    } else if let Some(aid) = run.active_node_id.clone() {
        let _ = node(run, &aid); // 존재 확인(TS completeNode가 조회)
        complete_node(run, &aid, d);
    }
}
