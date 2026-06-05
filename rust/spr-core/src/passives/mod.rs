//! 패시브 서브시스템 (TS `combat/passives/`). 공개 API = 배럴.
pub mod compile;
pub mod conditions;
pub mod ctx;
pub mod dispatch;
pub mod effects;

pub use compile::{compile_inline, compile_rules};
pub use ctx::TriggerCtx;
pub use dispatch::{apply_speed_roll_passives, fire_trigger, on_unit_turn_start};
