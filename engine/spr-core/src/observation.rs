//! 관측(Observation) 빌드 — GameState → 직렬화 뷰 (TS `combat/observation.ts`, 8.2). 프론트/AI 공통 진실.
//! 차등(differential) 대상 아님(이벤트 로그가 진실) — 프론트 소비용. 배열 순서 보존(statuses/sources=삽입순서).
use crate::formation::get_formation_bonus;
use crate::targeting::{compute_hit_chance, reachable_columns, valid_targets};
use crate::util::{is_frozen, StatusDefs};
use serde::Serialize;
use spr_types::combat::{Action, GameState, QueueEntry, Unit};
use spr_types::data::{Character, Pos};
use spr_types::skills::Skill;
use std::collections::HashMap;

#[derive(Serialize, Clone)]
pub struct StatusSource {
    pub unit: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub via: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct StatusView {
    pub id: String,
    pub icon: String,
    pub stacks: i64,
    pub duration: i64,
    #[serde(rename = "nextChange")]
    pub next_change: i64,
    pub sources: Vec<StatusSource>,
}

#[derive(Serialize)]
pub struct Formation {
    #[serde(rename = "attackPower")]
    pub attack_power: i64,
    #[serde(rename = "defensePower")]
    pub defense_power: i64,
}

#[derive(Serialize)]
pub struct UnitView {
    pub uid: String,
    pub side: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub pos: Pos,
    pub hp: i64,
    #[serde(rename = "hpMax")]
    pub hp_max: i64,
    pub shield: i64,
    pub alive: bool,
    pub statuses: Vec<StatusView>,
    pub cooldowns: HashMap<String, i64>,
    pub formation: Formation,
}

#[derive(Serialize)]
pub struct CurrentView {
    pub uid: String,
    pub name: String,
    pub side: String,
    pub kind: String,
}

#[derive(Serialize)]
pub struct LegalActionView {
    pub action: Action,
    pub label: String,
    #[serde(rename = "skillName", skip_serializing_if = "Option::is_none")]
    pub skill_name: Option<String>,
    #[serde(rename = "hitChance", skip_serializing_if = "Option::is_none")]
    pub hit_chance: Option<i64>,
    #[serde(rename = "targetUid", skip_serializing_if = "Option::is_none")]
    pub target_uid: Option<String>,
}

#[derive(Serialize)]
pub struct Observation {
    pub round: i64,
    pub phase: String,
    pub current: Option<CurrentView>,
    pub order: Vec<QueueEntry>,
    #[serde(rename = "cursorIndex")]
    pub cursor_index: i64,
    pub allies: Vec<UnitView>,
    pub enemies: Vec<UnitView>,
    #[serde(rename = "legalActions")]
    pub legal_actions: Vec<LegalActionView>,
}

fn name_of(state: &GameState, uid: &str) -> String {
    state.units.iter().find(|x| x.uid == uid).map(|u| u.name.clone()).unwrap_or_else(|| uid.to_string())
}

fn view_statuses(state: &GameState, u: &Unit, defs: &StatusDefs, skills: &HashMap<String, Skill>) -> Vec<StatusView> {
    // 삽입순서 보존(defId 첫 등장 순) — TS Map과 동일.
    let mut acc: Vec<(String, i64, Vec<i64>, Vec<StatusSource>)> = Vec::new();
    for s in &u.statuses {
        let via = s.source_skill_id.as_ref().map(|sid| skills.get(sid).map(|sk| sk.name.clone()).unwrap_or_else(|| sid.clone()));
        let unit = name_of(state, &s.source_uid);
        let entry = match acc.iter_mut().find(|(d, ..)| *d == s.def_id) {
            Some(e) => e,
            None => {
                acc.push((s.def_id.clone(), 0, Vec::new(), Vec::new()));
                acc.last_mut().unwrap()
            }
        };
        entry.1 += s.stacks;
        entry.2.push(s.duration);
        if !entry.3.iter().any(|x| x.unit == unit && x.via == via) {
            entry.3.push(StatusSource { unit, via });
        }
    }
    acc.into_iter()
        .map(|(id, stacks, durs, sources)| StatusView {
            icon: defs.get(&id).map(|d| d.icon.clone()).unwrap_or_default(),
            duration: *durs.iter().max().unwrap(),
            next_change: *durs.iter().min().unwrap(),
            id,
            stacks,
            sources,
        })
        .collect()
}

fn view_unit(state: &GameState, u: &Unit, chars: &HashMap<String, Character>, defs: &StatusDefs, skills: &HashMap<String, Skill>) -> UnitView {
    UnitView {
        uid: u.uid.clone(),
        side: u.side.clone(),
        name: u.name.clone(),
        avatar: chars.get(&u.char_id).and_then(|c| c.avatar.clone()),
        pos: u.pos,
        hp: u.hp,
        hp_max: u.hp_max,
        shield: u.shield,
        alive: u.alive,
        statuses: view_statuses(state, u, defs, skills),
        cooldowns: u.cooldowns.clone(),
        formation: Formation { attack_power: get_formation_bonus(state, u, "attackPower"), defense_power: get_formation_bonus(state, u, "defensePower") },
    }
}

/// 합법 행동 + 라벨(프론트 표시). TS getLegalActions(라벨 포함).
pub fn build_legal_actions(state: &GameState, skills: &HashMap<String, Skill>, defs: &StatusDefs) -> Vec<LegalActionView> {
    let cur = match &state.current {
        Some(c) => c,
        None => return Vec::new(),
    };
    if state.phase != "inProgress" {
        return Vec::new();
    }
    let actor_idx = match state.units.iter().position(|u| u.uid == cur.uid) {
        Some(i) => i,
        None => return Vec::new(),
    };
    let skip = |label: &str| LegalActionView { action: Action::Skip, label: label.to_string(), skill_name: None, hit_chance: None, target_uid: None };
    if is_frozen(&state.units[actor_idx], defs) {
        return vec![skip("스킵 (빙결)")];
    }
    let mut out: Vec<LegalActionView> = Vec::new();
    let actor = &state.units[actor_idx];
    for skill_id in &actor.active_skill_ids {
        let skill = match skills.get(skill_id) {
            Some(s) => s,
            None => continue,
        };
        if !skill.active {
            continue;
        }
        if *actor.cooldowns.get(skill_id).unwrap_or(&0) > 0 {
            continue;
        }
        if let Some(uf) = &skill.usable_from {
            if !uf.is_empty() && !uf.iter().any(|c| c.row == actor.pos.row && c.col == actor.pos.col) {
                continue;
            }
        }
        let _ = reachable_columns; // valid_targets가 reach 처리
        for ti in valid_targets(state, actor_idx, skill) {
            let tname = state.units[ti].name.clone();
            let tuid = state.units[ti].uid.clone();
            out.push(LegalActionView {
                action: Action::Skill { skill_id: skill_id.clone(), target_uid: Some(tuid.clone()), target_cell: None, cells: None },
                label: format!("{} → {}", skill.name, tname),
                skill_name: Some(skill.name.clone()),
                hit_chance: Some(compute_hit_chance(actor, skill, &state.units[ti])),
                target_uid: Some(tuid),
            });
        }
    }
    if out.is_empty() {
        return vec![skip("스킵 (쓸 수 있는 기술 없음)")];
    }
    out.push(skip("대기 (턴 넘김)"));
    out
}

/// 관측 빌드. TS buildObservation.
pub fn build_observation(state: &GameState, chars: &HashMap<String, Character>, skills: &HashMap<String, Skill>, defs: &StatusDefs) -> Observation {
    let current = state.current.as_ref().and_then(|c| {
        state.units.iter().find(|u| u.uid == c.uid).map(|u| CurrentView { uid: c.uid.clone(), name: u.name.clone(), side: u.side.clone(), kind: c.kind.clone() })
    });
    Observation {
        round: state.round,
        phase: state.phase.clone(),
        current,
        order: state.round_order.clone(),
        cursor_index: state.cursor,
        allies: state.units.iter().filter(|u| u.side == "ally").map(|u| view_unit(state, u, chars, defs, skills)).collect(),
        enemies: state.units.iter().filter(|u| u.side == "enemy").map(|u| view_unit(state, u, chars, defs, skills)).collect(),
        legal_actions: build_legal_actions(state, skills, defs),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use spr_types::canonical::canonical_json;

    #[test]
    fn observation_parity_seed42() {
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        let enc = spr_data::demo_encounter();
        let s = create_battle(42, &enc, &chars);
        let obs = build_observation(&s, &chars, &skills, &defs);
        // TS buildObservation(createBattle(42,DEMO)) canonical과 바이트 동일.
        assert_eq!(canonical_json(&obs), TS_OBS_42);
    }

    const TS_OBS_42: &str = r#"{"allies":[{"alive":true,"avatar":"/avatars/kimduhan_youth.webp","cooldowns":{},"formation":{"attackPower":4,"defensePower":0},"hp":46,"hpMax":46,"name":"김두한","pos":{"col":0,"row":1},"shield":0,"side":"ally","statuses":[],"uid":"a0_kim"},{"alive":true,"avatar":"/avatars/shanghai.webp","cooldowns":{},"formation":{"attackPower":4,"defensePower":0},"hp":28,"hpMax":28,"name":"상하이 조","pos":{"col":1,"row":2},"shield":0,"side":"ally","statuses":[],"uid":"a1_shanghai"},{"alive":true,"avatar":"/avatars/cho.webp","cooldowns":{},"formation":{"attackPower":0,"defensePower":4},"hp":34,"hpMax":34,"name":"조병옥","pos":{"col":2,"row":2},"shield":0,"side":"ally","statuses":[],"uid":"a2_cho"}],"current":{"kind":"normal","name":"조병옥","side":"ally","uid":"a2_cho"},"cursorIndex":0,"enemies":[{"alive":true,"avatar":"🧢","cooldowns":{},"formation":{"attackPower":0,"defensePower":0},"hp":14,"hpMax":14,"name":"깡패","pos":{"col":0,"row":1},"shield":0,"side":"enemy","statuses":[],"uid":"e0_thug"},{"alive":true,"avatar":"🧢","cooldowns":{},"formation":{"attackPower":0,"defensePower":0},"hp":14,"hpMax":14,"name":"깡패","pos":{"col":0,"row":2},"shield":0,"side":"enemy","statuses":[],"uid":"e1_thug"},{"alive":true,"avatar":"🪵","cooldowns":{},"formation":{"attackPower":0,"defensePower":0},"hp":18,"hpMax":18,"name":"각목 깡패","pos":{"col":2,"row":1},"shield":0,"side":"enemy","statuses":[],"uid":"e2_thug2"}],"legalActions":[{"action":{"skillId":"cho_warn","targetUid":"e0_thug","type":"skill"},"hitChance":84,"label":"경무부장의 경고 → 깡패","skillName":"경무부장의 경고","targetUid":"e0_thug"},{"action":{"skillId":"cho_warn","targetUid":"e1_thug","type":"skill"},"hitChance":84,"label":"경무부장의 경고 → 깡패","skillName":"경무부장의 경고","targetUid":"e1_thug"},{"action":{"skillId":"cho_warn","targetUid":"e2_thug2","type":"skill"},"hitChance":85,"label":"경무부장의 경고 → 각목 깡패","skillName":"경무부장의 경고","targetUid":"e2_thug2"},{"action":{"skillId":"cho_martial","targetUid":"a0_kim","type":"skill"},"hitChance":100,"label":"비상계엄령 → 김두한","skillName":"비상계엄령","targetUid":"a0_kim"},{"action":{"skillId":"cho_martial","targetUid":"a1_shanghai","type":"skill"},"hitChance":100,"label":"비상계엄령 → 상하이 조","skillName":"비상계엄령","targetUid":"a1_shanghai"},{"action":{"skillId":"cho_martial","targetUid":"a2_cho","type":"skill"},"hitChance":100,"label":"비상계엄령 → 조병옥","skillName":"비상계엄령","targetUid":"a2_cho"},{"action":{"skillId":"cho_police","targetUid":"e0_thug","type":"skill"},"hitChance":79,"label":"경찰 병력 호출 → 깡패","skillName":"경찰 병력 호출","targetUid":"e0_thug"},{"action":{"skillId":"cho_police","targetUid":"e1_thug","type":"skill"},"hitChance":79,"label":"경찰 병력 호출 → 깡패","skillName":"경찰 병력 호출","targetUid":"e1_thug"},{"action":{"skillId":"cho_police","targetUid":"e2_thug2","type":"skill"},"hitChance":80,"label":"경찰 병력 호출 → 각목 깡패","skillName":"경찰 병력 호출","targetUid":"e2_thug2"},{"action":{"skillId":"cho_ult","targetUid":"e0_thug","type":"skill"},"hitChance":84,"label":"당장 그만두시오! → 깡패","skillName":"당장 그만두시오!","targetUid":"e0_thug"},{"action":{"skillId":"cho_ult","targetUid":"e1_thug","type":"skill"},"hitChance":84,"label":"당장 그만두시오! → 깡패","skillName":"당장 그만두시오!","targetUid":"e1_thug"},{"action":{"skillId":"cho_ult","targetUid":"e2_thug2","type":"skill"},"hitChance":85,"label":"당장 그만두시오! → 각목 깡패","skillName":"당장 그만두시오!","targetUid":"e2_thug2"},{"action":{"type":"skip"},"label":"대기 (턴 넘김)"}],"order":[{"kind":"normal","speed":8,"uid":"a2_cho"},{"kind":"normal","speed":7,"uid":"a1_shanghai"},{"kind":"normal","speed":6,"uid":"a0_kim"},{"kind":"normal","speed":5,"uid":"e0_thug"},{"kind":"normal","speed":4,"uid":"e2_thug2"},{"kind":"normal","speed":3,"uid":"e1_thug"}],"phase":"inProgress","round":1}"#;
}
