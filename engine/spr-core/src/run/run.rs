//! 런 흐름 — 생성·편성·노드 진입·층 완료·전투종료·보상 (TS `core/run/run.ts`).
use super::data::RunData;
use super::helpers::{complete_node, cur_floor, heal_party, learn_owned, node, run_instant_layers, upgrade_owned};
use super::layers::{advance_core, node_core, start_core};
use super::passives::{fire_run_trigger, RunTriggerCtx};
use super::rewards::gen_rewards;
use super::types::{RewardOption, RunState};
use crate::graph::{live_reachable, validate_run};
use spr_types::data::{Character, Placement, Pos};
use spr_types::map::RunDef;
use spr_types::party::{Equipped, PartyMemberState};
use spr_types::rng::Rng;
use std::collections::{HashMap, HashSet};

/// 런 생성. TS createRun. roster=시작 편성, mastery=charId별 숙련도 스냅샷.
pub fn create_run(
    seed: u32,
    roster: &[Placement],
    run_def: &RunDef,
    mastery: &HashMap<String, i64>,
    use_mastery: bool,
    chars: &HashMap<String, Character>,
) -> RunState {
    let v = validate_run(run_def);
    if !v.ok {
        panic!("createRun: invalid runDef '{}' — {}", run_def.id, v.errors.join("; "));
    }
    let rng = Rng::new(seed ^ 0x9e37_79b9);
    let entry_idx = run_def.floors.iter().position(|f| f.id == run_def.entry_floor_id).unwrap_or(0);
    let f0 = &run_def.floors[entry_idx];
    let party: Vec<PartyMemberState> = roster
        .iter()
        .map(|m| {
            let c = &chars[&m.char_id];
            let owned: Vec<String> = c.skill_ids.iter().take(4).cloned().collect();
            PartyMemberState {
                char_id: m.char_id.clone(),
                pos: m.pos,
                hp: c.hp,
                max_hp: c.hp,
                skill_dmg_bonus: HashMap::new(),
                owned_skill_ids: owned.clone(),
                active_skill_ids: owned,
                equipped: Equipped::default(),
                mastery_level: *mastery.get(&m.char_id).unwrap_or(&0),
                // 전직(4.7): 런 시작 = 루트 직업(0차), 차수 0, 부여 패시브 없음(루트=최초 상태).
                // 루트 grantsTraitIds는 미적용(루트 정체성=Character.traitIds). 전직 노드서 차수↑·패시브 누적.
                job_id: c.root_job_id.clone(),
                class_tier: 0,
                job_trait_ids: Vec::new(),
            }
        })
        .collect();
    let mut visited_set = HashSet::new();
    visited_set.insert(f0.entry_node_id.clone());
    RunState {
        rng,
        seed,
        run_def: run_def.clone(),
        floor: entry_idx,
        use_mastery,
        party,
        visited: vec![f0.entry_node_id.clone()],
        reachable: live_reachable(f0, &f0.entry_node_id, &visited_set),
        current_node_id: f0.entry_node_id.clone(),
        active_node_id: None,
        core_cursor: None,
        phase: "map".to_string(),
        battle: None,
        rewards: None,
        gold: 0,
        inventory: vec!["wood_bat".to_string(), "leather_vest".to_string()],
        shop: None,
        encounter: None,
        class_change_remaining: None,
        pending_statuses: HashMap::new(),
        firing: false,
        log: vec![format!("런 시작 (seed {})", seed)],
    }
}

/// 진형 편성: 아군 위치 변경(비전투). 점유 칸이면 교대(swap). TS movePartyMember.
pub fn move_party_member(run: &mut RunState, char_id: &str, to: Pos) {
    if run.phase == "battle" {
        return;
    }
    if to.row < 0 || to.row > 3 || to.col < 0 || to.col > 3 {
        return;
    }
    let mi = match run.party.iter().position(|p| p.char_id == char_id) {
        Some(i) => i,
        None => return,
    };
    if run.party[mi].pos.row == to.row && run.party[mi].pos.col == to.col {
        return;
    }
    let from = run.party[mi].pos;
    if let Some(oi) = run.party.iter().position(|p| p.char_id != char_id && p.pos.row == to.row && p.pos.col == to.col) {
        run.party[oi].pos = from; // 위치 교대
    }
    run.party[mi].pos = to;
}

