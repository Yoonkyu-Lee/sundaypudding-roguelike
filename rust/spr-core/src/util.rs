//! 전투 공유 커널 — 순수 헬퍼 + 상태 QUERY (TS `util.ts`). 사이클 방지 leaf.
use spr_types::combat::Unit;
use spr_types::data::StatusDef;
use std::collections::HashMap;

pub type StatusDefs = HashMap<String, StatusDef>;

/// 정수 반올림 나눗셈(zero-f64) — round-half-up(n/d), n≤0→0. TS util.roundDiv.
pub fn round_div(n: i64, d: i64) -> i64 {
    if n <= 0 {
        0
    } else {
        (n + d / 2) / d
    }
}

pub fn stat_mod(u: &Unit, key: &str) -> i64 {
    *u.stat_mods.get(key).unwrap_or(&0)
}

/// defId 상태 보유(stacks>0).
pub fn has_status(u: &Unit, def_id: &str) -> bool {
    u.statuses.iter().any(|s| s.def_id == def_id && s.stacks > 0)
}

/// defId 스택 합(필터 없음 — TS totalStacks).
pub fn total_stacks(u: &Unit, def_id: &str) -> i64 {
    u.statuses.iter().filter(|s| s.def_id == def_id).map(|s| s.stacks).sum()
}

/// 상태 정의 수치 필드 스택 가중 합(dmgDealtFlat/critChanceAdd/critMultiplierAdd/speedMod).
pub fn status_num_sum(u: &Unit, key: &str, defs: &StatusDefs) -> i64 {
    u.statuses.iter().map(|s| defs.get(&s.def_id).map(|d| d.num_field(key)).unwrap_or(0) * s.stacks).sum()
}

/// 불린 플래그 상태 보유(invincible/taunt, stacks>0).
pub fn status_flag(u: &Unit, key: &str, defs: &StatusDefs) -> bool {
    u.statuses.iter().any(|s| {
        s.stacks > 0
            && defs.get(&s.def_id).map(|d| match key {
                "invincible" => d.invincible,
                "taunt" => d.taunt,
                _ => false,
            }).unwrap_or(false)
    })
}

/// 행동 봉쇄(빙결 등 actionDenial, stacks>0).
pub fn is_frozen(u: &Unit, defs: &StatusDefs) -> bool {
    u.statuses.iter().any(|s| s.stacks > 0 && defs.get(&s.def_id).map(|d| d.action_denial).unwrap_or(false))
}

pub fn crit_pct_of(u: &Unit, defs: &StatusDefs) -> i64 {
    u.crit_chance + stat_mod(u, "critChance") + status_num_sum(u, "critChanceAdd", defs)
}
