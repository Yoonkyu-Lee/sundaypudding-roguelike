//! GDExtension 바인딩 — spr-core `RunSession`을 Godot `SprSession` 클래스로 노출 (RENDER-MIGRATION R1 스파이크).
//! 경계 = JSON 문자열(현 Tauri IPC `desktop/main.rs`와 동일 계약). 로직·결정론은 전부 Rust, Godot은 순수 뷰.
use godot::prelude::*;
use spr_core::run::RunSession;

struct SprExtension;

#[gdextension]
unsafe impl ExtensionLibrary for SprExtension {}

/// 런 세션 핸들 — GDScript가 `SprSession.new()`로 생성, `create_run`/`view` 호출.
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
    /// 기본 런(yain) 생성 + RunView JSON 반환. (desktop의 run_create 대응)
    #[func]
    fn create_run(&mut self, seed: i64) -> GString {
        let s = RunSession::new(seed as u32);
        let json = serde_json::to_string(&s.view()).unwrap_or_else(|_| "null".to_string());
        self.inner = Some(s);
        GString::from(json)
    }

    /// 현재 RunView JSON. (desktop의 run_view 대응)
    #[func]
    fn view(&self) -> GString {
        match &self.inner {
            Some(s) => GString::from(serde_json::to_string(&s.view()).unwrap_or_else(|_| "null".to_string())),
            None => GString::from("null"),
        }
    }
}
