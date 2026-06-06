//! 특성/패시브 DSL 스키마 (TS `types/passives.ts`). when/if/then 합성 언어. 엔진이 해석만.
//! 판별자: Trigger=`on`, Condition=`c`, Effect=`do` (DATA-SERIALIZATION-CONTRACT). who/as 등은 String.
use serde::{Deserialize, Serialize};

/// 발동 시점(when). 판별 `on`. who/as/result/dir 등은 Option<String>(TS 문자열 비교 그대로).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "on")]
pub enum Trigger {
    #[serde(rename = "battleStart")]
    BattleStart,
    #[serde(rename = "roundStart")]
    RoundStart,
    #[serde(rename = "roundEnd")]
    RoundEnd,
    #[serde(rename = "turnStart")]
    TurnStart { who: Option<String> },
    #[serde(rename = "turnEnd")]
    TurnEnd { who: Option<String> },
    #[serde(rename = "everyNTurns")]
    EveryNTurns { n: i64 },
    #[serde(rename = "interruptStart")]
    InterruptStart,
    #[serde(rename = "speedRoll")]
    SpeedRoll,
    #[serde(rename = "beforeAction")]
    BeforeAction { who: Option<String> },
    #[serde(rename = "skillUsed")]
    SkillUsed {
        who: Option<String>,
        #[serde(rename = "skillId")]
        skill_id: Option<String>,
    },
    #[serde(rename = "onMove")]
    OnMove { who: Option<String> },
    #[serde(rename = "enterCell")]
    EnterCell { row: Option<i64>, col: Option<i64> },
    #[serde(rename = "onHit")]
    OnHit {
        #[serde(rename = "as")]
        as_role: Option<String>,
        crit: Option<bool>,
    },
    #[serde(rename = "onMiss")]
    OnMiss {
        #[serde(rename = "as")]
        as_role: Option<String>,
    },
    #[serde(rename = "dealtDamage")]
    DealtDamage,
    #[serde(rename = "damaged")]
    Damaged,
    #[serde(rename = "onHeal")]
    OnHeal {
        #[serde(rename = "as")]
        as_role: Option<String>,
    },
    #[serde(rename = "onShieldGain")]
    OnShieldGain,
    #[serde(rename = "statusApplied")]
    StatusApplied {
        #[serde(rename = "statusId")]
        status_id: Option<String>,
        #[serde(rename = "as")]
        as_role: Option<String>,
    },
    #[serde(rename = "statusTick")]
    StatusTick {
        #[serde(rename = "statusId")]
        status_id: Option<String>,
    },
    #[serde(rename = "kill")]
    Kill,
    #[serde(rename = "death")]
    Death { who: Option<String> },
    #[serde(rename = "battleEnd")]
    BattleEnd { result: Option<String> },
    // 모험(run) 스코프 — 전투 디스패처는 무시(run/passives가 해석).
    #[serde(rename = "nodeEnter")]
    NodeEnter {
        #[serde(rename = "nodeType")]
        node_type: Option<String>,
    },
    #[serde(rename = "nodeClear")]
    NodeClear {
        #[serde(rename = "nodeType")]
        node_type: Option<String>,
    },
    #[serde(rename = "actStart")]
    ActStart,
    #[serde(rename = "goldGain")]
    GoldGain,
    #[serde(rename = "partyHpChange")]
    PartyHpChange { dir: Option<String> },
}

impl Trigger {
    /// 판별 문자열(`on` 값) — 디스패처가 tctx.on과 매칭.
    pub fn on(&self) -> &'static str {
        match self {
            Trigger::BattleStart => "battleStart",
            Trigger::RoundStart => "roundStart",
            Trigger::RoundEnd => "roundEnd",
            Trigger::TurnStart { .. } => "turnStart",
            Trigger::TurnEnd { .. } => "turnEnd",
            Trigger::EveryNTurns { .. } => "everyNTurns",
            Trigger::InterruptStart => "interruptStart",
            Trigger::SpeedRoll => "speedRoll",
            Trigger::BeforeAction { .. } => "beforeAction",
            Trigger::SkillUsed { .. } => "skillUsed",
            Trigger::OnMove { .. } => "onMove",
            Trigger::EnterCell { .. } => "enterCell",
            Trigger::OnHit { .. } => "onHit",
            Trigger::OnMiss { .. } => "onMiss",
            Trigger::DealtDamage => "dealtDamage",
            Trigger::Damaged => "damaged",
            Trigger::OnHeal { .. } => "onHeal",
            Trigger::OnShieldGain => "onShieldGain",
            Trigger::StatusApplied { .. } => "statusApplied",
            Trigger::StatusTick { .. } => "statusTick",
            Trigger::Kill => "kill",
            Trigger::Death { .. } => "death",
            Trigger::BattleEnd { .. } => "battleEnd",
            Trigger::NodeEnter { .. } => "nodeEnter",
            Trigger::NodeClear { .. } => "nodeClear",
            Trigger::ActStart => "actStart",
            Trigger::GoldGain => "goldGain",
            Trigger::PartyHpChange { .. } => "partyHpChange",
        }
    }
}

