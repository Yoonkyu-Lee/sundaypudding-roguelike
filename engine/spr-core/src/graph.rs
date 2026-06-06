//! 헥스 인접 무방향그래프 (TS `run/graph.ts`와 동일 의미). 순수·결정론(rng 미사용).
//! 출력 순서 결정성: neighbor_ids/live_reachable는 edge 순서 보존(Vec). component는 막내 membership만(HashSet 순서 무관).
use spr_types::map::{FloorDef, MapNode, RunDef};
use std::collections::HashSet;

const HEX_DIRS: [(i64, i64); 6] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)];

pub fn hex_adjacent(a: &MapNode, b: &MapNode) -> bool {
    HEX_DIRS.iter().any(|(dq, dr)| a.q + dq == b.q && a.r + dr == b.r)
}

/// 무방향 이웃 id (edge 순서 보존 — 행동 인덱스 결정성). TS neighborIds.
pub fn neighbor_ids(floor: &FloorDef, node_id: &str) -> Vec<String> {
    let mut out = Vec::new();
    for e in &floor.edges {
        if e.from == node_id {
            out.push(e.to.clone());
        } else if e.to == node_id {
            out.push(e.from.clone());
        }
    }
    out
}

pub fn clear_node_ids(floor: &FloorDef) -> Vec<String> {
    floor.nodes.iter().filter(|n| n.node_type == "clear").map(|n| n.id.clone()).collect()
}

fn component(floor: &FloorDef, start: &str, blocked: &HashSet<String>) -> HashSet<String> {
    let mut seen = HashSet::new();
    if blocked.contains(start) {
        return seen;
    }
    let mut stack = vec![start.to_string()];
    while let Some(id) = stack.pop() {
        if seen.contains(&id) {
            continue;
        }
        seen.insert(id.clone());
        for nxt in neighbor_ids(floor, &id) {
            if !seen.contains(&nxt) && !blocked.contains(&nxt) {
                stack.push(nxt);
            }
        }
    }
    seen
}

pub fn reachable_from_entry(floor: &FloorDef) -> HashSet<String> {
    component(floor, &floor.entry_node_id, &HashSet::new())
}

pub fn can_reach_clear(floor: &FloorDef, start: &str, blocked: &HashSet<String>) -> bool {
    let reach = component(floor, start, blocked);
    clear_node_ids(floor).iter().any(|c| reach.contains(c))
}

/// 미방문 이웃 중 방문지 회피로 clear 도달 가능한 것만(edge 순서 보존). TS liveReachable.
pub fn live_reachable(floor: &FloorDef, current: &str, visited: &HashSet<String>) -> Vec<String> {
    neighbor_ids(floor, current)
        .into_iter()
        .filter(|n| !visited.contains(n) && can_reach_clear(floor, n, visited))
        .collect()
}

#[derive(Debug)]
pub struct Validation {
    pub ok: bool,
    pub errors: Vec<String>,
}

pub fn validate_floor(floor: &FloorDef) -> Validation {
    let mut errors = Vec::new();
    let ids: HashSet<&str> = floor.nodes.iter().map(|n| n.id.as_str()).collect();
    if !ids.contains(floor.entry_node_id.as_str()) {
        errors.push(format!("entry 노드 없음: {}", floor.entry_node_id));
    }
    let clears = clear_node_ids(floor);
    if clears.is_empty() {
        errors.push("clear(목표) 노드가 없음".into());
    }
    let node_of = |id: &str| floor.nodes.iter().find(|n| n.id == id);
    for e in &floor.edges {
        let a = node_of(&e.from);
        let b = node_of(&e.to);
        if a.is_none() {
            errors.push(format!("변 끝 미존재: {}", e.from));
        }
        if b.is_none() {
            errors.push(format!("변 끝 미존재: {}", e.to));
        }
        if let (Some(a), Some(b)) = (a, b) {
            if !hex_adjacent(a, b) {
                errors.push(format!("인접하지 않은 변: {}↔{}", e.from, e.to));
            }
        }
    }
    let from_entry = reachable_from_entry(floor);
    if !clears.iter().any(|c| from_entry.contains(c)) {
        errors.push("entry에서 어떤 clear 노드에도 연결 안 됨".into());
    }
    let dead: Vec<&str> = floor.nodes.iter().filter(|n| !from_entry.contains(&n.id)).map(|n| n.id.as_str()).collect();
    if !dead.is_empty() {
        errors.push(format!("고립(연결 안 됨) 노드: {}", dead.join(", ")));
    }
    Validation { ok: errors.is_empty(), errors }
}

