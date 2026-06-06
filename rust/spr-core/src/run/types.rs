//! 런 도메인 런타임 타입 (TS `core/run/types.ts`). RunState = 전투 위 레이어 상태.
use serde::Serialize;
use spr_types::combat::GameState;
use spr_types::map::{EncounterEvent, RunDef};
use spr_types::party::{PartyMemberState, PendingStatus};
use spr_types::rng::Rng;
use std::collections::HashMap;

/// 보상 선택지(런타임 생성). 판별 `kind`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum RewardOption {
    #[serde(rename = "upgradeSkill")]
    UpgradeSkill { id: String, #[serde(rename = "charId")] char_id: String, #[serde(rename = "fromSkillId")] from_skill_id: String, #[serde(rename = "toSkillId")] to_skill_id: String, label: String },
    #[serde(rename = "learnSkill")]
    LearnSkill { id: String, #[serde(rename = "charId")] char_id: String, #[serde(rename = "skillId")] skill_id: String, label: String },
    #[serde(rename = "item")]
    Item { id: String, #[serde(rename = "itemId")] item_id: String, label: String },
    #[serde(rename = "heal")]
    Heal { id: String, pct: i64, label: String },
}

/// 상점 진열(런타임). 판별 `kind`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum ShopOffer {
    #[serde(rename = "upgrade")]
    Upgrade { id: String, cost: i64, #[serde(rename = "charId")] char_id: String, #[serde(rename = "fromSkillId")] from_skill_id: String, #[serde(rename = "toSkillId")] to_skill_id: String, label: String },
    #[serde(rename = "learn")]
    Learn { id: String, cost: i64, #[serde(rename = "charId")] char_id: String, #[serde(rename = "skillId")] skill_id: String, label: String },
    #[serde(rename = "buyItem")]
    BuyItem { id: String, cost: i64, #[serde(rename = "itemId")] item_id: String, label: String },
    #[serde(rename = "heal")]
    Heal { id: String, cost: i64, pct: i64, label: String },
}

/// 런 상태. battle/rewards/shop/encounter는 진행 중에만 Some. (save 직렬화는 P2-7)
pub struct RunState {
    pub rng: Rng,
    pub seed: u32,
    pub run_def: RunDef,
    pub floor: usize,
    pub use_mastery: bool,
    pub party: Vec<PartyMemberState>,
    pub visited: Vec<String>,
    pub reachable: Vec<String>,
    pub current_node_id: String,
    pub active_node_id: Option<String>,
    pub core_cursor: Option<i64>,
    pub phase: String, // map|battle|reward|shop|encounter|won|lost
    pub battle: Option<GameState>,
    pub rewards: Option<Vec<RewardOption>>,
    pub gold: i64,
    pub inventory: Vec<String>,
    pub shop: Option<Vec<ShopOffer>>,
    pub encounter: Option<EncounterEvent>,
    pub pending_statuses: HashMap<String, Vec<PendingStatus>>,
    pub firing: bool,
    pub log: Vec<String>,
}
