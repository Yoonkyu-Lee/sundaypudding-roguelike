//! 스킬 데이터 타입 (TS `types/content.ts` Skill/SkillEffect/AreaShape). serde — 미사용 필드 무시.
//! passives DSL은 9f 슬라이스서 도입(현재 무시됨).
use crate::data::Pos;
use serde::Deserialize;

/// 스킬 효과 프리미티브(판별자 `kind`). TS SkillEffect.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum SkillEffect {
    #[serde(rename = "damage")]
    Damage { amount: i64 },
    #[serde(rename = "applyStatus")]
    ApplyStatus {
        #[serde(rename = "statusId")]
        status_id: String,
        stacks: i64,
        duration: i64,
    },
    #[serde(rename = "applyStatusSelf")]
    ApplyStatusSelf {
        #[serde(rename = "statusId")]
        status_id: String,
        stacks: i64,
        duration: i64,
    },
    #[serde(rename = "shield")]
    Shield { amount: i64 },
    #[serde(rename = "heal")]
    Heal { amount: i64 },
    #[serde(rename = "cleanse")]
    Cleanse,
    #[serde(rename = "move")]
    Move {
        who: String, // "target" | "self"
        #[serde(rename = "deltaCol")]
        delta_col: i64,
    },
}

/// 면적 모양(판별자 `kind`). single/row/col/square/cross/all(+radius?) / free(+count). TS AreaShape.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum AreaShape {
    #[serde(rename = "single")]
    Single,
    #[serde(rename = "row")]
    Row,
    #[serde(rename = "col")]
    Col,
    #[serde(rename = "square")]
    Square { radius: Option<i64> },
    #[serde(rename = "cross")]
    Cross { radius: Option<i64> },
    #[serde(rename = "all")]
    All,
    #[serde(rename = "free")]
    Free { count: i64 },
}

/// 스킬(2.3~2.10). passives는 9f서. 미해석 필드(tier/nextTierId/exclusiveTo 등)는 무시.
#[derive(Debug, Clone, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub target: String, // "enemy" | "ally" | "self"
    pub cooldown: i64,
    pub accuracy: i64,
    #[serde(rename = "alwaysHit", default)]
    pub always_hit: bool,
    #[serde(rename = "usableFrom")]
    pub usable_from: Option<Vec<Pos>>,
    #[serde(rename = "targetCells")]
    pub target_cells: Option<Vec<Pos>>,
    pub reach: Option<i64>,
    #[serde(rename = "grantsInterrupt")]
    pub grants_interrupt: Option<i64>,
    #[serde(rename = "grantsInterruptTo")]
    pub grants_interrupt_to: Option<String>,
    pub area: Option<AreaShape>,
    pub effects: Vec<SkillEffect>,
    /// 능동기 여부(기본 true). false=순수 패시브.
    #[serde(default = "default_true")]
    pub active: bool,
    /// 출전 시 작동하는 패시브 룰(능동 effects와 공존 가능).
    #[serde(default)]
    pub passives: Option<Vec<crate::passives::PassiveRule>>,
}

fn default_true() -> bool {
    true
}
