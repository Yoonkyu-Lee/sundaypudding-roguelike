//! 전투 생성 + 턴 서열 (TS `combat/state.ts` + `turnOrder.ts`). P1-9 sub-slice: createBattle→roundStart→첫 turnStart.
//! 후속: damage·status·skills·passives·flow. 현재는 첫 정규 턴 진입까지(이벤트: roundStart, turnStart).
use spr_types::combat::{GameEvent, GameState, QueueEntry, SpeedRoll, Unit};
use spr_types::data::{Character, Encounter, Pos};
use spr_types::rng::Rng;
use std::collections::HashMap;

const ACTION_CONST: i64 = 10000;

/// 캐릭터 → 전투 유닛(기본 — growth/장착 없음). uid = `${side[0]}${idx}_${charId}` (TS makeUnit).
pub fn make_unit(c: &Character, side: &str, idx: usize, pos: Pos) -> Unit {
    Unit {
        uid: format!("{}{}_{}", &side[..1], idx, c.id),
        side: side.to_string(),
        char_id: c.id.clone(),
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
        active_skill_ids: c.skill_ids.iter().take(4).cloned().collect(),
        cooldowns: HashMap::new(),
        statuses: Vec::new(),
        alive: true,
        stat_mods: HashMap::new(),
        turn_count: 0,
        equip_dmg_flat: 0,
        equip_shield_gain_add: 0,
    }
}

fn stat_mod(u: &Unit, key: &str) -> i64 {
    *u.stat_mods.get(key).unwrap_or(&0)
}

/// 상태 speedMod 합산. (상태이상 슬라이스서 status defs 합산으로 확장 — 현재 statuses 없음→0)
fn status_speed_mod(u: &Unit) -> i64 {
    let _ = u;
    0
}

pub fn create_battle(seed: u32, enc: &Encounter, chars: &HashMap<String, Character>) -> GameState {
    let mut units = Vec::new();
    for (i, p) in enc.allies.iter().enumerate() {
        units.push(make_unit(&chars[&p.char_id], "ally", i, p.pos));
    }
    for (i, p) in enc.enemies.iter().enumerate() {
        units.push(make_unit(&chars[&p.char_id], "enemy", i, p.pos));
    }
    let mut state = GameState {
        rng: Rng::new(seed),
        round: 0,
        units,
        round_order: Vec::new(),
        cursor: -1,
        current: None,
        phase: "inProgress".to_string(),
        log: Vec::new(),
        fire_depth: 0,
        fire_active_keys: Vec::new(),
    };
    start_round(&mut state);
    state
}

/// 라운드 시작: SPD 주사위(유닛 순서대로 rng 소비) + 서열 정렬 + roundStart 이벤트 + advance.
pub fn start_round(state: &mut GameState) {
    state.round += 1;
    let mut rolls: Vec<SpeedRoll> = Vec::new();
    let alive: Vec<usize> = state.units.iter().enumerate().filter(|(_, u)| u.alive).map(|(i, _)| i).collect();
    for i in alive {
        let (s_min, s_max, speed_mod) = {
            let u = &state.units[i];
            let s_min = u.speed_min + stat_mod(u, "speedMin");
            let s_max = (u.speed_max + stat_mod(u, "speedMax")).max(s_min);
            (s_min, s_max, status_speed_mod(u))
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
    // applySpeedRollPassives — 패시브 슬라이스서(현재 speedRoll 패시브 없음).
    let mut entries: Vec<QueueEntry> = rolls
        .iter()
        .map(|r| QueueEntry { uid: r.uid.clone(), kind: "normal".to_string(), speed: r.speed })
        .collect();
    // 서열 = ACTION_CONST/speed 오름차순(=speed 내림차순), 동점 uid 사전순. 정수 동치 비교(부동소수 회피).
    let _ = ACTION_CONST;
    entries.sort_by(|a, b| b.speed.cmp(&a.speed).then_with(|| a.uid.cmp(&b.uid)));
    state.round_order = entries.clone();
    state.cursor = -1;
    state.log.push(GameEvent::RoundStart { round: state.round, order: entries, rolls });
    // fireTrigger(roundStart) — 패시브 슬라이스서.
    advance(state);
}

/// 커서 전진: 죽은 유닛 스킵, current 설정 + turnStart, 정규 턴이면 onNormalTurnStart.
pub fn advance(state: &mut GameState) {
    if state.phase != "inProgress" {
        return;
    }
    loop {
        state.cursor += 1;
        if state.cursor >= state.round_order.len() as i64 {
            // 타임라인 소진 → roundEnd + startRound. 전투 진행 슬라이스서 구현.
            return;
        }
        let next = state.round_order[state.cursor as usize].clone();
        let alive = state.units.iter().find(|u| u.uid == next.uid).map(|u| u.alive).unwrap_or(false);
        if !alive {
            continue;
        }
        state.current = Some(next.clone());
        state.log.push(GameEvent::TurnStart { uid: next.uid.clone(), kind: next.kind.clone() });
        if next.kind == "normal" {
            on_normal_turn_start(state, &next.uid);
        }
        // interrupt 분기 / 턴시작 효과로 사망 시 스킵 — 후속.
        return;
    }
}

/// 정규 턴 시작: turnCount++ (+ 쿨다운--·tick·fireTrigger는 후속 슬라이스).
fn on_normal_turn_start(state: &mut GameState, uid: &str) {
    if let Some(u) = state.units.iter_mut().find(|u| u.uid == uid) {
        u.turn_count += 1;
    }
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
        // TS createBattle(42, DEMO).log canonical (추출 레퍼런스)
        let expected = r#"[{"order":[{"kind":"normal","speed":8,"uid":"a2_cho"},{"kind":"normal","speed":7,"uid":"a1_shanghai"},{"kind":"normal","speed":6,"uid":"a0_kim"},{"kind":"normal","speed":5,"uid":"e0_thug"},{"kind":"normal","speed":4,"uid":"e2_thug2"},{"kind":"normal","speed":3,"uid":"e1_thug"}],"rolls":[{"roll":6,"speed":6,"speedMax":7,"speedMin":4,"speedMod":0,"uid":"a0_kim"},{"roll":7,"speed":7,"speedMax":9,"speedMin":6,"speedMod":0,"uid":"a1_shanghai"},{"roll":8,"speed":8,"speedMax":8,"speedMin":5,"speedMod":0,"uid":"a2_cho"},{"roll":5,"speed":5,"speedMax":6,"speedMin":3,"speedMod":0,"uid":"e0_thug"},{"roll":3,"speed":3,"speedMax":6,"speedMin":3,"speedMod":0,"uid":"e1_thug"},{"roll":4,"speed":4,"speedMax":5,"speedMin":2,"speedMod":0,"uid":"e2_thug2"}],"round":1,"t":"roundStart"},{"kind":"normal","t":"turnStart","uid":"a2_cho"}]"#;
        assert_eq!(canonical_json(&state.log), expected, "createBattle 로그가 TS와 바이트 동일해야");
        assert_eq!(state.round, 1);
        assert_eq!(state.cursor, 0);
        assert_eq!(state.current.as_ref().unwrap().uid, "a2_cho");
    }
}
