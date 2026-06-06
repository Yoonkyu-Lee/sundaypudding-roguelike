//! 보상 생성 (TS `core/run/rewards.ts`, 4.5: 등급별 N택1). RNG 추첨 — 결정론. 풀 빌드 순서 = TS 동일.
use super::items::item_reward_options;
use super::types::{RewardOption, RunState};
use spr_types::data::{Character, ItemDef};
use spr_types::party::PartyMemberState;
use spr_types::skills::Skill;
use std::collections::HashMap;

/// 숙련도 레벨 → 출현 가능 최대 tier. TS unlockedTier.
pub fn unlocked_tier(level: i64) -> i64 {
    if level >= 5 {
        3
    } else if level >= 2 {
        2
    } else {
        1
    }
}

fn tier_ok(run: &RunState, m: &PartyMemberState, skill_id: &str, skills: &HashMap<String, Skill>) -> bool {
    if !run.use_mastery {
        return true;
    }
    skills.get(skill_id).and_then(|s| s.tier).unwrap_or(1) <= unlocked_tier(m.mastery_level)
}

/// 베이스 스킬의 강화 라인 중 하나라도 보유 중인가(다운그레이드 재출현 방지). TS ownsUpgradeLine.
pub fn owns_upgrade_line(owned: &[String], base: &str, skills: &HashMap<String, Skill>) -> bool {
    let mut cur = Some(base.to_string());
    let mut seen = std::collections::HashSet::new();
    while let Some(c) = cur {
        if !skills.contains_key(&c) || seen.contains(&c) {
            break;
        }
        if owned.iter().any(|o| o == &c) {
            return true;
        }
        seen.insert(c.clone());
        cur = skills[&c].next_tier_id.clone();
    }
    false
}

/// 보상 후보 풀 추첨(등급별 N택1). RNG·풀순서 TS 동일. TS genRewards.
pub fn gen_rewards(run: &mut RunState, tier: i64, chars: &HashMap<String, Character>, skills: &HashMap<String, Skill>, items: &HashMap<String, ItemDef>, item_pool: &[String]) -> Vec<RewardOption> {
    let choice_count = 3 + (tier - 1).clamp(0, 2);
    let item_count = tier.clamp(1, 3);
    let visited_len = run.visited.len();
    let mut k = 0i64;
    let mut mk = move || {
        let s = format!("rw{}_{}", visited_len, k);
        k += 1;
        s
    };

    let living: Vec<PartyMemberState> = run.party.iter().filter(|m| m.hp > 0).cloned().collect();
    let mut pool: Vec<RewardOption> = Vec::new();
    for m in &living {
        let c = &chars[&m.char_id];
        // (a) 강화
        for sid in &m.owned_skill_ids {
            if let Some(sk) = skills.get(sid) {
                if let Some(next) = &sk.next_tier_id {
                    if let Some(to) = skills.get(next) {
                        if tier_ok(run, m, next, skills) {
                            pool.push(RewardOption::UpgradeSkill { id: mk(), char_id: m.char_id.clone(), from_skill_id: sid.clone(), to_skill_id: next.clone(), label: format!("{}: 「{}」→「{}」 강화", c.name, sk.name, to.name) });
                        }
                    }
                }
            }
        }
        // (b) 새 스킬
        for sid in &c.skill_ids {
            if !owns_upgrade_line(&m.owned_skill_ids, sid, skills) && tier_ok(run, m, sid, skills) {
                if let Some(sk) = skills.get(sid) {
                    pool.push(RewardOption::LearnSkill { id: mk(), char_id: m.char_id.clone(), skill_id: sid.clone(), label: format!("{}: 새 스킬 「{}」 습득", c.name, sk.name) });
                }
            }
        }
    }
    // (c) 장신구
    pool.extend(item_reward_options(run, &mut mk, item_count, items, item_pool));

    // 결정론 추첨
    let mut chosen: Vec<RewardOption> = Vec::new();
    while (chosen.len() as i64) < choice_count && !pool.is_empty() {
        let idx = run.rng.int(0, pool.len() as i64 - 1) as usize;
        chosen.push(pool.remove(idx));
    }
    while (chosen.len() as i64) < choice_count {
        chosen.push(RewardOption::Heal { id: mk(), pct: 30, label: "파티 30% 회복".to_string() });
    }
    chosen
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::run::create_run;
    use spr_types::canonical::canonical_json;

    #[test]
    fn gen_rewards_differential() {
        // createRun(seed) → genRewards(tier) RewardOption(추첨·라벨) TS 바이트동일. RNG·풀순서 검증.
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let items = spr_data::items();
        let pool = spr_data::item_pool();
        let rd = spr_data::default_run();
        let reference: serde_json::Value = serde_json::from_str(include_str!("../../tests/rewards.generated.json")).unwrap();
        for seed in [1u32, 42, 2024] {
            for tier in [1i64, 2, 3] {
                let mut r = create_run(seed, &rd.roster.clone(), &rd, &HashMap::new(), false, &chars);
                let rewards = gen_rewards(&mut r, tier, &chars, &skills, &items, &pool);
                let key = format!("{}_{}", seed, tier);
                assert_eq!(canonical_json(&rewards), reference[&key].as_str().unwrap(), "보상 {} TS 바이트동일", key);
            }
        }
    }
}
