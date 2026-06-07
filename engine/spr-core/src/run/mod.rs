//! 런 오케스트레이션 (TS `core/run/`). 전투 위 레이어 — 맵 진행·노드 해소·보상·상점·인카운터.
//! 시퀀서(layers)·run패시브(passives)·보상/상점/인카운터·createRun/편성/전투종료/보상. save·풀 differential은 P2-7/8.
pub mod data;
pub mod encounter;
pub mod helpers;
pub mod items;
pub mod jobs;
pub mod layers;
pub mod passives;
pub mod rewards;
pub mod run;
pub mod save;
pub mod session;
pub mod shop;
pub mod types;
pub mod view;

pub use session::RunSession;

pub use data::RunData;
pub use encounter::choose_encounter_option;
pub use jobs::{class_change, class_options};
pub use run::{choose_reward, create_run, enter_node, move_party_member, resolve_battle_end, set_active_skill};
pub use shop::{buy_shop_offer, leave_shop};
pub use types::{RewardOption, RunState, ShopOffer};
