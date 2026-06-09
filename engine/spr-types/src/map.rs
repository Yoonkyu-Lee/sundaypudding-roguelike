//! 런 맵 타입 (TS `types/map.ts`의 그래프 부분). 레이어/core 본문은 시퀀서 슬라이스(P2-4)서 도입(현재 serde 무시).
use crate::data::Placement;
use crate::passives::PassiveRule;
use serde::{Deserialize, Serialize};

/// 노드 트리거 룰 소유자(화자/기준).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RuleOwner {
    pub side: String, // ally|enemy
    #[serde(rename = "charId")]
    pub char_id: String,
}

/// 노드 트리거 룰 = PassiveRule + owner. owner의 side+charId 유닛에 주입(self=그 개체). TS NodeRule.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NodeRule {
    #[serde(flatten)]
    pub rule: PassiveRule,
    #[serde(default)]
    pub owner: Option<RuleOwner>,
}

/// 상점 진열 저작(판별 `kind`). TS ShopOfferDef.
#[derive(Debug, Clone, Deserialize, Serialize)]
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
#[derive(Debug, Clone, Deserialize, Serialize)]
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
    /// 파티 변동(즉시) — 런 중 합류/이탈(스토리). add=charId 신규 합류(루트 직업·숙련0·빈 슬롯 배치), remove=charId 이탈.
    #[serde(rename = "partyChange")]
    PartyChange {
        #[serde(default)]
        add: Option<Vec<String>>,
        #[serde(default)]
        remove: Option<Vec<String>>,
    },
    // 상호작용(블록)
    #[serde(rename = "combat")]
    Combat {
        #[serde(default)] roster: Option<Vec<Placement>>,
        #[serde(default)] boss: bool,
        #[serde(default)] rules: Option<Vec<NodeRule>>,
        /// 자원 게이지 조건부 전투 시작 모디파이어(R1) — 충족 시 side 전원에 상태 주입(민심高→아군 버프 / 심리전→적 fear).
        #[serde(rename = "resourceMods", default)] resource_mods: Option<Vec<ResourceMod>>,
    },
    #[serde(rename = "reward")]
    Reward { #[serde(default)] tier: Option<i64> },
    #[serde(rename = "shop")]
    Shop { #[serde(default)] offers: Option<Vec<ShopOfferDef>>, #[serde(rename = "keepGenerated", default)] keep_generated: Option<bool> },
    #[serde(rename = "event")]
    Event { #[serde(default)] event: Option<EncounterEvent> },
    /// 전직(4.7) 상호작용 레이어 — 전직 가능 파티원 중 최대 `max`명 전직. 전직노드(2~3)·쉼터(1) 작곡용.
    #[serde(rename = "classChange")]
    ClassChange {
        #[serde(default = "default_one")]
        max: i64,
    },
    /// 런 자원 변경(R1, 즉시) — id 자원을 delta만큼 가감(min/max 클램프). event 선택지·노드 onResolve용.
    #[serde(rename = "resource")]
    Resource {
        id: String,
        delta: i64,
    },
}

/// 런 자원 정의(R1) — 민심·명예·토사구팽 등 런-영속 명명 자원. RunDef.resources.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ResourceDef {
    pub id: String,
    pub name: String,
    pub min: i64,
    pub max: i64,
    pub initial: i64,
    #[serde(default)]
    pub icon: Option<String>,
}

/// 자원 임계 비교(R1) — resourceMods·EncounterChoice.requires 공용. cmp = gte|lte|gt|lt|eq.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ResourceReq {
    #[serde(rename = "resourceId")]
    pub resource_id: String,
    pub cmp: String,
    pub value: i64,
}

/// 전투 시작 자원 모디파이어(R1) — 자원이 임계를 충족하면 side 전원에 상태 주입.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ResourceMod {
    #[serde(rename = "resourceId")]
    pub resource_id: String,
    pub cmp: String,
    pub value: i64,
    pub side: String, // ally|enemy
    #[serde(rename = "statusId")]
    pub status_id: String,
    pub stacks: i64,
    pub duration: i64,
}

/// cmp 평가(R1 공용) — gte|lte|gt|lt|eq.
pub fn cmp_ok(cmp: &str, lhs: i64, rhs: i64) -> bool {
    match cmp {
        "gte" => lhs >= rhs,
        "lte" => lhs <= rhs,
        "gt" => lhs > rhs,
        "lt" => lhs < rhs,
        "eq" => lhs == rhs,
        _ => false,
    }
}

fn default_one() -> i64 {
    1
}

/// 노드 부착 레이어 슬롯(onEnter/onResolve=데코). TS NodeLayers.
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct NodeLayers {
    #[serde(rename = "onEnter", default)]
    pub on_enter: Option<Vec<Layer>>,
    #[serde(rename = "onResolve", default)]
    pub on_resolve: Option<Vec<Layer>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
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
    /// 런 자원 가감(R1) — id 자원 delta.
    #[serde(rename = "resource")]
    Resource { id: String, delta: i64 },
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
    /// 자원 게이팅(R1) — 충족해야 선택 가능(예: 민심 gte 60). 미충족=비활성.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires: Option<ResourceReq>,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct EncounterEvent {
    pub id: String,
    pub title: String,
    pub text: String,
    pub choices: Vec<EncounterChoice>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FloorDef {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(rename = "entryNodeId")]
    pub entry_node_id: String,
    pub nodes: Vec<MapNode>,
    pub edges: Vec<MapEdge>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RunDef {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub desc: Option<String>,
    /// 모드(8.8): campaign 등. 셸이 분류·노출. 엔진 미해석(전체 선언 규약).
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(rename = "useMastery")]
    pub use_mastery: bool,
    #[serde(rename = "entryFloorId")]
    pub entry_floor_id: String,
    pub roster: Vec<Placement>,
    pub floors: Vec<FloorDef>,
    /// 런 자원 게이지(R1) — 민심·명예 등 런-영속 자원 정의. 미지정=자원 없는 런.
    #[serde(default)]
    pub resources: Vec<ResourceDef>,
}