/// 조건(if). 판별 `c`. cmp는 Comparator 문자열.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "c")]
pub enum Condition {
    #[serde(rename = "hpPct")]
    HpPct { who: String, cmp: String, v: i64 },
    #[serde(rename = "round")]
    Round { cmp: String, v: i64 },
    #[serde(rename = "selfTurnCount")]
    SelfTurnCount { cmp: String, v: i64 },
    #[serde(rename = "everyN")]
    EveryN { n: i64, of: String },
    #[serde(rename = "firstTurn")]
    FirstTurn,
    #[serde(rename = "hasStatus")]
    HasStatus {
        who: String,
        #[serde(rename = "statusId")]
        status_id: String,
        #[serde(rename = "minStacks")]
        min_stacks: Option<i64>,
    },
    #[serde(rename = "missingStatus")]
    MissingStatus {
        who: String,
        #[serde(rename = "statusId")]
        status_id: String,
    },
    #[serde(rename = "atColumn")]
    AtColumn { who: String, cmp: String, v: i64 },
    #[serde(rename = "atRow")]
    AtRow { who: String, cmp: String, v: i64 },
    #[serde(rename = "atCell")]
    AtCell { who: String, row: i64, col: i64 },
    #[serde(rename = "isFrontline")]
    IsFrontline { who: String },
    #[serde(rename = "sideCount")]
    SideCount { side: String, cmp: String, v: i64 },
    #[serde(rename = "outnumbered")]
    Outnumbered,
    #[serde(rename = "subjectCharId")]
    SubjectCharId {
        #[serde(rename = "charId")]
        char_id: String,
    },
    #[serde(rename = "subjectSide")]
    SubjectSide { side: String },
    #[serde(rename = "wasCrit")]
    WasCrit,
    #[serde(rename = "damageAtLeast")]
    DamageAtLeast { v: i64 },
    #[serde(rename = "skillIs")]
    SkillIs {
        #[serde(rename = "skillId")]
        skill_id: String,
    },
    #[serde(rename = "chance")]
    Chance { pct: i64 },
    #[serde(rename = "nodeTypeIs")]
    NodeTypeIs {
        #[serde(rename = "nodeType")]
        node_type: String,
    },
    #[serde(rename = "goldAtLeast")]
    GoldAtLeast { v: i64 },
}

/// 효과(then). 판별 `do`. target은 EffTarget 문자열.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "do")]
pub enum Effect {
    #[serde(rename = "damage")]
    Damage { amount: i64, target: String },
    #[serde(rename = "heal")]
    Heal { amount: i64, target: String },
    #[serde(rename = "shield")]
    Shield { amount: i64, target: String },
    #[serde(rename = "applyStatus")]
    ApplyStatus {
        #[serde(rename = "statusId")]
        status_id: String,
        stacks: i64,
        duration: i64,
        target: String,
    },
    #[serde(rename = "cleanse")]
    Cleanse { target: String },
    #[serde(rename = "move")]
    Move {
        #[serde(rename = "deltaCol")]
        delta_col: i64,
        target: String,
    },
    #[serde(rename = "grantInterrupt")]
    GrantInterrupt { count: i64, target: String },
    #[serde(rename = "modSpeedRoll")]
    ModSpeedRoll { delta: i64 },
    #[serde(rename = "rerollSpeed")]
    RerollSpeed,
    #[serde(rename = "statMod")]
    StatMod { stat: String, delta: i64, target: String },
    #[serde(rename = "modCooldown")]
    ModCooldown {
        #[serde(rename = "skillId")]
        skill_id: Option<String>,
        delta: i64,
        target: String,
    },
    #[serde(rename = "healByDamage")]
    HealByDamage { pct: i64, target: String },
    #[serde(rename = "reflectByDamage")]
    ReflectByDamage { pct: i64, target: String },
    #[serde(rename = "removeStatus")]
    RemoveStatus {
        #[serde(rename = "statusId")]
        status_id: String,
        target: String,
    },
    #[serde(rename = "castSkill")]
    CastSkill {
        #[serde(rename = "skillId")]
        skill_id: String,
    },
    #[serde(rename = "showDialog")]
    ShowDialog { speaker: Option<String>, text: String },
    #[serde(rename = "goldDelta")]
    GoldDelta { amount: i64 },
    #[serde(rename = "healParty")]
    HealParty { pct: i64 },
    #[serde(rename = "grantRunStatus")]
    GrantRunStatus {
        #[serde(rename = "statusId")]
        status_id: String,
        stacks: i64,
        duration: i64,
        target: String,
    },
}

/// 디자이너 룰: when 시점에 if 모두 참이면 then 순서대로. TS PassiveRule.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PassiveRule {
    #[serde(default)]
    pub id: Option<String>,
    pub when: Trigger,
    #[serde(rename = "if", default)]
    pub if_conds: Option<Vec<Condition>>,
    pub then: Vec<Effect>,
    #[serde(rename = "maxPerTurn", default)]
    pub max_per_turn: Option<i64>,
    #[serde(rename = "maxPerBattle", default)]
    pub max_per_battle: Option<i64>,
}

/// 특성 = 캐릭터 정의 패시브 묶음(data/traits). TS TraitDef.
#[derive(Debug, Clone, Deserialize)]
pub struct TraitDef {
    pub id: String,
    pub name: String,
    pub rules: Vec<PassiveRule>,
}
