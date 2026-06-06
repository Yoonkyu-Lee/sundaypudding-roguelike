//! 결정론 휴리스틱 AI (TS `core/ai/`). 프로파일(우선순위 룰) → 공유 그리디 fallback. rng 미사용(순수).
//! 점수는 f64 — TS Number 연산과 동일 순서로 계산해 동치(같은 행동 선택). 동점=합법행동 인덱스.
use crate::targeting::{compute_hit_chance, get_legal_actions};
use crate::util::StatusDefs;
use spr_types::ai::{AiCondition, AiProfile, AiRule};
use spr_types::combat::{Action, GameState, Unit};
use spr_types::skills::{Skill, SkillEffect};
use std::collections::HashMap;

/// 합법 스킬 행동 + 파생(타겟·명중) — TS LegalAction에 해당.
struct La {
    action: Action,
    target_uid: Option<String>,
    hit_chance: i64,
}

fn cmp(a: f64, op: &str, b: f64) -> bool {
    match op {
        "lt" => a < b,
        "lte" => a <= b,
        "eq" => a == b,
        "gte" => a >= b,
        _ => a > b,
    }
}

fn hp_pct(u: &Unit) -> f64 {
    if u.hp_max > 0 {
        (u.hp as f64 / u.hp_max as f64) * 100.0
    } else {
        0.0
    }
}

fn unit<'a>(state: &'a GameState, uid: &str) -> Option<&'a Unit> {
    state.units.iter().find(|u| u.uid == uid)
}

fn alive_count(state: &GameState, side: &str) -> i64 {
    state.units.iter().filter(|u| u.alive && u.side == side).count() as i64
}

fn skill_kinds(skill_id: &str, skills: &HashMap<String, Skill>) -> Vec<&'static str> {
    let mut out = Vec::new();
    if let Some(s) = skills.get(skill_id) {
        for e in &s.effects {
            let k = match e {
                SkillEffect::Damage { .. } => "damage",
                SkillEffect::Heal { .. } => "heal",
                SkillEffect::Shield { .. } => "shield",
                SkillEffect::Cleanse => "cleanse",
                SkillEffect::ApplyStatus { .. } | SkillEffect::ApplyStatusSelf { .. } => "applyStatus",
                _ => continue,
            };
            if !out.contains(&k) {
                out.push(k);
            }
        }
    }
    out
}

fn matches_prefer(skill_id: &str, prefer: &str, skills: &HashMap<String, Skill>) -> bool {
    prefer == "any" || skill_kinds(skill_id, skills).contains(&prefer)
}

fn default_target(prefer: &str) -> &'static str {
    match prefer {
        "heal" | "shield" | "cleanse" => "lowestHpAlly",
        _ => "lowestHpEnemy",
    }
}

const ENEMY_PREFS: [&str; 5] = ["lowestHpEnemy", "highestHpEnemy", "frontmostEnemy", "backmostEnemy", "anyEnemy"];
const ALLY_PREFS: [&str; 2] = ["lowestHpAlly", "anyAlly"];

fn side_ok(la: &La, actor: &Unit, target: &str, tgt: Option<&Unit>) -> bool {
    if target == "self" {
        return la.target_uid.as_deref() == Some(actor.uid.as_str());
    }
    match tgt {
        None => false,
        Some(t) => {
            if ENEMY_PREFS.contains(&target) {
                t.side != actor.side
            } else if ALLY_PREFS.contains(&target) {
                t.side == actor.side
            } else {
                false
            }
        }
    }
}

fn base_score(target: &str, tgt: Option<&Unit>) -> f64 {
    let t = match tgt {
        Some(t) if target != "self" && target != "anyEnemy" && target != "anyAlly" => t,
        _ => return 0.0,
    };
    match target {
        "lowestHpEnemy" | "lowestHpAlly" => -(t.hp as f64) * 100.0,
        "highestHpEnemy" => t.hp as f64 * 100.0,
        "frontmostEnemy" => -(t.pos.col as f64) * 1000.0,
        "backmostEnemy" => t.pos.col as f64 * 1000.0,
        _ => 0.0,
    }
}

fn weight_bonus(rule: &AiRule, la: &La, tgt: Option<&Unit>) -> f64 {
    let (w, t) = match (&rule.weight, tgt) {
        (Some(w), Some(t)) => (w, t),
        _ => return 0.0,
    };
    let g = |k: &str| *w.get(k).unwrap_or(&0.0);
    let mut b = 0.0;
    b += g("backlineTarget") * t.pos.col as f64 * 10.0;
    b += g("frontlineTarget") * -(t.pos.col as f64) * 10.0;
    b += g("lowHpTarget") * -(t.hp as f64);
    b += g("hitChance") * la.hit_chance as f64 * 0.1;
    b += g("critChance") * t.crit_chance as f64 * 0.1;
    b
}

