//! 풀 게임 세션 API (P2-7) — 프론트(Tauri2)가 **전체 런**을 Rust 코어로 구동하는 진입점.
//! 전투만이던 `session::Session`을 런 전체로 확장: 맵 진행·노드 해소·보상·상점·인카운터·전투.
//! 뷰 = RunView(맵/파티), 전투 중에는 battle 관측 + 이벤트 델타. Tauri 커맨드는 이 API를 얇게 감쌈.
use super::data::RunData;
use super::view::{get_run_view, RunView, SkillView};
use super::{buy_shop_offer, choose_class_change, choose_encounter_option, choose_reward, create_run, enter_node, leave_shop, move_party_member, resolve_battle_end, set_active_skill, skip_class_change, RunState};
use crate::ai::choose_action;
use crate::flow::step;
use crate::interrupt::predict_interrupt_subjects;
use crate::observation::{build_observation, Observation, StatusView};
use crate::preview::{preview_damage, preview_damage_parts, preview_hp_loss, DmgParts, HpLoss};
use crate::run::items::{equip_item, unequip_item};
use crate::skills::resolve_anchor_uid;
use crate::targeting::{compute_area_cells, side_dims};
use serde::Serialize;
use spr_types::combat::{Action, GameEvent};
use spr_types::data::Pos;
use spr_types::party::Equipped;
use spr_types::skills::SkillEffect;
use std::collections::HashMap;

/// 타겟팅 미리보기 — 영향 유닛별 HP 손실(빨간 예고) + 끼어들기 고스트 이름. 프론트 unitCard/타임라인용.
#[derive(Serialize)]
pub struct TargetingInfo {
    #[serde(rename = "previewLoss")]
    pub preview_loss: HashMap<String, HpLoss>,
    pub ghosts: Vec<String>,
}

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

/// 캐릭터 시트/파티 편성 오버레이용 원시 데이터 묶음 — 프론트가 정적 데이터(base/특성/패시브 설명)로 보강해 SheetData 조립.
#[derive(Serialize)]
pub struct SheetMember {
    #[serde(rename = "charId")]
    pub char_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub pos: Pos,
    pub hp: i64,
    #[serde(rename = "hpMax")]
    pub hp_max: i64,
    pub alive: bool,
    pub equipped: Equipped,
    pub skills: Vec<SkillView>,
    #[serde(rename = "activeCount")]
    pub active_count: usize,
}
#[derive(Serialize)]
pub struct SheetBattleUnit {
    pub uid: String,
    #[serde(rename = "charId")]
    pub char_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub side: String,
    pub hp: i64,
    #[serde(rename = "hpMax")]
    pub hp_max: i64,
    pub shield: i64,
    pub statuses: Vec<StatusView>,
    pub skills: Vec<SkillView>,
    #[serde(rename = "activeCount")]
    pub active_count: usize,
    pub equipped: Equipped,
}
#[derive(Serialize)]
pub struct SheetBundle {
    #[serde(rename = "inBattle")]
    pub in_battle: bool,
    pub members: Vec<SheetMember>,
    pub inventory: Vec<String>,
    #[serde(rename = "battleUnits")]
    pub battle_units: Vec<SheetBattleUnit>,
}

pub struct RunSession {
    run: RunState,
    d: RunData,
    delivered: usize,
}

