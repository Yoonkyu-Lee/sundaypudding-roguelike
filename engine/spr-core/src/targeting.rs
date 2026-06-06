//! 타겟팅·면적·합법행동 (TS `combat/targeting.ts`). 위치 마스크·면적 모양·명중·행동 열거.
//! 유닛은 `state.units` 인덱스로 반환(삽입순서 보존 = TS filter 순서와 동일).
use crate::util::{is_frozen, stat_mod, StatusDefs};
use spr_types::combat::{Action, GameState, Unit};
use spr_types::data::Pos;
use spr_types::skills::{AreaShape, Skill};
use std::collections::HashMap;

fn same_pos(a: Pos, b: Pos) -> bool {
    a.row == b.row && a.col == b.col
}

/// 상대 진영("enemy"↔ actor 반대, "ally"=같은 편).
fn target_side(actor: &Unit, target: &str) -> String {
    if target == "enemy" {
        if actor.side == "ally" { "enemy".into() } else { "ally".into() }
    } else {
        actor.side.clone()
    }
}

fn alive_idx(state: &GameState, side: &str) -> Vec<usize> {
    state.units.iter().enumerate().filter(|(_, u)| u.alive && u.side == side).map(|(i, _)| i).collect()
}

/// 도달 가능 열: 최전열(살아있는 측 최소 열)부터 연속 reach칸. TS reachableColumns.
pub fn reachable_columns(state: &GameState, side: &str, reach: i64) -> Vec<i64> {
    let occ: Vec<i64> = alive_idx(state, side).iter().map(|&i| state.units[i].pos.col).collect();
    if occ.is_empty() || reach <= 0 {
        return Vec::new();
    }
    let front = *occ.iter().min().unwrap();
    (front..front + reach).collect()
}

/// 합법 대상 인덱스. self→시전자; reach→전방 점유열; targetCells→마스크. TS validTargets.
pub fn valid_targets(state: &GameState, actor_idx: usize, skill: &Skill) -> Vec<usize> {
    let actor = &state.units[actor_idx];
    if skill.target == "self" {
        return vec![actor_idx];
    }
    let side = target_side(actor, &skill.target);
    let mut cands = alive_idx(state, &side);
    if let Some(reach) = skill.reach {
        let cols: Vec<i64> = reachable_columns(state, &side, reach);
        cands.retain(|&i| cols.contains(&state.units[i].pos.col));
    } else if let Some(cells) = &skill.target_cells {
        if !cells.is_empty() {
            cands.retain(|&i| cells.iter().any(|&c| same_pos(c, state.units[i].pos)));
        }
    }
    cands
}

/// 진영 그리드 크기(배치 기준 최소 4×4). TS sideDims.
pub fn side_dims(state: &GameState, side: &str) -> (i64, i64) {
    let mut rows = 4;
    let mut cols = 4;
    for u in &state.units {
        if u.side != side {
            continue;
        }
        rows = rows.max(u.pos.row + 1);
        cols = cols.max(u.pos.col + 1);
    }
    (rows, cols)
}

/// 면적 모양 → 앵커 기준 영향 칸. TS computeAreaCells.
pub fn compute_area_cells(anchor: Pos, area: Option<&AreaShape>, rows: i64, cols: i64) -> Vec<Pos> {
    let mut cells: Vec<Pos> = Vec::new();
    let mut push = |r: i64, c: i64| {
        if r >= 0 && r < rows && c >= 0 && c < cols {
            cells.push(Pos { row: r, col: c });
        }
    };
    match area {
        None | Some(AreaShape::Single) => push(anchor.row, anchor.col),
        Some(AreaShape::Row) => {
            for c in 0..cols {
                push(anchor.row, c);
            }
        }
        Some(AreaShape::Col) => {
            for r in 0..rows {
                push(r, anchor.col);
            }
        }
        Some(AreaShape::Square { radius }) => {
            let rad = radius.unwrap_or(1);
            for dr in -rad..=rad {
                for dc in -rad..=rad {
                    push(anchor.row + dr, anchor.col + dc);
                }
            }
        }
        Some(AreaShape::Cross { radius }) => {
            let rad = radius.unwrap_or(1);
            push(anchor.row, anchor.col);
            for d in 1..=rad {
                push(anchor.row + d, anchor.col);
                push(anchor.row - d, anchor.col);
                push(anchor.row, anchor.col + d);
                push(anchor.row, anchor.col - d);
            }
        }
        Some(AreaShape::All) => {
            for r in 0..rows {
                for c in 0..cols {
                    push(r, c);
                }
            }
        }
        Some(AreaShape::Free { .. }) => {} // free는 areaTargets에서 freeCells로 처리
    }
    cells
}