fn eval_cond(state: &GameState, actor: &Unit, c: &AiCondition) -> bool {
    let opp = if actor.side == "ally" { "enemy" } else { "ally" };
    match c {
        AiCondition::SelfHpPct { cmp: op, v } => cmp(hp_pct(actor), op, *v as f64),
        AiCondition::AllyHpPctBelow { v } => state.units.iter().any(|u| u.alive && u.side == actor.side && hp_pct(u) < *v as f64),
        AiCondition::EnemyHpPctBelow { v } => state.units.iter().any(|u| u.alive && u.side == opp && hp_pct(u) < *v as f64),
        AiCondition::SelfHasStatus { status_id } => actor.statuses.iter().any(|s| &s.def_id == status_id && s.stacks > 0),
        AiCondition::SelfMissingStatus { status_id } => !actor.statuses.iter().any(|s| &s.def_id == status_id && s.stacks > 0),
        AiCondition::EnemyHasStatus { status_id } => {
            state.units.iter().any(|u| u.alive && u.side == opp && u.statuses.iter().any(|s| &s.def_id == status_id && s.stacks > 0))
        }
        AiCondition::Round { cmp: op, v } => cmp(state.round as f64, op, *v as f64),
        AiCondition::Outnumbered => alive_count(state, &actor.side) < alive_count(state, opp),
        AiCondition::AllyCount { cmp: op, v } => cmp(alive_count(state, &actor.side) as f64, op, *v as f64),
    }
}

fn conds_hold(state: &GameState, actor: &Unit, conds: &Option<Vec<AiCondition>>) -> bool {
    match conds {
        None => true,
        Some(cs) => cs.iter().all(|c| eval_cond(state, actor, c)),
    }
}

/// 프로파일 위→아래 첫 적용가능 룰의 행동. 없으면 None(→그리디).
fn apply_profile(state: &GameState, actor: &Unit, profile: &AiProfile, skill_las: &[La], skills: &HashMap<String, Skill>) -> Option<Action> {
    for rule in &profile.rules {
        if !conds_hold(state, actor, &rule.if_conds) {
            continue;
        }
        if let Some(action) = apply_rule_with_skills(state, actor, rule, skill_las, skills) {
            return Some(action);
        }
    }
    None
}

fn apply_rule_with_skills(state: &GameState, actor: &Unit, rule: &AiRule, skill_las: &[La], skills: &HashMap<String, Skill>) -> Option<Action> {
    let prefer = rule.prefer.as_deref().unwrap_or("any");
    let target = rule.target.as_deref().unwrap_or_else(|| default_target(prefer));
    let mut best: Option<&La> = None;
    let mut best_score = f64::NEG_INFINITY;
    for la in skill_las {
        let skill_id = match &la.action {
            Action::Skill { skill_id, .. } => skill_id,
            _ => continue,
        };
        if !matches_prefer(skill_id, prefer, skills) {
            continue;
        }
        let tgt = la.target_uid.as_deref().and_then(|u| unit(state, u));
        if !side_ok(la, actor, target, tgt) {
            continue;
        }
        let score = base_score(target, tgt) + weight_bonus(rule, la, tgt);
        if score > best_score {
            best_score = score;
            best = Some(la);
        }
    }
    best.map(|la| la.action.clone())
}

fn greedy(state: &GameState, actor: Option<&Unit>, skill_las: &[La], defs: &StatusDefs) -> Action {
    let mut pool: Vec<&La> = skill_las.iter().collect();
    // 도발: 상대편 도발 보유 유닛 우선(있을 때만 강제).
    if let Some(a) = actor {
        let opp = if a.side == "ally" { "enemy" } else { "ally" };
        let taunters: Vec<&str> = state
            .units
            .iter()
            .filter(|u| u.alive && u.side == opp && u.statuses.iter().any(|s| defs.get(&s.def_id).map(|d| d.taunt).unwrap_or(false) && s.stacks > 0))
            .map(|u| u.uid.as_str())
            .collect();
        if !taunters.is_empty() {
            let forced: Vec<&La> = pool.iter().copied().filter(|la| la.target_uid.as_deref().map(|t| taunters.contains(&t)).unwrap_or(false)).collect();
            if !forced.is_empty() {
                pool = forced;
            }
        }
    }
    let hp_of = |uid: Option<&str>| -> f64 { uid.and_then(|u| unit(state, u)).map(|u| u.hp as f64).unwrap_or(f64::INFINITY) };
    let mut best = &pool[0];
    let mut best_score = f64::INFINITY;
    for la in &pool {
        let score = hp_of(la.target_uid.as_deref()) * 1000.0 - la.hit_chance as f64;
        if score < best_score {
            best_score = score;
            best = la;
        }
    }
    best.action.clone()
}

