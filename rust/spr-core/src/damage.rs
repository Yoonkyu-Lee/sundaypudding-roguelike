//! 데미지 계산·적용 (TS `combat/damage.ts`). 정수(zero-f64). 패시브 훅(damaged/dealtDamage/death/kill) 발화.
use crate::passives::{fire_trigger, TriggerCtx};
use crate::util::{has_status, round_div, stat_mod, status_flag, status_num_sum, total_stacks, StatusDefs};
use spr_types::combat::{GameEvent, GameState};
use spr_types::skills::Skill;
use std::collections::HashMap;

/// 데미지 계산: (base + 무기 + 합연산) × 동상% × crit%, 단일 정수 반올림. TS computeDamage.
pub fn compute_damage(actor: &spr_types::combat::Unit, base: i64, crit: bool, defs: &StatusDefs) -> i64 {
    let flat = base + actor.equip_dmg_flat + status_num_sum(actor, "dmgDealtFlat", defs);
    let frost_pct = if has_status(actor, "frost") {
        defs.get("frost").and_then(|d| d.damage_dealt_mult).unwrap_or(100)
    } else {
        100
    };
    let crit_pct = if crit {
        actor.crit_multiplier + stat_mod(actor, "critMultiplier") + status_num_sum(actor, "critMultiplierAdd", defs)
    } else {
        100
    };
    round_div(flat * frost_pct * crit_pct, 10000)
}

