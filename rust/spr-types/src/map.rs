//! 런 맵 타입 (TS `types/map.ts`의 그래프 부분). 레이어/core 본문은 시퀀서 슬라이스(P2-3)서 도입(현재 serde 무시).
use crate::data::Placement;
use serde::Deserialize;

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
}

#[derive(Debug, Clone, Deserialize)]
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