/// 스킬 id 목록 → SkillView(이름/티어/활성/업글가능/시그니처). active_set에 들어있으면 활성.
fn skill_views(ids: &[String], active: &[String], d: &RunData) -> Vec<SkillView> {
    ids.iter()
        .map(|sid| {
            let sk = d.skills.get(sid);
            SkillView {
                id: sid.clone(),
                name: sk.map(|s| s.name.clone()).unwrap_or_else(|| sid.clone()),
                tier: sk.and_then(|s| s.tier).unwrap_or(1),
                active: active.iter().any(|a| a == sid),
                can_upgrade: sk.map(|s| s.next_tier_id.is_some()).unwrap_or(false),
                signature: sk.map(|s| s.exclusive_to.is_some()).unwrap_or(false),
            }
        })
        .collect()
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

    /// 세이브 — RunState 전 트리 JSON. 프론트가 localStorage 영속(TS saveRun 대응).
    pub fn save_json(&self) -> String {
        super::save::serialize_run(&self.run)
    }
    /// 이어하기 — JSON → 세션 복원. 손상/비호환(파티 빔·삭제 charId 참조)이면 None(폐기 후 새로 시작, TS loadable).
    /// 데이터맵은 재로드(저장 안 함), delivered=0(battle.log은 skip되어 빈 벡터 → 델타 재생 없음).
    pub fn load_json(json: &str) -> Option<RunSession> {
        let run = super::save::deserialize_run(json)?;
        let d = RunData::load();
        if run.party.is_empty() || !run.party.iter().all(|m| d.chars.contains_key(&m.char_id)) {
            return None;
        }
        Some(RunSession { run, d, delivered: 0 })
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

    /// 캐릭터 시트/파티 편성 오버레이 원시 데이터. 맵 파티원(장착·보유스킬) + (전투 중이면) 전투유닛(상태이상·쉴드·learnset).
    pub fn sheet_data(&self) -> SheetBundle {
        let in_battle = self.run.battle.is_some();
        // 전투 중이면 실시간 HP 매핑(아군 charId → 전투 unit hp/hpMax).
        let live_hp: HashMap<String, (i64, i64)> = self
            .run
            .battle
            .as_ref()
            .map(|b| b.units.iter().filter(|u| u.side == "ally").map(|u| (u.char_id.clone(), (u.hp, u.hp_max))).collect())
            .unwrap_or_default();
        let members = self
            .run
            .party
            .iter()
            .map(|m| {
                let c = &self.d.chars[&m.char_id];
                let (hp, hp_max) = live_hp.get(&m.char_id).copied().unwrap_or((m.hp, m.max_hp));
                SheetMember {
                    char_id: m.char_id.clone(),
                    name: c.name.clone(),
                    avatar: c.avatar.clone(),
                    pos: m.pos,
                    hp,
                    hp_max,
                    alive: m.hp > 0,
                    equipped: m.equipped.clone(),
                    skills: skill_views(&m.owned_skill_ids, &m.active_skill_ids, &self.d),
                    active_count: m.active_skill_ids.len(),
                }
            })
            .collect();
        let battle_units = match &self.run.battle {
            Some(b) => {
                let obs = build_observation(b, &self.d.chars, &self.d.skills, &self.d.defs);
                let mut sv: HashMap<&str, (&Vec<StatusView>, i64, i64, i64)> = HashMap::new();
                for v in obs.allies.iter().chain(obs.enemies.iter()) {
                    sv.insert(v.uid.as_str(), (&v.statuses, v.shield, v.hp, v.hp_max));
                }
                b.units
                    .iter()
                    .map(|u| {
                        let ch = &self.d.chars[&u.char_id];
                        // 아군 = 보유 스킬풀, 적 = learnset 전체 노출(TS buildBattleSheet).
                        let owned: Vec<String> = if u.side == "ally" {
                            self.run.party.iter().find(|p| p.char_id == u.char_id).map(|p| p.owned_skill_ids.clone()).unwrap_or_else(|| ch.skill_ids.clone())
                        } else {
                            ch.skill_ids.clone()
                        };
                        let equipped = if u.side == "ally" {
                            self.run.party.iter().find(|p| p.char_id == u.char_id).map(|p| p.equipped.clone()).unwrap_or_default()
                        } else {
                            Equipped::default()
                        };
                        let (statuses, shield, hp, hp_max) = sv.get(u.uid.as_str()).map(|&(s, sh, h, hm)| (s.clone(), sh, h, hm)).unwrap_or((Vec::new(), u.shield, u.hp, u.hp_max));
                        SheetBattleUnit {
                            uid: u.uid.clone(),
                            char_id: u.char_id.clone(),
                            name: u.name.clone(),
                            avatar: ch.avatar.clone(),
                            side: u.side.clone(),
                            hp,
                            hp_max,
                            shield,
                            statuses,
                            skills: skill_views(&owned, &u.active_skill_ids, &self.d),
                            active_count: u.active_skill_ids.len(),
                            equipped,
                        }
                    })
                    .collect()
            }
            None => Vec::new(),
        };
        SheetBundle { in_battle, members, inventory: self.run.inventory.clone(), battle_units }
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
    /// 전직(4.7) — 한 명 전직(char_id를 to_job_id로). 남은 인원 0이면 레이어 종료.
    pub fn choose_class_change(&mut self, char_id: &str, to_job_id: &str) -> bool {
        choose_class_change(&mut self.run, char_id, to_job_id, &self.d)
    }
    /// 전직 레이어 건너뛰기(더 이상 전직 안 함).
    pub fn skip_class_change(&mut self) {
        skip_class_change(&mut self.run, &self.d);
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

    /// 전투 진입 초기 델타(createBattle 로그 — 라운드1 주사위 등). 첫 렌더/연출용. 델타 전달 마킹.
    pub fn battle_init(&mut self) -> BattleStepResult {
        self.collect()
    }

    /// 플레이어 행동 1회 적용 → 종료 시 자동 resolveBattleEnd. 델타+관측+뷰.
    /// 델타·관측은 종료 직후(아직 battle Some) 캡처해 막타/승패 연출 보존, **뷰는 resolve 후**(phase 전이 반영 → 프론트가 보상/패배로 전환).
    pub fn battle_step(&mut self, action: &Action) -> BattleStepResult {
        if let Some(b) = self.run.battle.as_mut() {
            if b.phase == "inProgress" {
                step(b, action, &self.d.defs, &self.d.skills);
            }
        }
        let ended = self.run.battle.as_ref().map(|b| b.phase != "inProgress").unwrap_or(false);
        let event_delta: Vec<GameEvent> = self.run.battle.as_ref().map(|b| b.log[self.delivered.min(b.log.len())..].to_vec()).unwrap_or_default();
        if let Some(b) = &self.run.battle {
            self.delivered = b.log.len();
        }
        let observation = self.battle_observation();
        if ended {
            resolve_battle_end(&mut self.run, &self.d);
        }
        BattleStepResult { event_delta, observation, view: self.view() }
    }

    /// 타겟팅 미리보기(앵커 칸 기준) — 영향 유닛 HP 손실 + 끼어들기 고스트. TS computeTgt의 previewLoss/ghostNames.
    pub fn battle_targeting(&self, skill_id: &str, anchor: Pos) -> TargetingInfo {
        let mut preview_loss: HashMap<String, HpLoss> = HashMap::new();
        let mut ghosts: Vec<String> = Vec::new();
        if let Some(b) = &self.run.battle {
            if let Some(cur) = &b.current {
                if let (Some(ai), Some(skill)) = (b.units.iter().position(|u| u.uid == cur.uid), self.d.skills.get(skill_id)) {
                    let actor = &b.units[ai];
                    let side: &str = if skill.target == "enemy" {
                        if actor.side == "ally" { "enemy" } else { "ally" }
                    } else {
                        actor.side.as_str()
                    };
                    let (rows, cols) = side_dims(b, side);
                    for cell in compute_area_cells(anchor, skill.area.as_ref(), rows, cols) {
                        if let Some(tu) = b.units.iter().find(|u| u.alive && u.side == side && u.pos == cell) {
                            preview_loss.insert(tu.uid.clone(), preview_hp_loss(b, actor, skill, tu, &self.d.defs));
                        }
                    }
                    let anchor_uid = resolve_anchor_uid(b, ai, skill, None, Some(anchor), None);
                    let subs = predict_interrupt_subjects(b, ai, Some(skill), anchor_uid.as_deref(), &self.d.defs);
                    ghosts = subs.iter().filter_map(|uid| b.units.iter().find(|u| &u.uid == uid).map(|u| u.name.clone())).collect();
                }
            }
        }
        TargetingInfo { preview_loss, ghosts }
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

    #[test]
    fn save_load_round_trip_deterministic() {
        use spr_types::canonical::canonical_json;
        // mid-battle 상태에서 세이브→로드 후, 양쪽을 동일하게 끝까지 구동 → 이어진 이벤트 델타 바이트 동일.
        // RNG state·유닛·상태이상·룰 카운터·큐가 전부 복원돼야 통과(전투 중 세이브 안전성 증명).
        let mut s = RunSession::new(42);
        let mut g0 = 0;
        while s.phase() == "map" && g0 < 50 {
            g0 += 1;
            let n = s.run.reachable[0].clone();
            s.enter_node(&n);
        }
        assert_eq!(s.phase(), "battle", "전투 진입");
        for _ in 0..2 {
            if s.run.battle.as_ref().map(|b| b.phase == "inProgress").unwrap_or(false) {
                s.battle_ai_step();
            }
        }
        let json = s.save_json();
        let mut s2 = RunSession::load_json(&json).expect("로드 성공");
        let mut drive = |sess: &mut RunSession| -> (String, String, i64) {
            let mut log: Vec<GameEvent> = Vec::new();
            let mut g = 0;
            while sess.run.battle.as_ref().map(|b| b.phase == "inProgress").unwrap_or(false) && g < 300 {
                g += 1;
                log.extend(sess.battle_ai_step().event_delta);
            }
            (canonical_json(&log), sess.run.phase.clone(), sess.run.gold)
        };
        let a = drive(&mut s);
        let b = drive(&mut s2);
        assert_eq!(a.0, b.0, "세이브/로드 후 이어진 전투 이벤트 델타 바이트 동일");
        assert_eq!((a.1.as_str(), a.2), (b.1.as_str(), b.2), "최종 phase/gold 동일");
    }

    #[test]
    fn battle_step_returns_post_resolve_view() {
        // 회귀: 막타(전투 종료) step의 반환 뷰 phase는 resolveBattleEnd 후 전이를 반영해야(battle 아님).
        // 프리즈 버그(반환 뷰가 stale "battle" → 프론트가 보상화면으로 못 넘어감) 방지.
        let mut s = RunSession::new(42);
        let mut guard = 0;
        while s.phase() == "map" && guard < 50 {
            guard += 1;
            let n = s.run.reachable[0].clone();
            s.enter_node(&n);
        }
        assert_eq!(s.phase(), "battle", "전투 진입");
        let mut last = String::from("battle");
        let mut g2 = 0;
        while s.run.battle.as_ref().map(|b| b.phase == "inProgress").unwrap_or(false) && g2 < 300 {
            g2 += 1;
            last = s.battle_ai_step().view.phase.clone();
        }
        assert_ne!(last, "battle", "전투 종료 step의 반환 뷰 phase는 전이돼야(프리즈 방지). 실제={}", last);
    }
}
