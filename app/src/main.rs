//! Tauri2 데스크톱 셸 — spr-core 세션 API를 IPC 커맨드로 노출.
//! `?core=rust`(전투 데모) + `?core=rust&full=1`(풀 게임 RunSession) 모드를 프론트가 invoke로 구동.
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use serde_json::Value;
use spr_core::run::RunSession;
use spr_core::session::Session;
use spr_types::combat::Action;
use spr_types::data::Pos;
use std::sync::Mutex;

/// 전투 데모 세션(P1-13).
struct AppState(Mutex<Option<Session>>);
/// 풀 게임 런 세션(P2-7).
struct RunAppState(Mutex<Option<RunSession>>);

// ── 전투 데모 (P1-13) ──
#[tauri::command]
fn create_session(seed: u32, state: tauri::State<AppState>) -> Value {
    let mut sess = Session::new_demo(seed);
    let init = sess.init_delta();
    let v = serde_json::to_value(&init).expect("StepResult 직렬화");
    *state.0.lock().unwrap() = Some(sess);
    v
}

#[tauri::command]
fn battle_step(action: Action, state: tauri::State<AppState>) -> Result<Value, String> {
    let mut guard = state.0.lock().unwrap();
    let sess = guard.as_mut().ok_or("세션 없음 — create_session 먼저")?;
    Ok(serde_json::to_value(sess.step_action(&action)).expect("StepResult 직렬화"))
}

#[tauri::command]
fn observation(state: tauri::State<AppState>) -> Result<Value, String> {
    let guard = state.0.lock().unwrap();
    let sess = guard.as_ref().ok_or("세션 없음")?;
    Ok(serde_json::to_value(sess.observation()).expect("Observation 직렬화"))
}

// ── 풀 게임 런 (P2-7) — RunSession 래핑 ──
fn with_run<T: serde::Serialize>(state: &tauri::State<RunAppState>, f: impl FnOnce(&mut RunSession) -> T) -> Result<Value, String> {
    let mut guard = state.0.lock().unwrap();
    let s = guard.as_mut().ok_or("런 세션 없음 — run_create 먼저")?;
    Ok(serde_json::to_value(f(s)).expect("직렬화"))
}

#[tauri::command]
fn run_create(seed: u32, state: tauri::State<RunAppState>) -> Value {
    let s = RunSession::new(seed);
    let v = serde_json::to_value(s.view()).expect("RunView 직렬화");
    *state.0.lock().unwrap() = Some(s);
    v
}
/// 허브 편성으로 런 생성(선택 charId 목록).
#[tauri::command]
fn run_create_roster(seed: u32, char_ids: Vec<String>, state: tauri::State<RunAppState>) -> Value {
    let s = RunSession::new_roster(seed, char_ids);
    let v = serde_json::to_value(s.view()).expect("RunView 직렬화");
    *state.0.lock().unwrap() = Some(s);
    v
}
/// 저작 런(에디터 테스트플레이) 생성 — RunDef JSON.
#[tauri::command]
fn run_create_def(seed: u32, run_def: Value, state: tauri::State<RunAppState>) -> Result<Value, String> {
    let rd: spr_types::map::RunDef = serde_json::from_value(run_def).map_err(|e| format!("RunDef 파싱: {}", e))?;
    let s = RunSession::new_def(seed, rd);
    let v = serde_json::to_value(s.view()).expect("RunView 직렬화");
    *state.0.lock().unwrap() = Some(s);
    Ok(v)
}
#[tauri::command]
fn run_view(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.view())
}
#[tauri::command]
fn run_enter_node(node_id: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.enter_node(&node_id); s.view() })
}
#[tauri::command]
fn run_choose_reward(option_id: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.choose_reward(&option_id); s.view() })
}
#[tauri::command]
fn run_leave_shop(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.leave_shop(); s.view() })
}
#[tauri::command]
fn run_buy(offer_id: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.buy_offer(&offer_id); s.view() })
}
#[tauri::command]
fn run_encounter(choice_id: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.choose_encounter(&choice_id); s.view() })
}
#[tauri::command]
fn run_move(char_id: String, row: i64, col: i64, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.move_party(&char_id, Pos { row, col }); s.view() })
}
#[tauri::command]
fn run_set_active(char_id: String, skill_id: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.set_active(&char_id, &skill_id); s.view() })
}
#[tauri::command]
fn run_equip(char_id: String, slot: String, item_id: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.equip(&char_id, &slot, &item_id); s.view() })
}
#[tauri::command]
fn run_unequip(char_id: String, slot: String, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| { s.unequip(&char_id, &slot); s.view() })
}
#[tauri::command]
fn run_battle_step(action: Action, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.battle_step(&action))
}
#[tauri::command]
fn run_battle_ai_step(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.battle_ai_step())
}
#[tauri::command]
fn run_battle_obs(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.battle_observation())
}
#[tauri::command]
fn run_battle_init(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.battle_init())
}
#[tauri::command]
fn run_sheet_data(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.sheet_data())
}
#[tauri::command]
fn run_battle_view(state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.battle_view())
}
#[tauri::command]
fn run_battle_targeting(skill_id: String, row: i64, col: i64, state: tauri::State<RunAppState>) -> Result<Value, String> {
    with_run(&state, |s| s.battle_targeting(&skill_id, Pos { row, col }))
}

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
        .manage(RunAppState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            create_session, battle_step, observation,
            run_create, run_create_roster, run_create_def, run_view, run_enter_node, run_choose_reward, run_leave_shop, run_buy,
            run_encounter, run_move, run_set_active, run_equip, run_unequip,
            run_battle_step, run_battle_ai_step, run_battle_obs, run_battle_init, run_battle_view, run_battle_targeting, run_sheet_data
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 구동 실패");
}
