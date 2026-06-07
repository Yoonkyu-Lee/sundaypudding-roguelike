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

/// 보상/상점 출현 게이트(4.4/4.7): 숙련도(`masteryReq`, use_mastery 시) **AND** 전직 차수(`classReq`).
/// 숙련도 = `masteryReq` 우선(없으면 강화 `tier` 폴백 — 미마이그레이션 콘텐츠 호환). 전직 = `classReq` 있으면 도달 차수 이상.
pub fn reward_gate_ok(sk: &Skill, use_mastery: bool, mastery_level: i64, class_tier: i64) -> bool {
    if use_mastery {
        let req = sk.mastery_req.or(sk.tier).unwrap_or(1);
        if req > unlocked_tier(mastery_level) {
            return false;
        }
    }
    if let Some(cr) = sk.class_req {
        if cr > class_tier {
            return false;
        }
    }
    true
}

fn tier_ok(run: &RunState, m: &PartyMemberState, skill_id: &str, skills: &HashMap<String, Skill>) -> bool {
    skills.get(skill_id).map(|sk| reward_gate_ok(sk, run.use_mastery, m.mastery_level, m.class_tier)).unwrap_or(false)
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
        // (b) 새 스킬 — learnset
        for sid in &c.skill_ids {
            if !owns_upgrade_line(&m.owned_skill_ids, sid, skills) && tier_ok(run, m, sid, skills) {
                if let Some(sk) = skills.get(sid) {
                    pool.push(RewardOption::LearnSkill { id: mk(), char_id: m.char_id.clone(), skill_id: sid.clone(), label: format!("{}: 새 스킬 「{}」 습득", c.name, sk.name) });
                }
            }
        }
        // (b2) 전직 전용 풀(4.7) — exclusiveTo==본인 + classReq 설정 + learnset 밖. 도달 차수·숙련도 게이트 통과 시 편입.
        // 분기 무관(차수만 게이트) — 배제 조건 없음. 결정론: id 정렬 순회(HashMap 순서 비결정성 회피).
        let mut job_skills: Vec<String> = skills
            .iter()
            .filter(|(_, sk)| sk.exclusive_to.as_deref() == Some(m.char_id.as_str()) && sk.class_req.is_some())
            .map(|(sid, _)| sid.clone())
            .filter(|sid| !c.skill_ids.contains(sid))
            .collect();
        job_skills.sort();
        for sid in &job_skills {
            if !owns_upgrade_line(&m.owned_skill_ids, sid, skills) && tier_ok(run, m, sid, skills) {
                let sk = &skills[sid];
                pool.push(RewardOption::LearnSkill { id: mk(), char_id: m.char_id.clone(), skill_id: sid.clone(), label: format!("{}: 전직기 「{}」 습득", c.name, sk.name) });
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
    fn reward_gate_class_and_mastery() {
        let skills = spr_data::skills();
        let headbutt = &skills["kim_headbutt"]; // classReq 1, masteryReq 1 (전직 전용)
        // 전직 차수 0 → classReq 1에 막힘(use_mastery 무관).
        assert!(!reward_gate_ok(headbutt, false, 9, 0));
        // 차수 1 도달 → 통과(use_mastery=false, 숙련도 무시).
        assert!(reward_gate_ok(headbutt, false, 0, 1));
        // use_mastery=true: masteryReq 1 → unlocked_tier(mastery 0)=1 충족 + 차수 1 → 통과.
        assert!(reward_gate_ok(headbutt, true, 0, 1));
        // 일반 스킬(classReq 없음) → 차수 0서도 통과.
        assert!(reward_gate_ok(&skills["kim_punch"], false, 0, 0));
    }

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
