//! 포메이션 열보너스 — 총량보존(같은 열 유닛 수로 정수 분배). TS `combat/formation.ts` (6.1).
//! 몫(floor) + 나머지를 uid 오름차순 +1 → 합 == total 정확 보존. 결정론=uid 정렬.
use spr_types::combat::{GameState, Unit};

pub fn get_formation_bonus(state: &GameState, unit: &Unit, kind: &str) -> i64 {
    let layout = if unit.side == "ally" { &state.ally_formation } else { &state.enemy_formation };
    let layout = match layout {
        Some(l) => l,
        None => return 0,
    };
    let total = layout.columns.get(unit.pos.col as usize).and_then(|c| c.get(kind)).copied().unwrap_or(0);
    if total == 0 {
        return 0;
    }
    // 같은 열·편·생존 유닛(자신 포함) uid 오름차순.
    let mut peers: Vec<&str> = state
        .units
        .iter()
        .filter(|u| u.alive && u.side == unit.side && u.pos.col == unit.pos.col)
        .map(|u| u.uid.as_str())
        .collect();
    peers.sort_unstable();
    let count = peers.len() as i64;
    if count == 0 {
        return 0;
    }
    let base = total.div_euclid(count); // floor (음수 total도 나머지 0..count-1)
    let rem = total - base * count;
    let rank = peers.iter().position(|&u| u == unit.uid).unwrap() as i64;
    base + if rank < rem { 1 } else { 0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;

    #[test]
    fn formation_parity() {
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let s = create_battle(42, &enc, &chars);
        // 적은 비보스 → enemy_formation None → 0
        let thug = s.units.iter().find(|u| u.uid == "e0_thug").unwrap();
        assert_eq!(get_formation_bonus(&s, thug, "attackPower"), 0);
        // 아군 STANDARD: col0/1=atk4, col2/3=def4. 열당 유닛수로 분배.
        // 합=total 보존 검증: 각 열 아군 보너스 합이 그 열 total과 같아야.
        for col in 0..4i64 {
            let kind = if col < 2 { "attackPower" } else { "defensePower" };
            let peers: Vec<&Unit> = s.units.iter().filter(|u| u.side == "ally" && u.pos.col == col && u.alive).collect();
            if peers.is_empty() {
                continue;
            }
            let sum: i64 = peers.iter().map(|u| get_formation_bonus(&s, u, kind)).sum();
            assert_eq!(sum, 4, "col {} {} 분배합", col, kind);
        }
    }
}
