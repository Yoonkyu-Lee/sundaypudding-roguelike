//! 런 데이터 번들 — 오케스트레이션 전반에 필요한 데이터 맵 묶음(개별 인자 폭발 방지).
//! 1회 로드(JSON 재파싱 회피) 후 run 함수들에 `&RunData`로 전달.
use crate::util::StatusDefs;
use spr_types::ai::AiProfile;
use spr_types::data::{Character, ItemDef, JobDef, Placement};
use spr_types::map::EncounterEvent;
use spr_types::passives::TraitDef;
use spr_types::skills::Skill;
use std::collections::HashMap;

pub struct RunData {
    pub chars: HashMap<String, Character>,
    pub skills: HashMap<String, Skill>,
    pub traits: HashMap<String, TraitDef>,
    pub items: HashMap<String, ItemDef>,
    pub item_pool: Vec<String>,
    pub defs: StatusDefs,
    pub node_rosters: HashMap<String, Vec<Placement>>,
    pub ai_profiles: HashMap<String, AiProfile>,
    pub encounter_events: Vec<EncounterEvent>,
    pub jobs: HashMap<String, JobDef>, // 전직 직업 트리(4.7)
}

impl RunData {
    pub fn load() -> Self {
        RunData {
            chars: spr_data::characters(),
            skills: spr_data::skills(),
            traits: spr_data::traits(),
            items: spr_data::items(),
            item_pool: spr_data::item_pool(),
            defs: spr_data::status_defs(),
            node_rosters: spr_data::node_rosters(),
            ai_profiles: spr_data::ai_profiles(),
            encounter_events: spr_data::encounter_events(),
            jobs: spr_data::jobs(),
        }
    }
}
