//! 파티원 런 상태 (TS `types/runtime.ts` PartyMemberState/Equipped). 전투 사이 유지(HP·성장·장착).
//! Serialize+Deserialize — 세이브 왕복 대상(run/save).
use crate::data::Pos;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 계승 대기 상태(grantRunStatus → 다음 전투 시작 주입). TS pendingStatuses 값.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PendingStatus {
    #[serde(rename = "statusId")]
    pub status_id: String,
    pub stacks: i64,
    pub duration: i64,
}

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
    // ── 전직(4.7) 런 상태 — 런 한정(끝나면 리셋). 세이브 왕복. ──
    /// 현재 직업 id(트리 노드). 런 시작 = Character.rootJobId. 전직 없는 캐릭이면 None.
    #[serde(rename = "jobId", default)]
    pub job_id: Option<String>,
    /// 도달 전직 차수(0=루트). 스킬 보상 게이트(classReq ≤ 이 값)에 사용(S4).
    #[serde(rename = "classTier", default)]
    pub class_tier: i64,
    /// 전직으로 누적 부여된 패시브(TraitDef id). 유닛 빌드 시 traitIds와 함께 적용. 런 한정.
    #[serde(rename = "jobTraitIds", default)]
    pub job_trait_ids: Vec<String>,
}
