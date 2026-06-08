//! 런 공유 변이 헬퍼 (TS `core/run/helpers.ts`). 노드 조회·파티 회복·즉시 레이어·노드 완료·스킬 변이.
use super::data::RunData;
use super::passives::{fire_run_trigger, RunTriggerCtx};
use super::types::RunState;
use crate::graph::live_reachable;
use crate::util::round_div;
use spr_types::data::{Character, Pos};
use spr_types::map::{FloorDef, Layer};
use spr_types::party::{Equipped, PartyMemberState, PendingStatus};
use std::collections::{HashMap, HashSet};

/// 현재 층 그래프(RunState 단일 진실원).
pub fn cur_floor(run: &RunState) -> &FloorDef {
    &run.run_def.floors[run.floor]
}

/// 노드 조회(없으면 panic — TS throw).
pub fn node<'a>(run: &'a RunState, id: &str) -> &'a spr_types::map::MapNode {
    cur_floor(run).nodes.iter().find(|n| n.id == id).unwrap_or_else(|| panic!("node not found: {}", id))
}

/// 파티 회복. pct=정수퍼센트. revive=true면 전투불능(hp≤0)도 maxHp×pct%로 부활. TS healParty.
pub fn heal_party(run: &mut RunState, pct: i64, revive: bool, d: &RunData) {
    for m in &mut run.party {
        if m.hp <= 0 {
            if revive {
                m.hp = round_div(m.max_hp * pct, 100).max(1);
            }
            continue;
        }
        m.hp = (m.hp + round_div(m.max_hp * pct, 100)).min(m.max_hp);
    }
    let mut ctx = RunTriggerCtx::new("partyHpChange");
    ctx.dir = Some("heal".to_string());
    fire_run_trigger(run, &ctx, d);
}

/// 파티원 1명 생성 — 루트 직업(0차)·learnset 앞4·빈 장비. create_run·partyChange add 공유.
/// pos=진형 배치, mastery_level=숙련도 스냅샷(런 시작은 mastery맵, 런 중 합류는 0).
pub fn build_party_member(char_id: &str, pos: Pos, mastery_level: i64, chars: &HashMap<String, Character>) -> PartyMemberState {
    let c = &chars[char_id];
    let owned: Vec<String> = c.skill_ids.iter().take(4).cloned().collect();
    PartyMemberState {
        char_id: char_id.to_string(),
        pos,
        hp: c.hp,
        max_hp: c.hp,
        skill_dmg_bonus: HashMap::new(),
        owned_skill_ids: owned.clone(),
        active_skill_ids: owned,
        equipped: Equipped::default(),
        mastery_level,
        // 전직(4.7): 합류도 루트 직업(0차)에서 시작 — 차수 0, 부여 패시브 없음.
        job_id: c.root_job_id.clone(),
        class_tier: 0,
        job_trait_ids: Vec::new(),
    }
}

/// 진형 빈 슬롯 탐색 — col(0=전열) 우선, row 순. 점유 칸 회피(진형 충돌 방지). 만석이면 (0,0).
fn empty_slot(party: &[PartyMemberState]) -> Pos {
    for col in 0..3 {
        for row in 0..4 {
            if !party.iter().any(|m| m.pos.row == row && m.pos.col == col) {
                return Pos { row, col };
            }
        }
    }
    Pos { row: 0, col: 0 }
}

/// 즉시 데코레이터 레이어 실행 — gold/heal/grantStatus/text/partyChange 순서 적용 + 로그. TS runInstantLayers.
pub fn run_instant_layers(run: &mut RunState, layers: &[Layer], d: &RunData) {
    for l in layers {
        match l {
            Layer::Gold { amount } => {
                run.gold = (run.gold + amount).max(0);
                run.log.push(format!("{}{}G", if *amount >= 0 { "+" } else { "" }, amount));
                if *amount > 0 {
                    fire_run_trigger(run, &RunTriggerCtx::new("goldGain"), d);
                }
            }
            Layer::Heal { pct, revive } => {
                heal_party(run, *pct, revive.unwrap_or(false), d);
                run.log.push(format!("파티 {}% 회복", pct));
            }
            Layer::GrantStatus { char_id, status_id, stacks, duration } => {
                let ids: Vec<String> = match char_id {
                    Some(c) => vec![c.clone()],
                    None => run.party.iter().map(|m| m.char_id.clone()).collect(),
                };
                for id in ids {
                    run.pending_statuses.entry(id).or_default().push(PendingStatus { status_id: status_id.clone(), stacks: *stacks, duration: *duration });
                }
                run.log.push(format!("상태 부여(다음 전투): {}", status_id));
            }
            Layer::Text { text } => run.log.push(text.clone()),
            Layer::PartyChange { add, remove } => {
                // 이탈 먼저(슬롯 비우기) → 합류(빈 슬롯 배치). 중복 합류 무시.
                if let Some(rm) = remove {
                    for cid in rm {
                        if let Some(i) = run.party.iter().position(|m| &m.char_id == cid) {
                            run.party.remove(i);
                            run.log.push(format!("이탈: {}", cid));
                        }
                    }
                }
                if let Some(ad) = add {
                    for cid in ad {
                        if run.party.iter().any(|m| &m.char_id == cid) || !d.chars.contains_key(cid) {
                            continue; // 이미 있거나 미정의 캐릭 → 무시
                        }
                        let pos = empty_slot(&run.party);
                        run.party.push(build_party_member(cid, pos, 0, &d.chars));
                        run.log.push(format!("합류: {}", cid));
                    }
                }
            }
            _ => {} // 상호작용 레이어는 시퀀서가 처리
        }
    }
}

/// 노드 완료 — visited 추가 + onResolve 데코 + reachable 갱신 + nodeClear. TS completeNode.
pub fn complete_node(run: &mut RunState, node_id: &str, d: &RunData) {
    if !run.visited.iter().any(|v| v == node_id) {
        run.visited.push(node_id.to_string());
    }
    let (on_resolve, ntype) = {
        let n = node(run, node_id);
        (n.layers.as_ref().and_then(|l| l.on_resolve.clone()).unwrap_or_default(), n.node_type.clone())
    };
    run_instant_layers(run, &on_resolve, d);
    run.current_node_id = node_id.to_string();
    let visited_set: HashSet<String> = run.visited.iter().cloned().collect();
    let reach = {
        let floor = cur_floor(run);
        live_reachable(floor, node_id, &visited_set)
    };
    run.reachable = reach;
    run.active_node_id = None;
    run.phase = "map".to_string();
    let mut ctx = RunTriggerCtx::new("nodeClear");
    ctx.node_type = Some(ntype);
    fire_run_trigger(run, &ctx, d);
}

/// 스킬 티어 교체(강화) — 보유/활성 양쪽. TS upgradeOwned.
pub fn upgrade_owned(m: &mut PartyMemberState, from_id: &str, to_id: &str) {
    for a in [&mut m.owned_skill_ids, &mut m.active_skill_ids] {
        if let Some(i) = a.iter().position(|s| s == from_id) {
            a[i] = to_id.to_string();
        }
    }
}

/// 스킬 학습 — 보유 추가 + 여유 있으면 활성. TS learnOwned.
pub fn learn_owned(m: &mut PartyMemberState, skill_id: &str) {
    if m.owned_skill_ids.iter().any(|s| s == skill_id) {
        return;
    }
    m.owned_skill_ids.push(skill_id.to_string());
    if m.active_skill_ids.len() < 4 {
        m.active_skill_ids.push(skill_id.to_string());
    }
}
