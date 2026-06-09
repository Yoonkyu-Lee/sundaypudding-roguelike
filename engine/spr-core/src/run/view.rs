//! 런 관측 (TS `core/run/view.ts`) — RunState → RunView(프론트 맵/파티/보상 뷰). 전투는 run.battle 직접.
use super::data::RunData;
use super::helpers::cur_floor;
use super::jobs::class_options;
use super::types::{RewardOption, RunState, ShopOffer};
use serde::Serialize;
use spr_types::data::Pos;
use spr_types::map::{cmp_ok, MapEdge};

#[derive(Serialize)]
pub struct NodeView {
    pub id: String,
    pub q: i64,
    pub r: i64,
    #[serde(rename = "type")]
    pub node_type: String,
    pub status: String, // current|visited|active|reachable|locked
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Serialize)]
pub struct SkillView {
    pub id: String,
    pub name: String,
    pub tier: i64,
    pub active: bool,
    #[serde(rename = "canUpgrade")]
    pub can_upgrade: bool,
    pub signature: bool,
}

#[derive(Serialize)]
pub struct PartyView {
    pub name: String,
    #[serde(rename = "charId")]
    pub char_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub pos: Pos,
    pub hp: i64,
    #[serde(rename = "maxHp")]
    pub max_hp: i64,
    pub alive: bool,
    pub skills: Vec<SkillView>,
    #[serde(rename = "activeCount")]
    pub active_count: usize,
}

#[derive(Serialize)]
pub struct ChoiceView {
    pub id: String,
    pub label: String,
    /// 자원 게이팅(R1) — 요구 충족 여부. false=프론트 비활성. requires 없으면 true.
    pub available: bool,
    #[serde(rename = "requiresLabel", skip_serializing_if = "Option::is_none")]
    pub requires_label: Option<String>,
}

/// 런 자원 게이지(R1) 뷰 — 골드 옆 게이지. run_def.resources 순서.
#[derive(Serialize)]
pub struct ResourceView {
    pub id: String,
    pub name: String,
    pub value: i64,
    pub min: i64,
    pub max: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Serialize)]
pub struct EncounterView {
    pub id: String,
    pub title: String,
    pub text: String,
    pub choices: Vec<ChoiceView>,
}

/// 전직(4.7) 선택지 — 한 전직 가능 캐릭의 갈래. classChange phase에서만 노출.
#[derive(Serialize)]
pub struct JobOptionView {
    pub id: String,
    pub name: String,
    #[serde(rename = "classReq")]
    pub class_req: i64,
}

#[derive(Serialize)]
pub struct ClassCandidateView {
    #[serde(rename = "charId")]
    pub char_id: String,
    pub name: String,
    #[serde(rename = "jobName", skip_serializing_if = "Option::is_none")]
    pub job_name: Option<String>,
    pub options: Vec<JobOptionView>,
}

#[derive(Serialize)]
pub struct ClassChangeView {
    pub remaining: i64,
    pub candidates: Vec<ClassCandidateView>,
}

#[derive(Serialize)]
pub struct RunView {
    pub phase: String,
    pub floor: usize,
    #[serde(rename = "totalFloors")]
    pub total_floors: usize,
    pub nodes: Vec<NodeView>,
    pub edges: Vec<MapEdge>,
    pub party: Vec<PartyView>,
    pub rewards: Option<Vec<RewardOption>>,
    pub gold: i64,
    pub shop: Option<Vec<ShopOffer>>,
    pub encounter: Option<EncounterView>,
    #[serde(rename = "classChange", skip_serializing_if = "Option::is_none")]
    pub class_change: Option<ClassChangeView>,
    /// 런 자원 게이지(R1) — 비면 생략(자원 없는 런=골든 무변).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub resources: Vec<ResourceView>,
    pub log: Vec<String>,
}