/// 로드아웃: 활성 스킬 토글(보유 중 ≤4, 최소 1, 비전투). TS setActiveSkill.
pub fn set_active_skill(run: &mut RunState, char_id: &str, skill_id: &str) {
    if run.phase == "battle" {
        return;
    }
    let m = match run.party.iter_mut().find(|p| p.char_id == char_id) {
        Some(m) => m,
        None => return,
    };
    if !m.owned_skill_ids.iter().any(|s| s == skill_id) {
        return;
    }
    if let Some(i) = m.active_skill_ids.iter().position(|s| s == skill_id) {
        if m.active_skill_ids.len() > 1 {
            m.active_skill_ids.remove(i);
        }
    } else if m.active_skill_ids.len() < 4 {
        m.active_skill_ids.push(skill_id.to_string());
    }
}

/// reachable 노드 진입. 전투면 시퀀서, clear면 층 완료, 콘텐츠 없으면 즉시 통과. TS enterNode.
pub fn enter_node(run: &mut RunState, node_id: &str, d: &RunData) {
    if run.phase != "map" || !run.reachable.iter().any(|x| x == node_id) {
        return;
    }
    let (ntype, to_floor, on_enter, has_core) = {
        let n = node(run, node_id);
        let on_enter = n.layers.as_ref().and_then(|l| l.on_enter.clone()).unwrap_or_default();
        (n.node_type.clone(), n.to_floor.clone(), on_enter, !node_core(n, d).is_empty())
    };
    run.active_node_id = Some(node_id.to_string());
    let mut ctx = RunTriggerCtx::new("nodeEnter");
    ctx.node_type = Some(ntype.clone());
    fire_run_trigger(run, &ctx, d);
    run_instant_layers(run, &on_enter, d);

    if ntype == "clear" {
        if !run.visited.iter().any(|v| v == node_id) {
            run.visited.push(node_id.to_string());
        }
        run.log.push("클리어 노드 도달 — 층 완료".to_string());
        complete_floor(run, to_floor, d);
        return;
    }
    if has_core {
        start_core(run, node_id, d);
        return;
    }
    complete_node(run, node_id, d);
}

/// 층 완료(clear 진입) — toFloor 분기(부활·50% 회복) 또는 게임 클리어. TS completeFloor.
fn complete_floor(run: &mut RunState, to_floor: Option<String>, d: &RunData) {
    let mut ctx = RunTriggerCtx::new("nodeClear");
    ctx.node_type = Some("clear".to_string());
    fire_run_trigger(run, &ctx, d);
    let next_idx = to_floor.as_ref().and_then(|id| run.run_def.floors.iter().position(|f| &f.id == id));
    let next_idx = match next_idx {
        Some(i) => i,
        None => {
            run.phase = "won".to_string();
            run.active_node_id = None;
            run.reachable.clear();
            run.log.push("클리어 노드(종료) 도달 — 게임 클리어!".to_string());
            return;
        }
    };
    run.floor = next_idx;
    let (entry, fname) = {
        let f = cur_floor(run);
        (f.entry_node_id.clone(), f.name.clone())
    };
    run.visited = vec![entry.clone()];
    let set: HashSet<String> = std::iter::once(entry.clone()).collect();
    run.reachable = {
        let f = cur_floor(run);
        live_reachable(f, &entry, &set)
    };
    run.current_node_id = entry;
    run.active_node_id = None;
    run.battle = None;
    heal_party(run, 50, true, d);
    run.phase = "map".to_string();
    run.log.push(format!("{} 진입 — 전투불능 부활 + 파티 50% 회복", fname.unwrap_or_else(|| format!("층 {}", run.floor + 1))));
    fire_run_trigger(run, &RunTriggerCtx::new("actStart"), d);
}

/// 전투 종료 처리 — HP 반영, 승=시퀀서 복귀/보상, 패=실패. TS resolveBattleEnd.
pub fn resolve_battle_end(run: &mut RunState, d: &RunData) {
    let result = match &run.battle {
        Some(b) if run.phase == "battle" && b.phase != "inProgress" => b.phase.clone(),
        _ => return,
    };
    // 파티 HP 반영
    let hp_map: HashMap<String, i64> = run.battle.as_ref().unwrap().units.iter().filter(|u| u.side == "ally").map(|u| (u.char_id.clone(), u.hp.max(0))).collect();
    for m in &mut run.party {
        if let Some(hp) = hp_map.get(&m.char_id) {
            m.hp = *hp;
        }
    }
    if result == "enemyWin" {
        run.phase = "lost".to_string();
        run.reachable.clear();
        run.log.push("전멸 — 런 실패".to_string());
        return;
    }
    if run.core_cursor.is_some() {
        advance_core(run, d);
        return;
    }
    // 레거시 타입 노드(코어 없음) — 골드 + 보상.
    let aid = run.active_node_id.clone().unwrap();
    let ntype = node(run, &aid).node_type.clone();
    let gold_gain = if ntype == "boss" { 24 } else if ntype == "elite" { 16 } else { 8 };
    run.gold += gold_gain;
    fire_run_trigger(run, &RunTriggerCtx::new("goldGain"), d);
    let rewards = gen_rewards(run, 1, &d.chars, &d.skills, &d.items, &d.item_pool);
    run.rewards = Some(rewards);
    run.phase = "reward".to_string();
    run.log.push(format!("{} (+{}G) — 보상 선택", if ntype == "boss" { "보스 격파" } else { "전투 승리" }, gold_gain));
}

