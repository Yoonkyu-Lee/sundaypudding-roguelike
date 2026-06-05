//! 런 맵 타입 (TS `types/map.ts`의 그래프 부분). serde는 미지 필드(core/layers/label 등) 무시 — 그래프엔 불요.
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
}

#[derive(Debug, Clone, Deserialize)]
pub struct MapEdge {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FloorDef {
    pub id: String,
    #[serde(rename = "entryNodeId")]
    pub entry_node_id: String,
    pub nodes: Vec<MapNode>,
    pub edges: Vec<MapEdge>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunDef {
    pub id: String,
    #[serde(rename = "entryFloorId")]
    pub entry_floor_id: String,
    pub floors: Vec<FloorDef>,
}