/// RunState → RunView. TS getRunView.
pub fn get_run_view(run: &RunState, d: &RunData) -> RunView {
    let floor = cur_floor(run);
    let nodes = floor
        .nodes
        .iter()
        .map(|n| {
            let status = if run.current_node_id == n.id {
                "current"
            } else if run.reachable.iter().any(|x| x == &n.id) {
                "reachable"
            } else if run.active_node_id.as_deref() == Some(n.id.as_str()) {
                "active"
            } else if run.visited.iter().any(|x| x == &n.id) {
                "visited"
            } else {
                "locked"
            };
            NodeView { id: n.id.clone(), q: n.q, r: n.r, node_type: n.node_type.clone(), status: status.to_string(), label: n.label.clone() }
        })
        .collect();
    let party = run
        .party
        .iter()
        .map(|m| {
            let c = &d.chars[&m.char_id];
            let skills = m
                .owned_skill_ids
                .iter()
                .map(|sid| {
                    let sk = d.skills.get(sid);
                    SkillView {
                        id: sid.clone(),
                        name: sk.map(|s| s.name.clone()).unwrap_or_else(|| sid.clone()),
                        tier: sk.and_then(|s| s.tier).unwrap_or(1),
                        active: m.active_skill_ids.iter().any(|a| a == sid),
                        can_upgrade: sk.map(|s| s.next_tier_id.is_some()).unwrap_or(false),
                        signature: sk.map(|s| s.exclusive_to.is_some()).unwrap_or(false),
                    }
                })
                .collect();
            PartyView {
                name: c.name.clone(),
                char_id: m.char_id.clone(),
                avatar: c.avatar.clone(),
                pos: m.pos,
                hp: m.hp,
                max_hp: m.max_hp,
                alive: m.hp > 0,
                skills,
                active_count: m.active_skill_ids.len(),
            }
        })
        .collect();
    let encounter = if run.phase == "encounter" {
        run.encounter.as_ref().map(|ev| EncounterView {
            id: ev.id.clone(),
            title: ev.title.clone(),
            text: ev.text.clone(),
            choices: ev.choices.iter().map(|c| {
                let (available, requires_label) = match &c.requires {
                    Some(req) => {
                        let v = *run.resources.get(&req.resource_id).unwrap_or(&0);
                        let name = run.run_def.resources.iter().find(|r| r.id == req.resource_id).map(|r| r.name.clone()).unwrap_or_else(|| req.resource_id.clone());
                        let sym = match req.cmp.as_str() { "gte" => "≥", "lte" => "≤", "gt" => ">", "lt" => "<", _ => "=" };
                        (cmp_ok(&req.cmp, v, req.value), Some(format!("{} {} {}", name, sym, req.value)))
                    }
                    None => (true, None),
                };
                ChoiceView { id: c.id.clone(), label: c.label.clone(), available, requires_label }
            }).collect(),
        })
    } else {
        None
    };
    let class_change = if run.phase == "classChange" {
        let candidates: Vec<ClassCandidateView> = run
            .party
            .iter()
            .filter(|m| m.hp > 0)
            .filter_map(|m| {
                let opts = class_options(run, &m.char_id, d);
                if opts.is_empty() {
                    return None;
                }
                let options = opts
                    .iter()
                    .filter_map(|jid| d.jobs.get(jid).map(|j| JobOptionView { id: jid.clone(), name: j.name.clone(), class_req: j.class_req }))
                    .collect();
                Some(ClassCandidateView {
                    char_id: m.char_id.clone(),
                    name: d.chars.get(&m.char_id).map(|c| c.name.clone()).unwrap_or_else(|| m.char_id.clone()),
                    job_name: m.job_id.as_deref().and_then(|id| d.jobs.get(id)).map(|j| j.name.clone()),
                    options,
                })
            })
            .collect();
        Some(ClassChangeView { remaining: run.class_change_remaining.unwrap_or(0), candidates })
    } else {
        None
    };
    let resources: Vec<ResourceView> = run
        .run_def
        .resources
        .iter()
        .map(|rd| ResourceView { id: rd.id.clone(), name: rd.name.clone(), value: *run.resources.get(&rd.id).unwrap_or(&rd.initial), min: rd.min, max: rd.max, icon: rd.icon.clone() })
        .collect();
    let log_tail: Vec<String> = run.log.iter().rev().take(12).rev().cloned().collect();
    RunView {
        phase: run.phase.clone(),
        floor: run.floor + 1,
        total_floors: run.run_def.floors.len(),
        nodes,
        edges: floor.edges.clone(),
        party,
        rewards: run.rewards.clone(),
        gold: run.gold,
        shop: run.shop.clone(),
        encounter,
        class_change,
        resources,
        log: log_tail,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::run::{create_run, RunData};
    use spr_types::canonical::canonical_json;
    use std::collections::HashMap;

    #[test]
    fn get_run_view_parity() {
        let d = RunData::load();
        let rd = spr_data::default_run();
        let r = create_run(42, &rd.roster.clone(), &rd, &HashMap::new(), false, &d.chars);
        let view = get_run_view(&r, &d);
        let reference = include_str!("../../tests/run-view.generated.json").trim_end();
        assert_eq!(canonical_json(&view), reference, "getRunView TS 바이트동일");
    }
}
