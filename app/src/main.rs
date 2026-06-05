//! Tauri2 데스크톱 셸 (P1-13) — spr-core 세션 API를 IPC 커맨드로 노출.
//! 프론트(`src/web`)가 `?core=rust` 모드에서 invoke('create_session'/'battle_step') 호출 → 델타+관측 수신.
//! Phase 1 범위 = **전투 differential 검증**(데모 전투). run/hub 레이어는 아직 TS(미포팅).
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use serde_json::Value;
use spr_core::session::Session;
use spr_types::combat::Action;
use std::sync::Mutex;

/// 단일 활성 전투 세션(데모 검증용). 다중 세션은 후속.
struct AppState(Mutex<Option<Session>>);

/// 새 데모 전투 세션 생성 → 초기 이벤트 델타 + 관측(StepResult JSON).
#[tauri::command]
fn create_session(seed: u32, state: tauri::State<AppState>) -> Value {
    let mut sess = Session::new_demo(seed);
    let init = sess.init_delta();
    let v = serde_json::to_value(&init).expect("StepResult 직렬화");
    *state.0.lock().unwrap() = Some(sess);
    v
}

/// 행동 1회 적용 → 이벤트 델타 + 관측. (TS step과 바이트 동일한 이벤트 — differential 보장)
#[tauri::command]
fn battle_step(action: Action, state: tauri::State<AppState>) -> Result<Value, String> {
    let mut guard = state.0.lock().unwrap();
    let sess = guard.as_mut().ok_or("세션 없음 — create_session 먼저")?;
    Ok(serde_json::to_value(sess.step_action(&action)).expect("StepResult 직렬화"))
}

/// 현재 관측만(재렌더용).
#[tauri::command]
fn observation(state: tauri::State<AppState>) -> Result<Value, String> {
    let guard = state.0.lock().unwrap();
    let sess = guard.as_ref().ok_or("세션 없음")?;
    Ok(serde_json::to_value(sess.observation()).expect("Observation 직렬화"))
}

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![create_session, battle_step, observation])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 구동 실패");
}
