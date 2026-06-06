//! 파티원 런 상태 (TS `types/runtime.ts` PartyMemberState/Equipped). 전투 사이 유지(HP·성장·장착).
//! Serialize+Deserialize — 세이브 왕복 대상(run/save).
use crate::data::Pos;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 장착 슬롯별 아이템 id (4.3). 비면 None(직렬화 생략).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Equipped {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weapon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub armor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub held: Option<String>,
}

/// 런 중 파티원 상태(전투 사이 유지: HP·성장).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PartyMemberState {
    #[serde(rename = "charId")]
    pub char_id: String,
    pub pos: Pos,
    pub hp: i64,
    #[serde(rename = "maxHp")]
    pub max_hp: i64,
    #[serde(rename = "skillDmgBonus")]
    pub skill_dmg_bonus: HashMap<String, i64>,
    #[serde(rename = "ownedSkillIds")]
    pub owned_skill_ids: Vec<String>,
    #[serde(rename = "activeSkillIds")]
    pub active_skill_ids: Vec<String>,
    pub equipped: Equipped,
    #[serde(rename = "masteryLevel")]
    pub mastery_level: i64,
}
