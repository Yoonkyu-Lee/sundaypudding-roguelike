//! 디자이너 데이터 타입 (TS `types/content.ts`). serde Deserialize — 미사용 필드는 무시(점진 도입).
use serde::Deserialize;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
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
}