/// 면적 스킬 영향 유닛 인덱스. TS areaTargets.
pub fn area_targets(state: &GameState, actor_idx: usize, skill: &Skill, anchor: Pos, free_cells: &[Pos]) -> Vec<usize> {
    let actor = &state.units[actor_idx];
    if skill.target == "self" {
        return vec![actor_idx];
    }
    let side = target_side(actor, &skill.target);
    let units_in = |cells: &[Pos]| -> Vec<usize> {
        state
            .units
            .iter()
            .enumerate()
            .filter(|(_, u)| u.alive && u.side == side && cells.iter().any(|c| c.row == u.pos.row && c.col == u.pos.col))
            .map(|(i, _)| i)
            .collect()
    };
    match &skill.area {
        None | Some(AreaShape::Single) => units_in(&[anchor]),
        Some(AreaShape::All) => valid_targets(state, actor_idx, skill), // 마스크 존중
        Some(AreaShape::Free { .. }) => units_in(free_cells),
        Some(other) => {
            let (rows, cols) = side_dims(state, &side);
            units_in(&compute_area_cells(anchor, Some(other), rows, cols))
        }
    }
}

/// 명중% (필중/비적대=100). TS computeHitChance.
pub fn compute_hit_chance(actor: &Unit, skill: &Skill, target: &Unit) -> i64 {
    if skill.always_hit || skill.target != "enemy" {
        return 100;
    }
    (actor.accuracy + stat_mod(actor, "accuracy") + skill.accuracy - (target.evasion + stat_mod(target, "evasion"))).clamp(0, 100)
}