pub fn validate_run(run: &RunDef) -> Validation {
    let mut errors = Vec::new();
    for (i, f) in run.floors.iter().enumerate() {
        let v = validate_floor(f);
        if !v.ok {
            errors.push(format!("층 {}({}): {}", i + 1, f.id, v.errors.join("; ")));
        }
    }
    if run.floors.is_empty() {
        errors.push("층이 하나도 없음".into());
        return Validation { ok: false, errors };
    }
    let floor_of = |id: &str| run.floors.iter().find(|f| f.id == id);
    let has_entry = floor_of(&run.entry_floor_id).is_some();
    if !has_entry {
        errors.push(format!("입장 층 없음: {}", run.entry_floor_id));
    }
    let mut reach: HashSet<String> = HashSet::new();
    if has_entry {
        let mut stack = vec![run.entry_floor_id.clone()];
        while let Some(fid) = stack.pop() {
            if reach.contains(&fid) {
                continue;
            }
            reach.insert(fid.clone());
            for n in &floor_of(&fid).unwrap().nodes {
                if n.node_type != "clear" {
                    continue;
                }
                if let Some(tf) = &n.to_floor {
                    if floor_of(tf).is_none() {
                        errors.push(format!("존재하지 않는 다음 층(toFloor): {}", tf));
                    } else if !reach.contains(tf) {
                        stack.push(tf.clone());
                    }
                }
            }
        }
        let has_win = reach.iter().any(|fid| floor_of(fid).unwrap().nodes.iter().any(|n| n.node_type == "clear" && n.to_floor.is_none()));
        if !has_win {
            errors.push("승리(종료) 클리어 노드 없음 — toFloor 없는 clear 1개 이상 필요".into());
        }
    }
    let unreached: Vec<&str> = run.floors.iter().filter(|f| !reach.contains(&f.id)).map(|f| f.id.as_str()).collect();
    if !unreached.is_empty() {
        errors.push(format!("도달 불가 층: {}", unreached.join(", ")));
    }
    Validation { ok: errors.is_empty(), errors }
}

#[cfg(test)]
mod tests {
    use super::*;

    const YAIN: &str = include_str!("../../../web/src/data/runs/yain.json");
    fn yain() -> RunDef {
        serde_json::from_str(YAIN).expect("yain 파싱")
    }
    fn node(q: i64, r: i64) -> MapNode {
        MapNode { id: "x".into(), node_type: "battle".into(), q, r, to_floor: None, label: None, layers: None, core: None }
    }

    #[test]
    fn hex_adjacency() {
        assert!(hex_adjacent(&node(0, 0), &node(1, 0)));
        assert!(hex_adjacent(&node(0, 0), &node(1, -1)));
        assert!(!hex_adjacent(&node(0, 0), &node(2, 0)));
    }

    #[test]
    fn parity_validate_and_reachable() {
        let y = yain();
        assert!(validate_run(&y).ok, "validateRun(yain) ok (TS=true)");
        assert_eq!(y.floors.iter().map(|f| f.id.clone()).collect::<Vec<_>>(), ["f1", "f2", "f3"]);
        let f0 = &y.floors[0];
        assert_eq!(f0.entry_node_id, "f1_entry");
        assert_eq!(clear_node_ids(f0), ["f1_clear"]);
        let mut nbr = neighbor_ids(f0, &f0.entry_node_id);
        nbr.sort();
        assert_eq!(nbr, ["f1_b1", "f1_b2"]); // TS neighborIds
        let visited: HashSet<String> = [f0.entry_node_id.clone()].into_iter().collect();
        let mut lr = live_reachable(f0, &f0.entry_node_id, &visited);
        lr.sort();
        assert_eq!(lr, ["f1_b1", "f1_b2"]); // TS liveReachable
    }
}
