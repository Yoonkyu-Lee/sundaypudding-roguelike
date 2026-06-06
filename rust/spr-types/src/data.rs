//! 디자이너 데이터 타입 (TS `types/content.ts`). serde Deserialize — 미사용 필드는 무시(점진 도입).
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 포메이션 = 열별 보너스 총량(인덱스=열). ColumnBonus = {attackPower?,defensePower?} → HashMap. TS FormationLayout.
#[derive(Debug, Clone, Deserialize)]
pub struct FormationLayout {
    pub id: String,
    pub columns: Vec<HashMap<String, i64>>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
pub struct Pos {
    pub row: i64,
    pub col: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Placement {
    #[serde(rename = "charId")]
    pub char_id: String,
    pub pos: Pos,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Encounter {
    pub id: String,
    pub name: String,
    pub allies: Vec<Placement>,
    pub enemies: Vec<Placement>,
    #[serde(default)]
    pub boss: bool,
}

/// 캐릭터 — makeUnit이 쓰는 스탯 + learnset. (name/avatar/playable/traitIds/aiProfileId 등은 후속 슬라이스서 추가)
#[derive(Debug, Clone, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub avatar: Option<String>,
    pub hp: i64,
    #[serde(rename = "speedMin")]
    pub speed_min: i64,
    #[serde(rename = "speedMax")]
    pub speed_max: i64,
    pub evasion: i64,
    pub accuracy: i64,
    #[serde(rename = "critChance")]
    pub crit_chance: i64,
    #[serde(rename = "critMultiplier")]
    pub crit_multiplier: i64,
    #[serde(rename = "skillIds")]
    pub skill_ids: Vec<String>,
    #[serde(rename = "traitIds", default)]
    pub trait_ids: Vec<String>,
    #[serde(rename = "aiProfileId", default)]
    pub ai_profile_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Dot {
    pub trigger: String, // turnStart|turnEnd|onAction
    #[serde(rename = "dmgPerStack")]
    pub dmg_per_stack: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Hot {
    pub trigger: String,
    #[serde(rename = "healPerStack")]
    pub heal_per_stack: i64,
}

/// 상태이상 정의(거동 데이터, TS content.ts StatusDef). 누락 옵셔널은 None/false.
#[derive(Debug, Clone, Deserialize)]
pub struct StatusDef {
    pub id: String,
    pub name: String,
    pub icon: String,
    #[serde(default)]
    pub buff: bool,
    pub dot: Option<Dot>,
    pub hot: Option<Hot>,
    #[serde(rename = "actionDenial", default)]
    pub action_denial: bool,
    #[serde(rename = "damageDealtMult")]
    pub damage_dealt_mult: Option<i64>,
    #[serde(rename = "shieldShred", default)]
    pub shield_shred: bool,
    #[serde(default)]
    pub pierce: bool,
    #[serde(default)]
    pub undying: bool,
    #[serde(rename = "grantsInterrupt", default)]
    pub grants_interrupt: bool,
    #[serde(rename = "dmgDealtFlat")]
    pub dmg_dealt_flat: Option<i64>,
    #[serde(rename = "critChanceAdd")]
    pub crit_chance_add: Option<i64>,
    #[serde(rename = "critMultiplierAdd")]
    pub crit_multiplier_add: Option<i64>,
    #[serde(default)]
    pub invincible: bool,
    #[serde(default)]
    pub taunt: bool,
    #[serde(rename = "speedMod")]
    pub speed_mod: Option<i64>,
}

/// 장착 아이템 스탯 보정(4.3) — 비면 0. HP는 maxHp 재계산(런)서 처리, 여기 stat은 전투 유닛 보정.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ItemMods {
    #[serde(default)]
    pub hp: i64,
    #[serde(default)]
    pub evasion: i64,
    #[serde(default)]
    pub accuracy: i64,
    #[serde(rename = "critChance", default)]
    pub crit_chance: i64,
    #[serde(rename = "critMultiplier", default)]
    pub crit_multiplier: i64,
    #[serde(rename = "speedMin", default)]
    pub speed_min: i64,
    #[serde(rename = "speedMax", default)]
    pub speed_max: i64,
}

/// 장착 아이템(4.3). 무기=dmgFlat, 방어구=shieldGainAdd, mods=스탯 보정.
#[derive(Debug, Clone, Deserialize)]
pub struct ItemDef {
    pub id: String,
    pub name: String,
    pub slot: String, // weapon|armor|held
    #[serde(default)]
    pub mods: Option<ItemMods>,
    #[serde(rename = "dmgFlat", default)]
    pub dmg_flat: i64,
    #[serde(rename = "shieldGainAdd", default)]
    pub shield_gain_add: i64,
}

impl StatusDef {
    /// statusNumSum용 수치 필드 조회(없으면 0).
    pub fn num_field(&self, key: &str) -> i64 {
        match key {
            "dmgDealtFlat" => self.dmg_dealt_flat.unwrap_or(0),
            "critChanceAdd" => self.crit_chance_add.unwrap_or(0),
            "critMultiplierAdd" => self.crit_multiplier_add.unwrap_or(0),
            "speedMod" => self.speed_mod.unwrap_or(0),
            _ => 0,
        }
    }
}
