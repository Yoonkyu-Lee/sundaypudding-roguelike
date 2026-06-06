//! 풀 게임 세션 API (P2-7) — 프론트(Tauri2)가 **전체 런**을 Rust 코어로 구동하는 진입점.
//! 전투만이던 `session::Session`을 런 전체로 확장: 맵 진행·노드 해소·보상·상점·인카운터·전투.
//! 뷰 = RunView(맵/파티), 전투 중에는 battle 관측 + 이벤트 델타. Tauri 커맨드는 이 API를 얇게 감쌈.
use super::data::RunData;
use super::view::{get_run_view, RunView};
use super::{buy_shop_offer, choose_encounter_option, choose_reward, create_run, enter_node, leave_shop, move_party_member, resolve_battle_end, set_active_skill, RunState};
use crate::ai::choose_action;
use crate::flow::step;
use crate::observation::{build_observation, Observation};
use crate::preview::{preview_damage, preview_damage_parts, DmgParts};
use crate::run::items::{equip_item, unequip_item};
use serde::Serialize;
use spr_types::combat::{Action, GameEvent};
use spr_types::data::Pos;
use spr_types::skills::SkillEffect;
use std::collections::HashMap;

/// 현재 행동자 활성 스킬 바 1칸(쿨·피해미리보기). 프론트 actionPanel용.
#[derive(Serialize)]
pub struct SkillBarEntry {
    #[serde(rename = "skillId")]
    pub skill_id: String,
    pub cooldown: i64,
    #[serde(rename = "effDmg", skip_serializing_if = "Option::is_none")]
    pub eff_dmg: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parts: Option<DmgParts>,
}

/// 전투 뷰 — 관측 + 현재 행동자 스킬 바(GameState 비의존 프론트 렌더용).
#[derive(Serialize)]
pub struct BattleView {
    pub observation: Option<Observation>,
    #[serde(rename = "skillBar")]
    pub skill_bar: Vec<SkillBarEntry>,
}

/// 전투 step 결과(런 세션) — 이벤트 델타 + 전투 관측 + 갱신된 런 뷰.
#[derive(Serialize)]
pub struct BattleStepResult {
    #[serde(rename = "eventDelta")]
    pub event_delta: Vec<GameEvent>,
    pub observation: Option<Observation>,
    pub view: RunView,
}

pub struct RunSession {
    run: RunState,
    d: RunData,
    delivered: usize,
}

impl RunSession {
    /// 기본 런(yain) 세션 생성.
    pub fn new(seed: u32) -> Self {
        let d = RunData::load();
        let rd = spr_data::default_run();
        let run = create_run(seed, &rd.roster.clone(), &rd, &HashMap::new(), false, &d.chars);
        RunSession { run, d, delivered: 0 }
    }

    /// 허브 편성(선택 charId 1~4)으로 세션 생성 — 기본 슬롯 배치(rosterFromIds). TS hub.makeRun 대응.
    pub fn new_roster(seed: u32, char_ids: Vec<String>) -> Self {
        let d = RunData::load();
        let rd = spr_data::default_run();
        let slots = [(1i64, 0i64), (2, 0), (1, 2), (2, 2)];
        let roster: Vec<spr_types::data::Placement> = char_ids
            .iter()
            .take(4)
            .enumerate()
            .map(|(i, id)| spr_types::data::Placement { char_id: id.clone(), pos: Pos { row: slots[i].0, col: slots[i].1 } })
            .collect();
        let use_mastery = rd.use_mastery;
        let run = create_run(seed, &roster, &rd, &HashMap::new(), use_mastery, &d.chars);
        RunSession { run, d, delivered: 0 }
    }

    /// 저작 런(에디터 테스트플레이) 세션 생성 — RunDef 직접. TS testRun 대응.
    pub fn new_def(seed: u32, run_def: spr_types::map::RunDef) -> Self {
        let d = RunData::load();
        let roster = run_def.roster.clone();
        let use_mastery = run_def.use_mastery;
        let run = create_run(seed, &roster, &run_def, &HashMap::new(), use_mastery, &d.chars);
        RunSession { run, d, delivered: 0 }
    }

