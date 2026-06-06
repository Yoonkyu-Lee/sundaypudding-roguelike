//! 런 오케스트레이션 (TS `core/run/`). 전투 위 레이어 — 맵 진행·노드 해소·보상·상점·인카운터.
//! P2-2: 타입 + 헬퍼 + createRun/편성. 후속: 시퀀서·run패시브·보상/상점/인카운터·save·풀 differential.
pub mod helpers;
pub mod run;
pub mod types;

pub use run::{create_run, move_party_member, set_active_skill};
pub use types::{RewardOption, RunState, ShopOffer};
