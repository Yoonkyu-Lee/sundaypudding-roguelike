//! 전투 생성 + 턴 서열 (TS `combat/state.ts` + `turnOrder.ts` + `winCheck.ts`).
//! createBattle→battleStart→startRound(speedRoll패시브·roundStart)→advance(turnStart·tick·turnStart/everyNTurns 패시브).
use crate::passives::compile::compile_rules;
use crate::passives::{apply_speed_roll_passives, fire_trigger, on_unit_turn_start, TriggerCtx};
use crate::status::tick_periodic;
use crate::util::{stat_mod, status_num_sum, StatusDefs};
use spr_types::combat::{GameEvent, GameState, QueueEntry, SpeedRoll, Unit};
use spr_types::data::{Character, Encounter, Pos};
use spr_types::passives::TraitDef;
use spr_types::rng::Rng;
use spr_types::skills::Skill;
use std::collections::HashMap;

/// 캐릭터 → 전투 유닛(기본 — growth/장착 없음). uid = `${side[0]}${idx}_${charId}` (TS makeUnit). 룰 컴파일 포함.
pub fn make_unit(
    c: &Character,
    side: &str,
    idx: usize,
    pos: Pos,
    chars: &HashMap<String, Character>,
    skills: &HashMap<String, Skill>,
    traits: &HashMap<String, TraitDef>,
) -> Unit {
    let active_skill_ids: Vec<String> = c.skill_ids.iter().take(4).cloned().collect();
    let rules = compile_rules(&c.id, &active_skill_ids, chars, skills, traits);
    Unit {
        uid: format!("{}{}_{}", &side[..1], idx, c.id),
        side: side.to_string(),
        char_id: c.id.clone(),
        name: c.name.clone(),
        pos,
        hp_max: c.hp,
        hp: c.hp,
        shield: 0,
        speed_min: c.speed_min,
        speed_max: c.speed_max,
        evasion: c.evasion,
        accuracy: c.accuracy,
        crit_chance: c.crit_chance,
        crit_multiplier: c.crit_multiplier,
        active_skill_ids,
        cooldowns: HashMap::new(),
        statuses: Vec::new(),
        alive: true,
        stat_mods: HashMap::new(),
        turn_count: 0,
        skill_dmg_bonus: HashMap::new(),
        rules,
        equip_dmg_flat: 0,
        equip_shield_gain_add: 0,
    }
}

pub fn create_battle(seed: u32, enc: &Encounter, chars: &HashMap<String, Character>) -> GameState {
    let skills = spr_data::skills();
    let traits = spr_data::traits();
    let defs = spr_data::status_defs();
    create_battle_with(seed, enc, chars, &skills, &traits, &defs)
}

/// 데이터 맵 주입형(differential 드라이버·step 재사용 — JSON 재파싱 회피).
pub fn create_battle_with(
    seed: u32,
    enc: &Encounter,
    chars: &HashMap<String, Character>,
    skills: &HashMap<String, Skill>,
    traits: &HashMap<String, TraitDef>,
    defs: &StatusDefs,
) -> GameState {
    let mut units = Vec::new();
    for (i, p) in enc.allies.iter().enumerate() {
        units.push(make_unit(&chars[&p.char_id], "ally", i, p.pos, chars, skills, traits));
    }
    for (i, p) in enc.enemies.iter().enumerate() {
        units.push(make_unit(&chars[&p.char_id], "enemy", i, p.pos, chars, skills, traits));
    }
    let std = spr_data::standard_formation();
    let mut state = GameState {
        rng: Rng::new(seed),
        round: 0,
        units,
        round_order: Vec::new(),
        cursor: -1,
        current: None,
        phase: "inProgress".to_string(),
        log: Vec::new(),
        ally_formation: Some(std.clone()),
        enemy_formation: if enc.boss { Some(std) } else { None },
        fire_depth: 0,
        fire_active_keys: Vec::new(),
    };
    fire_trigger(&mut state, TriggerCtx::new("battleStart"), defs, skills);
    start_round(&mut state, defs, skills);
    state
}