    pub fn phase(&self) -> &str {
        &self.run.phase
    }
    /// 현재 런 뷰(맵/파티/보상/상점/인카운터).
    pub fn view(&self) -> RunView {
        get_run_view(&self.run, &self.d)
    }
    /// 전투 관측(전투 phase일 때).
    pub fn battle_observation(&self) -> Option<Observation> {
        self.run.battle.as_ref().map(|b| build_observation(b, &self.d.chars, &self.d.skills, &self.d.defs))
    }

    /// 전투 뷰 = 관측 + 현재 행동자 스킬 바(actionPanel용). TS render.ts buildSkillBar 대응.
    pub fn battle_view(&self) -> BattleView {
        let observation = self.battle_observation();
        let mut skill_bar = Vec::new();
        if let Some(b) = &self.run.battle {
            if let Some(cur) = &b.current {
                if let Some(actor) = b.units.iter().find(|u| u.uid == cur.uid) {
                    for id in &actor.active_skill_ids {
                        let (eff_dmg, parts) = match self.d.skills.get(id) {
                            Some(sk) if sk.effects.iter().any(|e| matches!(e, SkillEffect::Damage { .. })) => {
                                (Some(preview_damage(b, actor, sk, &self.d.defs)), preview_damage_parts(b, actor, sk, &self.d.defs))
                            }
                            _ => (None, None),
                        };
                        skill_bar.push(SkillBarEntry { skill_id: id.clone(), cooldown: *actor.cooldowns.get(id).unwrap_or(&0), eff_dmg, parts });
                    }
                }
            }
        }
        BattleView { observation, skill_bar }
    }

    // ── 맵/노드 액션 ──
    pub fn enter_node(&mut self, node_id: &str) {
        enter_node(&mut self.run, node_id, &self.d);
        self.delivered = 0; // 새 전투 진입 가능 → 델타 리셋
    }
    pub fn choose_reward(&mut self, option_id: &str) {
        choose_reward(&mut self.run, option_id, &self.d);
    }
    pub fn leave_shop(&mut self) {
        leave_shop(&mut self.run, &self.d);
    }
    pub fn buy_offer(&mut self, offer_id: &str) {
        buy_shop_offer(&mut self.run, offer_id, &self.d);
    }
    pub fn choose_encounter(&mut self, choice_id: &str) {
        choose_encounter_option(&mut self.run, choice_id, &self.d);
    }

    // ── 비전투 편성 ──
    pub fn move_party(&mut self, char_id: &str, to: Pos) {
        move_party_member(&mut self.run, char_id, to);
    }
    pub fn set_active(&mut self, char_id: &str, skill_id: &str) {
        set_active_skill(&mut self.run, char_id, skill_id);
    }
    pub fn equip(&mut self, char_id: &str, slot: &str, item_id: &str) {
        equip_item(&mut self.run, char_id, slot, item_id, &self.d.chars, &self.d.items);
    }
    pub fn unequip(&mut self, char_id: &str, slot: &str) {
        unequip_item(&mut self.run, char_id, slot, &self.d.chars, &self.d.items);
    }

    // ── 전투 ──
    fn collect(&mut self) -> BattleStepResult {
        let delta: Vec<GameEvent> = self.run.battle.as_ref().map(|b| b.log[self.delivered.min(b.log.len())..].to_vec()).unwrap_or_default();
        if let Some(b) = &self.run.battle {
            self.delivered = b.log.len();
        }
        BattleStepResult { event_delta: delta, observation: self.battle_observation(), view: self.view() }
    }

    /// 플레이어 행동 1회 적용 → 종료 시 자동 resolveBattleEnd. 델타+관측+뷰.
    pub fn battle_step(&mut self, action: &Action) -> BattleStepResult {
        if let Some(b) = self.run.battle.as_mut() {
            if b.phase == "inProgress" {
                step(b, action, &self.d.defs, &self.d.skills);
            }
        }
        let ended = self.run.battle.as_ref().map(|b| b.phase != "inProgress").unwrap_or(false);
        let r = self.collect();
        if ended {
            resolve_battle_end(&mut self.run, &self.d);
        }
        r
    }

