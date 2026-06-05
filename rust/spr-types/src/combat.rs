//! 전투 런타임 타입 (TS `types/runtime.ts`). 이벤트는 canonical 직렬화 대상(SERIALIZATION-CONTRACT).
use crate::data::Pos;
use crate::rng::Rng;
use serde::Serialize;
use std::collections::HashMap;

/// 상태이상 인스턴스 (원장 1건).
#[derive(Debug, Clone)]
pub struct StatusInstance {
    pub def_id: String,
    pub stacks: i64,
    pub duration: i64,
    pub source_uid: String,
    pub source_skill_id: Option<String>,
}

/// 전투 중 유닛. (rules/statMods 등은 패시브 슬라이스서 확장)
#[derive(Debug, Clone)]
pub struct Unit {
    pub uid: String,
    pub side: String, // "ally" | "enemy"
    pub char_id: String,
    pub pos: Pos,
    pub hp_max: i64,
    pub hp: i64,
    pub shield: i64,
    pub speed_min: i64,
    pub speed_max: i64,
    pub evasion: i64,
    pub accuracy: i64,
    pub crit_chance: i64,
    pub crit_multiplier: i64,
    pub active_skill_ids: Vec<String>,
    pub cooldowns: HashMap<String, i64>,
    pub statuses: Vec<StatusInstance>,
    pub alive: bool,
    pub stat_mods: HashMap<String, i64>,
    pub turn_count: i64,
    pub equip_dmg_flat: i64,        // 장착 무기 dmgFlat 합(4.3) — computeDamage 합산
    pub equip_shield_gain_add: i64, // 장착 방어구 쉴드획득 보정 합(4.3)
}

pub type TurnKind = &'static str; // "normal" | "interrupt"

#[derive(Debug, Clone, Serialize)]
pub struct QueueEntry {
    pub uid: String,
    pub kind: String,
    pub speed: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpeedRoll {
    pub uid: String,
    #[serde(rename = "speedMin")]
    pub speed_min: i64,
    #[serde(rename = "speedMax")]
    pub speed_max: i64,
    pub roll: i64,
    #[serde(rename = "speedMod")]
    pub speed_mod: i64,
    pub speed: i64,
}

/// 이벤트 로그 (canonical 직렬화 — TS GameEvent). 변종은 포팅 진행하며 추가.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "t")]
pub enum GameEvent {
    #[serde(rename = "roundStart")]
    RoundStart {
        round: i64,
        order: Vec<QueueEntry>,
        rolls: Vec<SpeedRoll>,
    },
    #[serde(rename = "turnStart")]
    TurnStart { uid: String, kind: String },
    #[serde(rename = "damage")]
    Damage {
        #[serde(rename = "targetUid")]
        target_uid: String,
        base: i64,
        #[serde(rename = "final")]
        final_: i64,
        #[serde(rename = "toShield")]
        to_shield: i64,
        #[serde(rename = "toHp")]
        to_hp: i64,
    },
    #[serde(rename = "death")]
    Death { uid: String },
}

pub struct GameState {
    pub rng: Rng,
    pub round: i64,
    pub units: Vec<Unit>,
    pub round_order: Vec<QueueEntry>,
    pub cursor: i64,
    pub current: Option<QueueEntry>,
    pub phase: String, // "inProgress" | "allyWin" | "enemyWin"
    pub log: Vec<GameEvent>,
    // 패시브 재진입 가드(P0-3) — 후속 슬라이스서 사용
    pub fire_depth: i64,
    pub fire_active_keys: Vec<String>,
}
