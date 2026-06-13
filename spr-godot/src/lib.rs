//! GDExtension 바인딩 — spr-core `RunSession`을 Godot `SprSession` 클래스로 노출 (RENDER-MIGRATION).
//! 경계 = JSON 문자열(현 Tauri IPC `desktop/main.rs`와 동일 계약). 로직·결정론은 전부 Rust, Godot은 순수 뷰.
//! 명령 세트 = desktop/main.rs의 run_* / battle_* 1:1 대응. 모두 JSON 문자열 in/out.
use godot::prelude::*;
use serde::Serialize;
use spr_core::run::RunSession;
use spr_types::combat::Action;
use spr_types::data::Pos;

struct SprExtension;

#[gdextension]
unsafe impl ExtensionLibrary for SprExtension {}

/// Serialize → JSON GString (실패 시 "null").
fn js<T: Serialize>(v: &T) -> GString {
    GString::from(serde_json::to_string(v).unwrap_or_else(|_| "null".to_string()))
}

/// 런 세션 핸들 — GDScript가 `SprSession.new()`로 생성, 명령 호출(JSON 반환).
#[derive(GodotClass)]
#[class(base=RefCounted)]
struct SprSession {
    base: Base<RefCounted>,
    inner: Option<RunSession>,
}

#[godot_api]
impl IRefCounted for SprSession {
    fn init(base: Base<RefCounted>) -> Self {
        Self { base, inner: None }
    }
}

#[godot_api]
impl SprSession {
    // ── 생성 ──
    /// 기본 런(yain) 생성 + RunView JSON.
    #[func]
    fn create_run(&mut self, seed: i64) -> GString {
        let s = RunSession::new(seed as u32);
        let out = js(&s.view());
        self.inner = Some(s);
        out
    }
    /// 선택 charId 로스터로 런 생성.
    #[func]
    fn create_run_roster(&mut self, seed: i64, char_ids: PackedStringArray) -> GString {
        let ids: Vec<String> = char_ids.to_vec().into_iter().map(|g| g.to_string()).collect();
        let s = RunSession::new_roster(seed as u32, ids);
        let out = js(&s.view());
        self.inner = Some(s);
        out
    }
    /// 저작 런(RunDef JSON)으로 생성. 실패 시 "null".
    #[func]
    fn create_run_def(&mut self, seed: i64, run_def_json: GString) -> GString {
        match serde_json::from_str::<spr_types::map::RunDef>(&run_def_json.to_string()) {
            Ok(rd) => { let s = RunSession::new_def(seed as u32, rd); let out = js(&s.view()); self.inner = Some(s); out }
            Err(_) => GString::from("null"),
        }
    }

    /// id로 캠페인 런 생성(번들에서 RunDef 로드). 없으면 "null".
    #[func]
    fn create_run_id(&mut self, seed: i64, run_id: GString) -> GString {
        match spr_data::runs().get(&run_id.to_string()) {
            Some(rd) => { let s = RunSession::new_def(seed as u32, rd.clone()); let out = js(&s.view()); self.inner = Some(s); out }
            None => GString::from("null"),
        }
    }

    /// 현재 RunView JSON.
    #[func]
    fn view(&self) -> GString {
        match &self.inner { Some(s) => js(&s.view()), None => GString::from("null") }
    }

    // ── 비전투 런 명령 (변이 후 RunView 반환) ──
    #[func]
    fn enter_node(&mut self, node_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.enter_node(&node_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn choose_reward(&mut self, option_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.choose_reward(&option_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn leave_shop(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => { s.leave_shop(); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn buy(&mut self, offer_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.buy_offer(&offer_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn encounter(&mut self, choice_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.choose_encounter(&choice_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn class_change(&mut self, char_id: GString, to_job_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.choose_class_change(&char_id.to_string(), &to_job_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn class_change_skip(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => { s.skip_class_change(); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn set_active(&mut self, char_id: GString, skill_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.set_active(&char_id.to_string(), &skill_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn move_party(&mut self, char_id: GString, row: i64, col: i64) -> GString {
        match self.inner.as_mut() { Some(s) => { s.move_party(&char_id.to_string(), Pos { row, col }); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn equip(&mut self, char_id: GString, slot: GString, item_id: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.equip(&char_id.to_string(), &slot.to_string(), &item_id.to_string()); js(&s.view()) } None => GString::from("null") }
    }
    #[func]
    fn unequip(&mut self, char_id: GString, slot: GString) -> GString {
        match self.inner.as_mut() { Some(s) => { s.unequip(&char_id.to_string(), &slot.to_string()); js(&s.view()) } None => GString::from("null") }
    }

    // ── 전투 ──
    #[func]
    fn battle_init(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => js(&s.battle_init()), None => GString::from("null") }
    }
    #[func]
    fn battle_view(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => js(&s.battle_view()), None => GString::from("null") }
    }
    #[func]
    fn battle_obs(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => js(&s.battle_observation()), None => GString::from("null") }
    }
    #[func]
    fn battle_step(&mut self, action_json: GString) -> GString {
        let action: Action = match serde_json::from_str(&action_json.to_string()) { Ok(a) => a, Err(_) => return GString::from("null") };
        match self.inner.as_mut() { Some(s) => js(&s.battle_step(&action)), None => GString::from("null") }
    }
    #[func]
    fn battle_ai_step(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => js(&s.battle_ai_step()), None => GString::from("null") }
    }
    #[func]
    fn battle_targeting(&mut self, skill_id: GString, row: i64, col: i64) -> GString {
        match self.inner.as_mut() { Some(s) => js(&s.battle_targeting(&skill_id.to_string(), Pos { row, col })), None => GString::from("null") }
    }

    // ── 시트·세이브 ──
    #[func]
    fn sheet_data(&mut self) -> GString {
        match self.inner.as_mut() { Some(s) => js(&s.sheet_data()), None => GString::from("null") }
    }
    #[func]
    fn save(&self) -> GString {
        match &self.inner { Some(s) => GString::from(s.save_json()), None => GString::from("") }
    }
    #[func]
    fn load(&mut self, json: GString) -> GString {
        match RunSession::load_json(&json.to_string()) {
            Some(s) => { let out = js(&s.view()); self.inner = Some(s); out }
            None => GString::from("null"),
        }
    }

    // ── 정적: 콘텐츠 조회 (임베드 번들 원본 JSON) — HUD 표시 전용(스탯·장비명·툴팁). 로직 없음 ──
    /// 번들 섹션 원본 JSON(characters|items|skills|statuses …) — id→def 오브젝트. 없는 섹션 "null".
    #[func]
    fn content_section(name: GString) -> GString {
        let v = spr_data::data_value();
        js(v.get(name.to_string().as_str()).unwrap_or(&serde_json::Value::Null))
    }

    // ── 정적: 캠페인 런 목록 (콘텐츠 번들에서) ──
    /// [{id,name,mode}] JSON — id 정렬. campaign_select가 소비.
    #[func]
    fn run_list() -> GString {
        let mut entries: Vec<(String, serde_json::Value)> = spr_data::runs()
            .into_iter()
            .map(|(id, r)| (id, serde_json::json!({ "id": r.id, "name": r.name, "mode": r.mode })))
            .collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        let arr: Vec<serde_json::Value> = entries.into_iter().map(|(_, v)| v).collect();
        js(&arr)
    }
}
