//! 데미지/HP 미리보기 (TS `combat/damage.ts` preview*). 순수(rng 미사용) — 타겟팅 UI용. 결정론.
use crate::damage::compute_damage;
use crate::formation::get_formation_bonus;
use crate::util::{has_status, total_stacks, StatusDefs};
use serde::Serialize;
use spr_types::combat::{GameState, Unit};
use spr_types::skills::{Skill, SkillEffect};

/// 데미지 미리보기(비크리). TS previewDamage.
pub fn preview_damage(state: &GameState, actor: &Unit, skill: &Skill, defs: &StatusDefs) -> i64 {
    let mut total = 0;
    for eff in &skill.effects {
        if let SkillEffect::Damage { amount } = eff {
            let atk = get_formation_bonus(state, actor, "attackPower");
            let up = *actor.skill_dmg_bonus.get(&skill.id).unwrap_or(&0);
            total += compute_damage(actor, amount + atk + up, false, defs);
        }
    }
    total
}

#[derive(Serialize)]
pub struct DmgPart {
    pub label: String,
    pub amount: i64,
}
#[derive(Serialize)]
pub struct DmgParts {
    pub total: i64,
    pub parts: Vec<DmgPart>,
}

/// 데미지 분해(자세히보기). TS previewDamageParts. 데미지 스킬 아니면 None.
pub fn preview_damage_parts(state: &GameState, actor: &Unit, skill: &Skill, defs: &StatusDefs) -> Option<DmgParts> {
    let n = skill.effects.iter().filter(|e| matches!(e, SkillEffect::Damage { .. })).count() as i64;
    if n == 0 {
        return None;
    }
    let base: i64 = skill.effects.iter().filter_map(|e| if let SkillEffect::Damage { amount } = e { Some(*amount) } else { None }).sum();
    let atk = get_formation_bonus(state, actor, "attackPower") * n;
    let up = *actor.skill_dmg_bonus.get(&skill.id).unwrap_or(&0) * n;
    let weapon = actor.equip_dmg_flat * n;
    let status = crate::util::status_num_sum(actor, "dmgDealtFlat", defs) * n;
    let mut parts = vec![DmgPart { label: "기본".into(), amount: base }];
    if atk != 0 {
        parts.push(DmgPart { label: "포메이션".into(), amount: atk });
    }
    if up != 0 {
        parts.push(DmgPart { label: "강화".into(), amount: up });
    }
    if weapon != 0 {
        parts.push(DmgPart { label: "무기".into(), amount: weapon });
    }
    if status != 0 {
        parts.push(DmgPart { label: if status > 0 { "공위증".into() } else { "약화".into() }, amount: status });
    }
    if has_status(actor, "frost") {
        parts.push(DmgPart { label: "동상".into(), amount: 0 });
    }
    Some(DmgParts { total: preview_damage(state, actor, skill, defs), parts })
}

#[derive(Serialize)]
pub struct HpLoss {
    #[serde(rename = "hpLoss")]
    pub hp_loss: i64,
    #[serde(rename = "shieldConsumed")]
    pub shield_consumed: i64,
}

/// 관통/쉴드/공포 고려 HP 손실 미리보기. TS previewHpLoss.
pub fn preview_hp_loss(state: &GameState, attacker: &Unit, skill: &Skill, target: &Unit, defs: &StatusDefs) -> HpLoss {
    let dmg = preview_damage(state, attacker, skill, defs);
    if has_status(attacker, "pierce") {
        return HpLoss { hp_loss: dmg.min(target.hp), shield_consumed: 0 };
    }
    let mult = total_stacks(target, "fear").max(1);
    let absorbable = target.shield / mult;
    let absorbed = dmg.min(absorbable);
    HpLoss { hp_loss: target.hp.min(dmg - absorbed), shield_consumed: absorbed * mult }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;

    #[test]
    fn preview_parity() {
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        let enc = spr_data::demo_encounter();
        let s = create_battle(42, &enc, &chars);
        let kim_i = s.units.iter().position(|u| u.uid == "a0_kim").unwrap();
        let thug_i = s.units.iter().position(|u| u.uid == "e0_thug").unwrap();
        // TS 추출: previewDamage(kim,kim_punch)=18, previewHpLoss→thug = {14,0}, 쉴드10이면 {8,10}.
        assert_eq!(preview_damage(&s, &s.units[kim_i], &skills["kim_punch"], &defs), 18);
        let hl = preview_hp_loss(&s, &s.units[kim_i], &skills["kim_punch"], &s.units[thug_i], &defs);
        assert_eq!((hl.hp_loss, hl.shield_consumed), (14, 0));
        let mut s2 = create_battle(42, &enc, &chars);
        s2.units[thug_i].shield = 10;
        let hl2 = preview_hp_loss(&s2, &s2.units[kim_i], &skills["kim_punch"], &s2.units[thug_i], &defs);
        assert_eq!((hl2.hp_loss, hl2.shield_consumed), (8, 10));
        let parts = preview_damage_parts(&s, &s.units[kim_i], &skills["kim_punch"], &defs).unwrap();
        assert_eq!(parts.total, 18);
    }
}