/// 보상 선택 적용. TS chooseReward.
pub fn choose_reward(run: &mut RunState, option_id: &str, d: &RunData) {
    if run.phase != "reward" {
        return;
    }
    let opt = match &run.rewards {
        Some(rs) => match rs.iter().find(|o| reward_id(o) == option_id) {
            Some(o) => o.clone(),
            None => return,
        },
        None => return,
    };
    match &opt {
        RewardOption::UpgradeSkill { char_id, from_skill_id, to_skill_id, .. } => {
            if let Some(mi) = run.party.iter().position(|p| &p.char_id == char_id) {
                upgrade_owned(&mut run.party[mi], from_skill_id, to_skill_id);
            }
        }
        RewardOption::LearnSkill { char_id, skill_id, .. } => {
            if let Some(mi) = run.party.iter().position(|p| &p.char_id == char_id) {
                learn_owned(&mut run.party[mi], skill_id);
            }
        }
        RewardOption::Item { item_id, .. } => run.inventory.push(item_id.clone()),
        RewardOption::Heal { pct, .. } => heal_party(run, *pct, false, d),
    }
    run.log.push(format!("보상: {}", reward_label(&opt)));
    run.rewards = None;
    run.battle = None;
    if run.core_cursor.is_some() {
        advance_core(run, d);
        return;
    }
    let aid = run.active_node_id.clone().unwrap();
    complete_node(run, &aid, d);
}

