//! 런 맵 타입 (TS `types/map.ts`의 그래프 부분). 레이어/core 본문은 시퀀서 슬라이스(P2-4)서 도입(현재 serde 무시).
use crate::data::Placement;
use crate::passives::PassiveRule;
use serde::Deserialize;

/// 노드 트리거 룰 소유자(화자/기준).
#[derive(Debug, Clone, Deserialize)]
pub struct RuleOwner {
    pub side: String, // ally|enemy
    #[serde(rename = "charId")]
    pub char_id: String,
}

/// 노드 트리거 룰 = PassiveRule + owner. owner의 side+charId 유닛에 주입(self=그 개체). TS NodeRule.
#[derive(Debug, Clone, Deserialize)]
pub struct NodeRule {
    #[serde(flatten)]
    pub rule: PassiveRule,
    #[serde(default)]
    pub owner: Option<RuleOwner>,
}

/// 상점 진열 저작(판별 `kind`). TS ShopOfferDef.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum ShopOfferDef {
    #[serde(rename = "buyItem")]
    BuyItem { #[serde(rename = "itemId")] item_id: String, cost: i64 },
    #[serde(rename = "heal")]
    Heal { pct: i64, cost: i64 },
    #[serde(rename = "learn")]
    Learn { #[serde(rename = "charId")] char_id: String, #[serde(rename = "skillId")] skill_id: String, cost: i64 },
}

/// 노드 레이어(판별 `kind`) — 데코(즉시) + 상호작용(블록). TS Layer.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum Layer {
    // 데코레이터(즉시)
    #[serde(rename = "gold")]
    Gold { amount: i64 },
    #[serde(rename = "heal")]
    Heal { pct: i64, #[serde(default)] revive: Option<bool> },
    #[serde(rename = "grantStatus")]
    GrantStatus { #[serde(rename = "charId", default)] char_id: Option<String>, #[serde(rename = "statusId")] status_id: String, stacks: i64, duration: i64 },
    #[serde(rename = "text")]
    Text { text: String },
    // 상호작용(블록)
    #[serde(rename = "combat")]
    Combat { #[serde(default)] roster: Option<Vec<Placement>>, #[serde(default)] boss: bool, #[serde(default)] rules: Option<Vec<NodeRule>> },
    #[serde(rename = "reward")]
    Reward { #[serde(default)] tier: Option<i64> },
    #[serde(rename = "shop")]
    Shop { #[serde(default)] offers: Option<Vec<ShopOfferDef>>, #[serde(rename = "keepGenerated", default)] keep_generated: Option<bool> },
    #[serde(rename = "event")]
    Event { #[serde(default)] event: Option<EncounterEvent> },
}

/// 노드 부착 레이어 슬롯(onEnter/onResolve=데코). TS NodeLayers.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct NodeLayers {
    #[serde(rename = "onEnter", default)]
    pub on_enter: Option<Vec<Layer>>,
    #[serde(rename = "onResolve", default)]
    pub on_resolve: Option<Vec<Layer>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MapNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String, // start|battle|elite|shop|encounter|rest|boss|clear
    pub q: i64,
    pub r: i64,
    #[serde(rename = "toFloor", default)]
    pub to_floor: Option<String>, // clear 노드의 다음 층(분기). 없으면 승리 클리어
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub layers: Option<NodeLayers>,
    #[serde(default)]
    pub core: Option<Vec<Layer>>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct MapEdge {
    pub from: String,
    pub to: String,
}

/// 인카운터 선택 결과(판별 `kind`). TS EncounterOutcome.
#[derive(Debug, Clone, Deserialize, serde::Serialize)]
#[serde(tag = "kind")]
pub enum EncounterOutcome {
    #[serde(rename = "heal")]
    Heal { pct: i64 },
    #[serde(rename = "hurt")]
    Hurt { pct: i64 },
    #[serde(rename = "gold")]
    Gold { amount: i64 },
    #[serde(rename = "upgradeRandom")]
    UpgradeRandom,
    #[serde(rename = "learnUniversal")]
    LearnUniversal,
    #[serde(rename = "nothing")]
    Nothing,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct Gamble {
    pub chance: i64,
    pub win: EncounterOutcome,
    pub lose: EncounterOutcome,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct EncounterChoice {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<EncounterOutcome>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gamble: Option<Gamble>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct EncounterEvent {
    pub id: String,
    pub title: String,
    pub text: String,
    pub choices: Vec<EncounterChoice>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FloorDef {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(rename = "entryNodeId")]
    pub entry_node_id: String,
    pub nodes: Vec<MapNode>,
    pub edges: Vec<MapEdge>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunDef {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub desc: Option<String>,
    #[serde(rename = "useMastery")]
    pub use_mastery: bool,
    #[serde(rename = "entryFloorId")]
    pub entry_floor_id: String,
    pub roster: Vec<Placement>,
    pub floors: Vec<FloorDef>,
}
