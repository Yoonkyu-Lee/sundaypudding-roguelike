//! 패시브 디스패치 컨텍스트 + 공용 헬퍼 (TS `passives/ctx.ts`).
use spr_types::combat::GameState;
use spr_types::data::Pos;

/// 트리거 발생 컨텍스트(엔진이 훅에서 채워 fire_trigger에 전달).
#[derive(Debug, Clone, Default)]
pub struct TriggerCtx {
    pub on: String,
    pub subject_uid: Option<String>,
    pub attacker_uid: Option<String>,
    pub crit: Option<bool>,
    pub damage: Option<i64>,
    pub status_id: Option<String>,
    pub skill_id: Option<String>,
    pub cell: Option<Pos>,
    pub winner_side: Option<String>,
}

impl TriggerCtx {
    pub fn new(on: &str) -> Self {
        TriggerCtx { on: on.to_string(), ..Default::default() }
    }
}

/// 룰 평가 관점: self=소유자 / subject=상대 / target=현재 행동 대상. 인덱스(state.units)로 보유.
#[derive(Debug, Clone, Copy)]
pub struct RuleCtx {
    pub owner: usize,
    pub subject: Option<usize>,
    pub target: Option<usize>,
    pub damage: Option<i64>,
}

impl RuleCtx {
    pub fn of(owner: usize) -> Self {
        RuleCtx { owner, subject: None, target: None, damage: None }
    }
    pub fn with_subject(owner: usize, subject: Option<usize>) -> Self {
        RuleCtx { owner, subject, target: None, damage: None }
    }
}

pub fn cmp(a: f64, op: &str, b: f64) -> bool {
    match op {
        "lt" => a < b,
        "lte" => a <= b,
        "eq" => a == b,
        "gte" => a >= b,
        "gt" => a > b,
        _ => false,
    }
}

/// 정수 비교(부동소수 불요한 조건용 — round/turnCount/col 등).
pub fn cmp_i(a: i64, op: &str, b: i64) -> bool {
    match op {
        "lt" => a < b,
        "lte" => a <= b,
        "eq" => a == b,
        "gte" => a >= b,
        "gt" => a > b,
        _ => false,
    }
}

/// 그 유닛이 자기 진영 점유 최전열(생존 같은 편 최소 열)에 있는가. TS isFrontline.
pub fn is_frontline(state: &GameState, unit_idx: usize) -> bool {
    let u = &state.units[unit_idx];
    let mut front = i64::MAX;
    for o in &state.units {
        if o.alive && o.side == u.side {
            front = front.min(o.pos.col);
        }
    }
    u.pos.col == front
}