    /// AI 한 수(적 턴/자동) — chooseAction 적용.
    pub fn battle_ai_step(&mut self) -> BattleStepResult {
        let action = self.run.battle.as_ref().map(|b| choose_action(b, &self.d.skills, &self.d.defs, &self.d.ai_profiles));
        match action {
            Some(a) => self.battle_step(&a),
            None => self.collect(),
        }
    }

    /// 현재 전투 유닛이 적(자동 행동 대상)인가 — 프론트가 ally 입력 vs AI 자동 분기.
    pub fn battle_current_is_enemy(&self) -> bool {
        self.run.battle.as_ref().and_then(|b| b.current.as_ref().and_then(|c| b.units.iter().find(|u| u.uid == c.uid)).map(|u| u.side == "enemy")).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_session_drives_full_run() {
        // RunSession으로 yain 풀 런 구동(맵 reachable[0]→AI전투→보상[0]→상점→인카운터) → full-run differential과 동일 결과.
        let mut s = RunSession::new(42);
        let mut guard = 0;
        while s.phase() != "won" && s.phase() != "lost" && guard < 5000 {
            guard += 1;
            match s.phase() {
                "map" => {
                    let first = s.run.reachable[0].clone();
                    s.enter_node(&first);
                }
                "battle" => {
                    while s.run.battle.as_ref().map(|b| b.phase == "inProgress").unwrap_or(false) {
                        s.battle_ai_step();
                    }
                }
                "reward" => {
                    let id = reward_id_of(&s.run.rewards.as_ref().unwrap()[0]);
                    s.choose_reward(&id);
                }
                "shop" => s.leave_shop(),
                "encounter" => {
                    let id = s.run.encounter.as_ref().unwrap().choices[0].id.clone();
                    s.choose_encounter(&id);
                }
                _ => break,
            }
        }
        // full-run differential(seed42) = lost, gold 49.
        assert_eq!(s.phase(), "lost");
        assert_eq!(s.run.gold, 49);
    }

    fn reward_id_of(o: &super::super::RewardOption) -> String {
        use super::super::RewardOption::*;
        match o {
            UpgradeSkill { id, .. } | LearnSkill { id, .. } | Item { id, .. } | Heal { id, .. } => id.clone(),
        }
    }

    #[test]
    fn battle_step_targetcell_player_action() {
        // 플레이어 행동 경로 검증: 전투 진입 → 아군 턴에 targetCell(적 위치) 행동 → 스킬 해소(로그 증가). 패닉 없음.
        let mut s = RunSession::new(42);
        let mut guard = 0;
        // 전투 진입까지(맵 reachable[0]).
        while s.phase() != "battle" && guard < 50 {
            guard += 1;
            if s.phase() == "map" {
                let n = s.run.reachable[0].clone();
                s.enter_node(&n);
            } else {
                break;
            }
        }
        assert_eq!(s.phase(), "battle", "전투 진입");
        // 적 턴이면 자동 진행해 아군 턴 확보.
        let mut g2 = 0;
        while s.battle_current_is_enemy() && s.run.battle.as_ref().map(|b| b.phase == "inProgress").unwrap_or(false) && g2 < 50 {
            g2 += 1;
            s.battle_ai_step();
        }
        let b = s.run.battle.as_ref().unwrap();
        assert_eq!(b.phase, "inProgress");
        let actor = b.units.iter().find(|u| Some(&u.uid) == b.current.as_ref().map(|c| &c.uid)).unwrap();
        assert_eq!(actor.side, "ally", "아군 턴");
        // 첫 활성 데미지 스킬 + 첫 적 위치를 targetCell로.
        let skill_id = actor.active_skill_ids[0].clone();
        let enemy_pos = b.units.iter().find(|u| u.side == "enemy" && u.alive).unwrap().pos;
        let before = b.log.len();
        let action = Action::Skill { skill_id: skill_id.clone(), target_uid: None, target_cell: Some(enemy_pos), cells: None };
        let res = s.battle_step(&action);
        // 행동이 적용돼 로그가 늘고(skillUsed 등) 델타 비어있지 않음.
        assert!(!res.event_delta.is_empty(), "targetCell 행동 → 이벤트 발생해야(시전됨). skill={} pos={:?} before={}", skill_id, enemy_pos, before);
    }
}