/// 승패 판정 (TS checkWin). battleEnd 이벤트 + 패시브 훅. true=전투 종료.
pub fn check_win(state: &mut GameState, defs: &StatusDefs, skills: &HashMap<String, Skill>) -> bool {
    if state.phase != "inProgress" {
        return true;
    }
    let allies = state.units.iter().filter(|u| u.alive && u.side == "ally").count();
    let enemies = state.units.iter().filter(|u| u.alive && u.side == "enemy").count();
    if enemies == 0 {
        state.phase = "allyWin".into();
        state.log.push(GameEvent::BattleEnd { phase: "allyWin".into() });
        let mut t = TriggerCtx::new("battleEnd");
        t.winner_side = Some("ally".into());
        fire_trigger(state, t, defs, skills);
        return true;
    }
    if allies == 0 {
        state.phase = "enemyWin".into();
        state.log.push(GameEvent::BattleEnd { phase: "enemyWin".into() });
        let mut t = TriggerCtx::new("battleEnd");
        t.winner_side = Some("enemy".into());
        fire_trigger(state, t, defs, skills);
        return true;
    }
    false
}

/// 라운드 시작: SPD 주사위(유닛 순서대로 rng) + speedRoll 패시브 + 서열 정렬 + roundStart 이벤트/훅 + advance. TS startRound.
pub fn start_round(state: &mut GameState, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    state.round += 1;
    let alive: Vec<usize> = state.units.iter().enumerate().filter(|(_, u)| u.alive).map(|(i, _)| i).collect();
    let mut rolls: Vec<SpeedRoll> = Vec::new();
    for i in alive {
        let (s_min, s_max, speed_mod) = {
            let u = &state.units[i];
            let s_min = u.speed_min + stat_mod(u, "speedMin");
            let s_max = (u.speed_max + stat_mod(u, "speedMax")).max(s_min);
            (s_min, s_max, status_num_sum(u, "speedMod", defs))
        };
        let roll = state.rng.int(s_min, s_max);
        rolls.push(SpeedRoll {
            uid: state.units[i].uid.clone(),
            speed_min: s_min,
            speed_max: s_max,
            roll,
            speed_mod,
            speed: (roll + speed_mod).max(1),
        });
    }
    apply_speed_roll_passives(state, &mut rolls);
    let mut entries: Vec<QueueEntry> = rolls.iter().map(|r| QueueEntry { uid: r.uid.clone(), kind: "normal".to_string(), speed: r.speed }).collect();
    // 서열 = ACTION_CONST/speed 오름차순(=speed 내림차순), 동점 uid 사전순. 정수 동치(부동소수 회피).
    entries.sort_by(|a, b| b.speed.cmp(&a.speed).then_with(|| a.uid.cmp(&b.uid)));
    state.round_order = entries.clone();
    state.cursor = -1;
    state.log.push(GameEvent::RoundStart { round: state.round, order: entries, rolls });
    fire_trigger(state, TriggerCtx::new("roundStart"), defs, skills);
    advance(state, defs, skills);
}

/// 커서 전진: 죽은 유닛 스킵, current + turnStart, 정규=onNormalTurnStart / 끼어들기=interruptStart. 끝이면 roundEnd+새 라운드. TS advance.
pub fn advance(state: &mut GameState, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    if state.phase != "inProgress" {
        return;
    }
    loop {
        state.cursor += 1;
        if state.cursor >= state.round_order.len() as i64 {
            fire_trigger(state, TriggerCtx::new("roundEnd"), defs, skills);
            if state.phase != "inProgress" {
                return;
            }
            start_round(state, defs, skills);
            return;
        }
        let next = state.round_order[state.cursor as usize].clone();
        let u_idx = match state.units.iter().position(|u| u.uid == next.uid) {
            Some(i) => i,
            None => continue,
        };
        if !state.units[u_idx].alive {
            continue;
        }
        state.current = Some(next.clone());
        state.log.push(GameEvent::TurnStart { uid: next.uid.clone(), kind: next.kind.clone() });
        if next.kind == "normal" {
            on_normal_turn_start(state, u_idx, defs, skills);
        } else {
            let mut t = TriggerCtx::new("interruptStart");
            t.subject_uid = Some(next.uid.clone());
            fire_trigger(state, t, defs, skills);
        }
        if !state.units[u_idx].alive {
            state.current = None;
            if check_win(state, defs, skills) {
                return;
            }
            continue;
        }
        return;
    }
}

