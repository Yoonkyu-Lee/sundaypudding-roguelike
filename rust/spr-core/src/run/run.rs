//! 런 흐름 — 생성 + 비전투 파티 편성 (TS `core/run/run.ts` 일부). 노드 진입/시퀀서/보상은 P2-3+.
use super::types::RunState;
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
}