fn reward_id(o: &RewardOption) -> &str {
    match o {
        RewardOption::UpgradeSkill { id, .. } | RewardOption::LearnSkill { id, .. } | RewardOption::Item { id, .. } | RewardOption::Heal { id, .. } => id,
    }
}
fn reward_label(o: &RewardOption) -> &str {
    match o {
        RewardOption::UpgradeSkill { label, .. } | RewardOption::LearnSkill { label, .. } | RewardOption::Item { label, .. } | RewardOption::Heal { label, .. } => label,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::run::helpers::{heal_party, learn_owned, upgrade_owned};

    fn make() -> RunState {
        let chars = spr_data::characters();
        let rd = spr_data::default_run();
        create_run(42, &rd.roster.clone(), &rd, &HashMap::new(), false, &chars)
    }

    #[test]
    fn create_run_parity() {
        let mut r = make();
        // TS createRun(42, DEFAULT_RUN) 레퍼런스.
        assert_eq!(r.floor, 0);
        assert_eq!(r.current_node_id, "f1_entry");
        let mut reach = r.reachable.clone();
        reach.sort();
        assert_eq!(reach, vec!["f1_b1", "f1_b2"]);
        assert_eq!(r.phase, "map");
        assert_eq!(r.gold, 0);
        assert_eq!(r.inventory, vec!["wood_bat", "leather_vest"]);
        assert_eq!(r.log, vec!["런 시작 (seed 42)"]);
        // 파티: charId·hp·보유/활성 스킬 = learnset 앞4.
        let p: Vec<(&str, i64, usize)> = r.party.iter().map(|m| (m.char_id.as_str(), m.hp, m.owned_skill_ids.len())).collect();
        assert_eq!(p, vec![("kim", 46, 4), ("shin", 50, 4), ("shanghai", 28, 4), ("cho", 34, 4)]);
        assert_eq!(r.party[0].active_skill_ids, vec!["kim_punch", "kim_kick", "kim_oyabun", "kim_4dollar"]);
        // RNG 시드 초기화(seed ^ 0x9e3779b9) + mulberry32 parity.
        assert_eq!(r.rng.int(0, 1_000_000), 481316);
    }

    #[test]
    fn heal_and_party_mutations() {
        let d = crate::run::RunData::load();
        let mut r = make();
        // heal_party(50,false): 생존자만 +50% maxHp 캡. kim 46→ hp10이면 33.
        r.party[0].hp = 10;
        r.party[1].hp = 0; // shin 전투불능
        heal_party(&mut r, 50, false, &d);
        assert_eq!(r.party[0].hp, 33); // 10 + floor((46*50+50)/100)=10+23
        assert_eq!(r.party[1].hp, 0); // revive=false → 부활 안 함
        heal_party(&mut r, 50, true, &d);
        assert_eq!(r.party[1].hp, 25); // shin maxHp50: roundDiv(50*50,100)=25 부활

        // 편성 교대: shanghai(1,2)를 kim 자리(1,0)로 → 위치 swap.
        move_party_member(&mut r, "shanghai", spr_types::data::Pos { row: 1, col: 0 });
        assert_eq!(r.party.iter().find(|m| m.char_id == "shanghai").unwrap().pos, spr_types::data::Pos { row: 1, col: 0 });
        assert_eq!(r.party[0].pos, spr_types::data::Pos { row: 1, col: 2 }); // kim 밀려남

        // 활성 토글: 끄기(최소1) / upgrade / learn.
        set_active_skill(&mut r, "kim", "kim_kick"); // 끄기 → 3개
        assert_eq!(r.party[0].active_skill_ids.len(), 3);
        set_active_skill(&mut r, "kim", "kim_kick"); // 켜기 → 4개
        assert_eq!(r.party[0].active_skill_ids.len(), 4);
        upgrade_owned(&mut r.party[0], "kim_punch", "kim_punch_2");
        assert!(r.party[0].owned_skill_ids.contains(&"kim_punch_2".to_string()));
        learn_owned(&mut r.party[0], "kim_punch_2"); // 이미 보유 → 무변
        assert_eq!(r.party[0].owned_skill_ids.iter().filter(|s| *s == "kim_punch_2").count(), 1);
    }

    #[test]
    fn full_run_differential() {
        // 전체 yain 런(맵 reachable[0] → AI 전투 → 보상[0] → 상점 나가기 → 인카운터[0])을 TS와 동일 정책으로 구동.
        // 최종 상태(phase/gold/floor/inventory/log/party) 바이트동일 = 네비·전투AI·보상RNG·상점·인카운터·런패시브 일괄 검증.
        use crate::ai::choose_action;
        use crate::flow::step;
        use crate::run::{buy_shop_offer, choose_encounter_option, leave_shop, resolve_battle_end};
        use spr_types::canonical::canonical_json;
        let _ = buy_shop_offer;
        let d = crate::run::RunData::load();
        let rd = spr_data::default_run();
        let reference: serde_json::Value = serde_json::from_str(include_str!("../../tests/full-run.generated.json")).unwrap();

        for seed in [42u32, 7, 123] {
            let mut run = create_run(seed, &rd.roster.clone(), &rd, &HashMap::new(), false, &d.chars);
            let mut guard = 0;
            while run.phase != "won" && run.phase != "lost" && guard < 5000 {
                guard += 1;
                match run.phase.as_str() {
                    "map" => {
                        let n = run.reachable[0].clone();
                        enter_node(&mut run, &n, &d);
                    }
                    "battle" => {
                        while run.battle.as_ref().map(|b| b.phase == "inProgress").unwrap_or(false) {
                            let a = { let b = run.battle.as_ref().unwrap(); choose_action(b, &d.skills, &d.defs, &d.ai_profiles) };
                            step(run.battle.as_mut().unwrap(), &a, &d.defs, &d.skills);
                        }
                        resolve_battle_end(&mut run, &d);
                    }
                    "reward" => {
                        let id = super::reward_id(&run.rewards.as_ref().unwrap()[0]).to_string();
                        choose_reward(&mut run, &id, &d);
                    }
                    "shop" => leave_shop(&mut run, &d),
                    "encounter" => {
                        let id = run.encounter.as_ref().unwrap().choices[0].id.clone();
                        choose_encounter_option(&mut run, &id, &d);
                    }
                    _ => break,
                }
            }
            let summary = serde_json::json!({
                "phase": run.phase, "gold": run.gold, "floor": run.floor,
                "inventory": run.inventory, "log": run.log,
                "party": run.party.iter().map(|m| serde_json::json!({
                    "c": m.char_id, "hp": m.hp, "mhp": m.max_hp,
                    "o": m.owned_skill_ids, "a": m.active_skill_ids,
                    "eq": serde_json::to_value(&m.equipped).unwrap()
                })).collect::<Vec<_>>()
            });
            assert_eq!(canonical_json(&summary), reference[seed.to_string()].as_str().unwrap(), "seed {} 풀 런 최종상태 TS 바이트동일", seed);
        }
    }
}
