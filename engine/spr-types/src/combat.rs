//! 전투 런타임 타입 (TS `types/runtime.ts`). 이벤트는 canonical 직렬화 대상(SERIALIZATION-CONTRACT).
use crate::data::Pos;
use crate::rng::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 컴파일된 패시브 룰 — 발동 카운터 포함(턴/전투당 캡). TS CompiledRule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledRule {
    pub rule: crate::passives::PassiveRule,
    pub via_kind: String, // "skill" | "trait" | "node"
    pub via_id: String,
    pub idx: i64,
    pub fired_this_turn: i64,
    pub fired_this_battle: i64,
}

/// 상태이상 인스턴스 (원장 1건).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusInstance {
    pub def_id: String,
    pub stacks: i64,
    pub duration: i64,
    pub source_uid: String,
    pub source_skill_id: Option<String>,
}

/// 전투 중 유닛. (rules/statMods 등은 패시브 슬라이스서 확장)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unit {
    pub uid: String,
    pub side: String, // "ally" | "enemy"
    pub char_id: String,
    pub name: String,
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
    pub skill_dmg_bonus: HashMap<String, i64>, // 스킬별 데미지 보너스(런 성장, 4.6)
    pub rules: Vec<CompiledRule>,   // 컴파일된 패시브(스킬 passives + 특성 + 노드)
    pub ai_profile_id: Option<String>, // 적/자동플레이 행동결정 정책(data/ai)
    pub equip_dmg_flat: i64,        // 장착 무기 dmgFlat 합(4.3) — computeDamage 합산
    pub equip_shield_gain_add: i64, // 장착 방어구 쉴드획득 보정 합(4.3)
    /// 소환수(R2) 여부 — 만료 시 소멸. 기본 false면 직렬화 생략(골든 무변).
    #[serde(default, skip_serializing_if = "is_false")]
    pub summoned: bool,
    /// 소환 만료 라운드(R2) — round > expires_round면 라운드 시작 시 소멸. 기본 0면 직렬화 생략.
    #[serde(rename = "expiresRound", default, skip_serializing_if = "is_zero_i64")]
    pub expires_round: i64,
}

fn is_false(b: &bool) -> bool { !*b }
fn is_zero_i64(n: &i64) -> bool { *n == 0 }

pub type TurnKind = &'static str; // "normal" | "interrupt"

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueEntry {
    pub uid: String,
    pub kind: String,
    pub speed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// 플레이어/AI 행동(런타임 입력 — step이 소비). 행동벡터로 기록·재생(TS Action).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Action {
    #[serde(rename = "skill")]
    Skill {
        #[serde(rename = "skillId")]
        skill_id: String,
        #[serde(rename = "targetUid", skip_serializing_if = "Option::is_none", default)]
        target_uid: Option<String>,
        #[serde(rename = "targetCell", skip_serializing_if = "Option::is_none", default)]
        target_cell: Option<Pos>,
        #[serde(skip_serializing_if = "Option::is_none", default)]
        cells: Option<Vec<Pos>>,
    },
    #[serde(rename = "skip")]
    Skip,
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
    #[serde(rename = "statusApplied")]
    StatusApplied {
        #[serde(rename = "targetUid")]
        target_uid: String,
        #[serde(rename = "statusId")]
        status_id: String,
        stacks: i64,
        duration: i64,
    },
    #[serde(rename = "heal")]
    Heal {
        #[serde(rename = "targetUid")]
        target_uid: String,
        amount: i64,
    },
    #[serde(rename = "statusTick")]
    StatusTick {
        #[serde(rename = "targetUid")]
        target_uid: String,
        #[serde(rename = "statusId")]
        status_id: String,
        dmg: i64,
    },
    #[serde(rename = "skillUsed")]
    SkillUsed {
        uid: String,
        #[serde(rename = "skillId")]
        skill_id: String,
        #[serde(rename = "targetUid", skip_serializing_if = "Option::is_none")]
        target_uid: Option<String>,
    },
    #[serde(rename = "move")]
    Move { uid: String, from: Pos, to: Pos },
    #[serde(rename = "cleanse")]
    Cleanse {
        #[serde(rename = "targetUid")]
        target_uid: String,
    },
    #[serde(rename = "shieldGain")]
    ShieldGain {
        #[serde(rename = "targetUid")]
        target_uid: String,
        amount: i64,
    },
    #[serde(rename = "miss")]
    Miss {
        uid: String,
        #[serde(rename = "targetUid")]
        target_uid: String,
        chance: i64,
    },
    #[serde(rename = "hit")]
    Hit {
        uid: String,
        #[serde(rename = "targetUid")]
        target_uid: String,
        chance: i64,
        crit: bool,
    },
    #[serde(rename = "interrupt")]
    Interrupt { uid: String },
    #[serde(rename = "dialog")]
    Dialog {
        #[serde(skip_serializing_if = "Option::is_none")]
        speaker: Option<String>,
        text: String,
    },
    #[serde(rename = "battleEnd")]
    BattleEnd { phase: String },
    #[serde(rename = "skip")]
    Skip { uid: String, reason: String },
    /// 소환(R2) — 임시 아군 유닛 생성.
    #[serde(rename = "summon")]
    Summon {
        uid: String,
        #[serde(rename = "charId")]
        char_id: String,
    },
}

/// 전투 상태. 세이브 직렬화 대상 — `log`은 append-only(프로덕션 로직 미참조)라 skip(GameEvent serde 트리 회피, 복원 시 빈 벡터).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub rng: Rng,
    pub round: i64,
    pub units: Vec<Unit>,
    pub round_order: Vec<QueueEntry>,
    pub cursor: i64,
    pub current: Option<QueueEntry>,
    pub phase: String, // "inProgress" | "allyWin" | "enemyWin"
    #[serde(skip)]
    pub log: Vec<GameEvent>,
    pub ally_formation: Option<crate::data::FormationLayout>,
    pub enemy_formation: Option<crate::data::FormationLayout>,
    // 패시브 재진입 가드(P0-3) — 후속 슬라이스서 사용
    pub fire_depth: i64,
    pub fire_active_keys: Vec<String>,
    /// 소환 템플릿(R2) — charId→사전빌드 Unit. 전투 생성 시 아군 스킬의 summon charId 스캔. 비면 직렬화 생략(골든 무변).
    #[serde(rename = "summonTemplates", default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub summon_templates: std::collections::HashMap<String, Unit>,
}