/// 정규 턴 시작: 카운터++·턴당리셋 + 쿨다운-- + tickPeriodic(turnStart) + turnStart/everyNTurns 훅 + checkWin. TS onNormalTurnStart.
fn on_normal_turn_start(state: &mut GameState, unit_idx: usize, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    on_unit_turn_start(state, unit_idx);
    let ids: Vec<String> = state.units[unit_idx].cooldowns.keys().cloned().collect();
    for id in ids {
        let v = state.units[unit_idx].cooldowns.get_mut(&id).unwrap();
        if *v > 0 {
            *v -= 1;
        }
    }
    tick_periodic(state, unit_idx, "turnStart", defs, skills);
    let uid = state.units[unit_idx].uid.clone();
    let mut t1 = TriggerCtx::new("turnStart");
    t1.subject_uid = Some(uid.clone());
    fire_trigger(state, t1, defs, skills);
    let mut t2 = TriggerCtx::new("everyNTurns");
    t2.subject_uid = Some(uid);
    fire_trigger(state, t2, defs, skills);
    check_win(state, defs, skills);
}

/// 정규 턴 종료: tickPeriodic(turnEnd) + turnEnd 훅 + 지속시간 차감. TS onNormalTurnEnd. (step에서 호출 — 9h)
pub fn on_normal_turn_end(state: &mut GameState, unit_idx: usize, defs: &StatusDefs, skills: &HashMap<String, Skill>) {
    if state.units[unit_idx].alive {
        tick_periodic(state, unit_idx, "turnEnd", defs, skills);
    }
    if state.units[unit_idx].alive {
        let uid = state.units[unit_idx].uid.clone();
        let mut t = TriggerCtx::new("turnEnd");
        t.subject_uid = Some(uid);
        fire_trigger(state, t, defs, skills);
    }
    let u = &mut state.units[unit_idx];
    for s in &mut u.statuses {
        s.duration -= 1;
    }
    u.statuses.retain(|s| s.duration > 0 && s.stacks > 0);
}

#[cfg(test)]
mod tests {
    use super::*;
    use spr_types::canonical::canonical_json;

    #[test]
    fn parity_create_battle_demo_seed42() {
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let state = create_battle(42, &enc, &chars);
        // TS createBattle(42, DEMO).log canonical (패시브 전체 활성 — 데모는 battleStart/roundStart/turnStart 이벤트 무발생).
        let expected = r#"[{"order":[{"kind":"normal","speed":8,"uid":"a2_cho"},{"kind":"normal","speed":7,"uid":"a1_shanghai"},{"kind":"normal","speed":6,"uid":"a0_kim"},{"kind":"normal","speed":5,"uid":"e0_thug"},{"kind":"normal","speed":4,"uid":"e2_thug2"},{"kind":"normal","speed":3,"uid":"e1_thug"}],"rolls":[{"roll":6,"speed":6,"speedMax":7,"speedMin":4,"speedMod":0,"uid":"a0_kim"},{"roll":7,"speed":7,"speedMax":9,"speedMin":6,"speedMod":0,"uid":"a1_shanghai"},{"roll":8,"speed":8,"speedMax":8,"speedMin":5,"speedMod":0,"uid":"a2_cho"},{"roll":5,"speed":5,"speedMax":6,"speedMin":3,"speedMod":0,"uid":"e0_thug"},{"roll":3,"speed":3,"speedMax":6,"speedMin":3,"speedMod":0,"uid":"e1_thug"},{"roll":4,"speed":4,"speedMax":5,"speedMin":2,"speedMod":0,"uid":"e2_thug2"}],"round":1,"t":"roundStart"},{"kind":"normal","t":"turnStart","uid":"a2_cho"}]"#;
        assert_eq!(canonical_json(&state.log), expected, "createBattle 로그가 TS와 바이트 동일해야");
        assert_eq!(state.round, 1);
        assert_eq!(state.cursor, 0);
        assert_eq!(state.current.as_ref().unwrap().uid, "a2_cho");
        // kim은 특성 룰 컴파일됨(bloodlust/warspirit + kim_punch passive).
        let kim = state.units.iter().find(|u| u.uid == "a0_kim").unwrap();
        assert!(!kim.rules.is_empty(), "kim 룰 컴파일");
    }
}