/// 쉴드→HP 피해 적용(공포 잠식·관통·불사·무적) + damage/death 이벤트 + 패시브 훅. TS dealRawDamage.
pub fn deal_raw_damage(
    state: &mut GameState,
    target_idx: usize,
    final_amount: i64,
    ignore_shield: bool,
    attacker_uid: Option<&str>,
    crit: Option<bool>,
    defs: &StatusDefs,
    skills: &HashMap<String, Skill>,
) {
    {
        let t = &state.units[target_idx];
        if !t.alive || final_amount <= 0 {
            return;
        }
        if status_flag(t, "invincible", defs) {
            let uid = t.uid.clone();
            state.log.push(GameEvent::Damage { target_uid: uid, base: final_amount, final_: 0, to_shield: 0, to_hp: 0 });
            return;
        }
    }
    let mut remaining = final_amount;
    let mut to_shield = 0;
    {
        let t = &state.units[target_idx];
        if !ignore_shield && t.shield > 0 {
            let fear_n = total_stacks(t, "fear");
            let mult = fear_n.max(1);
            let absorbable = t.shield / mult; // floor
            let absorbed = remaining.min(absorbable);
            to_shield = absorbed * mult;
            remaining -= absorbed;
        }
    }
    let to_hp = remaining;
    let (died, uid) = {
        let t = &mut state.units[target_idx];
        t.shield -= to_shield;
        t.hp = (t.hp - to_hp).max(0);
        let mut saved = false;
        if t.hp <= 0 && has_status(t, "undying") {
            t.hp = 1;
            saved = true;
        }
        (t.hp <= 0 && !saved, t.uid.clone())
    };
    state.log.push(GameEvent::Damage { target_uid: uid.clone(), base: final_amount, final_: final_amount, to_shield, to_hp });
    if died {
        state.units[target_idx].alive = false;
        state.log.push(GameEvent::Death { uid: uid.clone() });
    }
    // 패시브 훅: 피격(피해자) / 가해(가해자) / 사망 / 처치. 순서 = TS.
    let a = attacker_uid.map(|s| s.to_string());
    let mut t1 = TriggerCtx::new("damaged");
    t1.subject_uid = Some(uid.clone());
    t1.attacker_uid = a.clone();
    t1.damage = Some(final_amount);
    t1.crit = crit;
    fire_trigger(state, t1, defs, skills);
    if let Some(au) = &a {
        let mut t2 = TriggerCtx::new("dealtDamage");
        t2.attacker_uid = Some(au.clone());
        t2.subject_uid = Some(uid.clone());
        t2.damage = Some(final_amount);
        t2.crit = crit;
        fire_trigger(state, t2, defs, skills);
    }
    if died {
        let mut t3 = TriggerCtx::new("death");
        t3.subject_uid = Some(uid.clone());
        t3.attacker_uid = a.clone();
        fire_trigger(state, t3, defs, skills);
        if let Some(au) = &a {
            let mut t4 = TriggerCtx::new("kill");
            t4.attacker_uid = Some(au.clone());
            t4.subject_uid = Some(uid.clone());
            fire_trigger(state, t4, defs, skills);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;
    use spr_types::combat::StatusInstance;

    fn defs() -> StatusDefs {
        spr_data::status_defs()
    }
    fn st(def_id: &str, stacks: i64) -> StatusInstance {
        StatusInstance { def_id: def_id.into(), stacks, duration: 3, source_uid: "x".into(), source_skill_id: None }
    }

    #[test]
    fn compute_damage_parity() {
        let d = defs();
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let mut s = create_battle(1, &enc, &chars);
        let kim = s.units.iter().position(|u| u.uid == "a0_kim").unwrap();
        // kim critMultiplier 160. TS 레퍼런스.
        assert_eq!(compute_damage(&s.units[kim], 14, false, &d), 14);
        assert_eq!(compute_damage(&s.units[kim], 14, true, &d), 22);
        assert_eq!(compute_damage(&s.units[kim], 7, true, &d), 11);
        assert_eq!(compute_damage(&s.units[kim], 0, true, &d), 0);
        // frost(50%)
        s.units[kim].statuses.push(st("frost", 1));
        assert_eq!(compute_damage(&s.units[kim], 14, false, &d), 7);
        assert_eq!(compute_damage(&s.units[kim], 13, false, &d), 7);
        assert_eq!(compute_damage(&s.units[kim], 14, true, &d), 11);
        // edge(critMultAdd 50 → 210), frost 제거
        s.units[kim].statuses.clear();
        s.units[kim].statuses.push(st("edge", 1));
        assert_eq!(compute_damage(&s.units[kim], 14, true, &d), 29);
    }

    #[test]
    fn deal_raw_damage_parity() {
        let d = defs();
        let sk = spr_data::skills();
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let ti = |s: &GameState| s.units.iter().position(|u| u.uid == "e0_thug").unwrap();

        // shield5 dmg8 → 11/0, toShield5 toHp3
        let mut s = create_battle(2, &enc, &chars);
        let i = ti(&s);
        s.units[i].shield = 5;
        deal_raw_damage(&mut s, i, 8, false, None, None, &d, &sk);
        assert_eq!((s.units[i].hp, s.units[i].shield, s.units[i].alive), (11, 0, true));

        // shield5 fear2 dmg8 → 8/1
        let mut s = create_battle(2, &enc, &chars);
        let i = ti(&s);
        s.units[i].shield = 5;
        s.units[i].statuses.push(st("fear", 2));
        deal_raw_damage(&mut s, i, 8, false, None, None, &d, &sk);
        assert_eq!((s.units[i].hp, s.units[i].shield), (8, 1));

        // shield5 pierce dmg8 → 6/5
        let mut s = create_battle(2, &enc, &chars);
        let i = ti(&s);
        s.units[i].shield = 5;
        deal_raw_damage(&mut s, i, 8, true, None, None, &d, &sk);
        assert_eq!((s.units[i].hp, s.units[i].shield), (6, 5));

        // hp14 dmg20 → 0/0 death
        let mut s = create_battle(2, &enc, &chars);
        let i = ti(&s);
        deal_raw_damage(&mut s, i, 20, false, None, None, &d, &sk);
        assert_eq!((s.units[i].hp, s.units[i].alive), (0, false));
        assert!(s.log.iter().any(|e| matches!(e, GameEvent::Death { .. })));

        // invincible dmg20 → 14/0 (불변)
        let mut s = create_battle(2, &enc, &chars);
        let i = ti(&s);
        s.units[i].statuses.push(st("invincible", 1));
        deal_raw_damage(&mut s, i, 20, false, None, None, &d, &sk);
        assert_eq!((s.units[i].hp, s.units[i].alive), (14, true));

        // undying dmg20 → 1/0, no death
        let mut s = create_battle(2, &enc, &chars);
        let i = ti(&s);
        s.units[i].statuses.push(st("undying", 1));
        deal_raw_damage(&mut s, i, 20, false, None, None, &d, &sk);
        assert_eq!((s.units[i].hp, s.units[i].alive), (1, true));
        assert!(!s.log.iter().any(|e| matches!(e, GameEvent::Death { .. })));
    }
}