/// 합법 행동 열거(스킬+대상 / 스킵). 빙결=스킵만. TS getLegalActions.
/// Rust는 재생 전용이라 자가생성 안 함 — 이건 parity/검증용. label/skillName(UI)은 생략.
pub fn get_legal_actions(state: &GameState, skills: &HashMap<String, Skill>, defs: &StatusDefs) -> Vec<Action> {
    if state.phase != "inProgress" {
        return Vec::new();
    }
    let cur = match &state.current {
        Some(c) => c.clone(),
        None => return Vec::new(),
    };
    let actor_idx = match state.units.iter().position(|u| u.uid == cur.uid) {
        Some(i) => i,
        None => return Vec::new(),
    };
    if is_frozen(&state.units[actor_idx], defs) {
        return vec![Action::Skip];
    }
    let mut out: Vec<Action> = Vec::new();
    let actor = &state.units[actor_idx];
    for skill_id in &actor.active_skill_ids {
        let skill = match skills.get(skill_id) {
            Some(s) => s,
            None => continue,
        };
        if !skill.active {
            continue;
        }
        if *actor.cooldowns.get(skill_id).unwrap_or(&0) > 0 {
            continue;
        }
        if let Some(uf) = &skill.usable_from {
            if !uf.is_empty() && !uf.iter().any(|&c| same_pos(c, actor.pos)) {
                continue;
            }
        }
        let targets = valid_targets(state, actor_idx, skill);
        if targets.is_empty() {
            continue;
        }
        for ti in targets {
            out.push(Action::Skill {
                skill_id: skill_id.clone(),
                target_uid: Some(state.units[ti].uid.clone()),
                target_cell: None,
                cells: None,
            });
        }
    }
    if out.is_empty() {
        return vec![Action::Skip];
    }
    out.push(Action::Skip); // 자발적 대기
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::create_battle;

    // TS 레퍼런스(createBattle(42,DEMO)): validTargets/reachableColumns/hitChance 추출값.
    fn uids(state: &GameState, idxs: &[usize]) -> Vec<String> {
        idxs.iter().map(|&i| state.units[i].uid.clone()).collect()
    }

    #[test]
    fn targeting_parity() {
        let chars = spr_data::characters();
        let enc = spr_data::demo_encounter();
        let skills = spr_data::skills();
        let defs = spr_data::status_defs();
        let s = create_battle(42, &enc, &chars);
        let kim = s.units.iter().position(|u| u.uid == "a0_kim").unwrap();

        // reach 1(enemy)=[0], reach 2=[0,1]
        assert_eq!(reachable_columns(&s, "enemy", 1), vec![0]);
        assert_eq!(reachable_columns(&s, "enemy", 2), vec![0, 1]);

        // kim_punch(enemy,reach1) → e0_thug,e1_thug (순서 보존)
        assert_eq!(uids(&s, &valid_targets(&s, kim, &skills["kim_punch"])), vec!["e0_thug", "e1_thug"]);
        // kim_oyabun(self) → a0_kim
        assert_eq!(uids(&s, &valid_targets(&s, kim, &skills["kim_oyabun"])), vec!["a0_kim"]);
        // kim_4dollar(ally) → a0_kim,a1_shanghai,a2_cho
        assert_eq!(uids(&s, &valid_targets(&s, kim, &skills["kim_4dollar"])), vec!["a0_kim", "a1_shanghai", "a2_cho"]);

        // hitChance kim_punch→e0_thug = 84
        let thug = s.units.iter().position(|u| u.uid == "e0_thug").unwrap();
        assert_eq!(compute_hit_chance(&s.units[kim], &skills["kim_punch"], &s.units[thug]), 84);
        // 비적대(self) = 100
        assert_eq!(compute_hit_chance(&s.units[kim], &skills["kim_oyabun"], &s.units[kim]), 100);

        // 합법행동: kim 턴 → Skill 다수 + Skip 1
        let mut s2 = create_battle(42, &enc, &chars);
        s2.current = Some(spr_types::combat::QueueEntry { uid: "a0_kim".into(), kind: "normal".into(), speed: 6 });
        let acts = get_legal_actions(&s2, &skills, &defs);
        assert!(matches!(acts.last(), Some(Action::Skip)));
        assert!(acts.iter().filter(|a| matches!(a, Action::Skill { .. })).count() >= 4);
    }

    #[test]
    fn area_cells_shapes() {
        let anchor = Pos { row: 1, col: 1 };
        assert_eq!(compute_area_cells(anchor, None, 4, 4), vec![Pos { row: 1, col: 1 }]);
        assert_eq!(compute_area_cells(anchor, Some(&AreaShape::Row), 4, 4).len(), 4);
        assert_eq!(compute_area_cells(anchor, Some(&AreaShape::Col), 4, 4).len(), 4);
        assert_eq!(compute_area_cells(anchor, Some(&AreaShape::All), 4, 4).len(), 16);
        // cross radius1 = 앵커+직교4 = 5
        assert_eq!(compute_area_cells(anchor, Some(&AreaShape::Cross { radius: Some(1) }), 4, 4).len(), 5);
        // square radius1 중심(1,1) = 3×3 = 9
        assert_eq!(compute_area_cells(anchor, Some(&AreaShape::Square { radius: Some(1) }), 4, 4).len(), 9);
        // 모서리 square는 클램프
        assert_eq!(compute_area_cells(Pos { row: 0, col: 0 }, Some(&AreaShape::Square { radius: Some(1) }), 4, 4).len(), 4);
    }
}
