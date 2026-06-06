//! spr-core — 게임 로직 엔진 (TS `src/core/combat` + `run` + `ai`). 순수·결정론(rng만).
//! P1-8: run 그래프. 후속: 전투(state/turn/targeting/status/damage/skills/passives).
pub mod ai;
pub mod battle;
pub mod damage;
pub mod flow;
pub mod formation;
pub mod graph;
pub mod interrupt;
pub mod observation;
pub mod passives;
pub mod run;
pub mod session;
pub mod skills;
pub mod status;
pub mod targeting;
pub mod util;