/// 행동 선택: 프로파일(있으면) → 그리디. TS chooseAction.
pub fn choose_action(state: &GameState, skills: &HashMap<String, Skill>, defs: &StatusDefs, profiles: &HashMap<String, AiProfile>) -> Action {
    let legal = get_legal_actions(state, skills, defs);
    if legal.is_empty() {
        return Action::Skip;
    }
    let actor = state.current.as_ref().and_then(|c| unit(state, &c.uid));
    // 합법 스킬 행동 + 파생(타겟·명중)
    let skill_las: Vec<La> = legal
        .iter()
        .filter_map(|a| match a {
            Action::Skill { skill_id, target_uid, .. } => {
                let hc = match (actor, target_uid.as_deref().and_then(|u| unit(state, u)), skills.get(skill_id)) {
                    (Some(ac), Some(t), Some(sk)) => compute_hit_chance(ac, sk, t),
                    _ => 100,
                };
                Some(La { action: a.clone(), target_uid: target_uid.clone(), hit_chance: hc })
            }
            _ => None,
        })
        .collect();
    if skill_las.is_empty() {
        return legal[0].clone(); // 스킵뿐
    }
    if let Some(a) = actor {
        if let Some(pid) = &a.ai_profile_id {
            if let Some(profile) = profiles.get(pid) {
                if let Some(action) = apply_profile(state, a, profile, &skill_las, skills) {
                    return action;
                }
            }
        }
    }
    greedy(state, actor, &skill_las, defs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use crate::flow::step;
    use spr_types::canonical::canonical_json;

    use spr_types::data::{Encounter, Placement};

    fn pl(c: &str, row: i64, col: i64) -> Placement {
        Placement { char_id: c.into(), pos: spr_types::data::Pos { row, col } }
    }
    /// TS 스크립트와 동일한 프로파일 검증 인코딩(4 프로파일 enemy).
    fn profiled_enc() -> Encounter {
        Encounter {
            id: "prof".into(), name: "프로파일 검증".into(),
            allies: vec![pl("kim", 0, 0), pl("shanghai", 1, 0), pl("cho", 2, 0)],
            enemies: vec![pl("jung", 0, 0), pl("chunho", 1, 0), pl("shim", 2, 0), pl("doctor", 3, 0)],
            boss: false,
        }
    }

    fn play_ai(seed: u32, enc: &Encounter) -> (String, String) {
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        let profiles = spr_data::ai_profiles();
        let mut s = create_battle(seed, enc, &chars);
        let mut guard = 0;
        while s.phase == "inProgress" && guard < 4000 {
            guard += 1;
            let a = choose_action(&s, &skills, &defs, &profiles);
            step(&mut s, &a, &defs, &skills);
        }
        (s.phase.clone(), canonical_json(&s.log))
    }

    #[test]
    fn ai_driven_full_battle_differential() {
        // 양 진영 chooseAction 풀 플레이 → TS와 전체 로그 바이트 동일(AI+전투 동시, 순수·결정론).
        // demo=그리디 위주, profiled=4 AI 프로파일(applyProfile/조건/가중치 전 경로).
        let corpus: serde_json::Value = serde_json::from_str(AI_CORPUS).unwrap();
        let demo = spr_data::demo_encounter();
        let prof = profiled_enc();
        for seed in [1u32, 7, 42, 100, 2024] {
            let k = seed.to_string();
            let (ph1, log1) = play_ai(seed, &demo);
            assert_eq!(log1, corpus["demo"][&k].as_str().unwrap(), "seed {} demo 로그 바이트 동일", seed);
            assert!(ph1 == "allyWin" || ph1 == "enemyWin");
            let (ph2, log2) = play_ai(seed, &prof);
            assert_eq!(log2, corpus["profiled"][&k].as_str().unwrap(), "seed {} profiled 로그 바이트 동일", seed);
            assert!(ph2 == "allyWin" || ph2 == "enemyWin");
        }
    }

    const AI_CORPUS: &str = include_str!("../tests/ai-corpus.generated.json");
}
