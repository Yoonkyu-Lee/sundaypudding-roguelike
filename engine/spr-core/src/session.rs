//! 세션 API (P1-12) — 프론트(Tauri2)·드라이버가 전투를 진행하는 진입점.
//! step은 **이벤트 델타(이번 step의 새 이벤트) + 관측(뷰)**만 반환 — 매 step 전체 GameState 전송 금지(하네스 설계).
//! 데이터 맵을 1회 로드해 보유(JSON 재파싱 회피). Tauri 커맨드는 이 API를 얇게 감싼다.
use crate::battle::create_battle_with;
use crate::flow::step;
use crate::observation::{build_observation, Observation};
use crate::util::StatusDefs;
use serde::Serialize;
use spr_types::combat::{Action, GameEvent, GameState};
use spr_types::data::Character;
use spr_types::passives::TraitDef;
use spr_types::skills::Skill;
use std::collections::HashMap;

/// step 결과 — 새 이벤트 + 갱신된 관측. (전체 로그/상태 미전송)
#[derive(Serialize)]
pub struct StepResult {
    #[serde(rename = "eventDelta")]
    pub event_delta: Vec<GameEvent>,
    pub observation: Observation,
}

/// 전투 세션 — 상태 + 데이터 맵 보유. 프론트가 행동을 보내며 진행.
pub struct Session {
    state: GameState,
    chars: HashMap<String, Character>,
    skills: HashMap<String, Skill>,
    traits: HashMap<String, TraitDef>,
    defs: StatusDefs,
    delivered: usize, // 마지막으로 델타를 보낸 로그 길이
}

impl Session {
    /// 데모 전투 세션 생성(시드 고정 = 결정론·리플레이). (인코딩 id는 후속 — 현재 데모.)
    pub fn new_demo(seed: u32) -> Self {
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let traits = spr_data::traits();
        let defs = spr_data::status_defs();
        let enc = spr_data::demo_encounter();
        let state = create_battle_with(seed, &enc, &chars, &skills, &traits, &defs);
        Session { state, chars, skills, traits, defs, delivered: 0 }
    }

    pub fn phase(&self) -> &str {
        &self.state.phase
    }

    /// 현재 관측(초기 렌더용).
    pub fn observation(&self) -> Observation {
        build_observation(&self.state, &self.chars, &self.skills, &self.defs)
    }

    /// 초기 진입 — 첫 렌더용 관측 + 그동안 쌓인 이벤트(createBattle 로그)를 델타로.
    pub fn init_delta(&mut self) -> StepResult {
        self.collect()
    }

    /// 행동 1회 적용 → 이벤트 델타 + 관측.
    pub fn step_action(&mut self, action: &Action) -> StepResult {
        let _ = &self.traits; // traits는 createBattle서 이미 컴파일됨(룰 보유)
        step(&mut self.state, action, &self.defs, &self.skills);
        self.collect()
    }

    fn collect(&mut self) -> StepResult {
        let delta: Vec<GameEvent> = self.state.log[self.delivered..].to_vec();
        self.delivered = self.state.log.len();
        StepResult { event_delta: delta, observation: self.observation() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use spr_types::canonical::canonical_json;

    #[test]
    fn session_deltas_concatenate_to_full_log() {
        // 세션으로 seed42 데모를 first-legal로 진행 → 누적 델타 == 전체 로그(델타 누락/중복 없음) + allyWin.
        let mut sess = Session::new_demo(42);
        let mut acc: Vec<GameEvent> = Vec::new();
        acc.extend(sess.init_delta().event_delta); // createBattle 로그
        let mut guard = 0;
        while sess.phase() == "inProgress" && guard < 1000 {
            guard += 1;
            // first-legal 정책(테스트 구동용 — 실제 프론트는 사용자 입력).
            let la = crate::targeting::get_legal_actions(&sess.state, &sess.skills, &sess.defs);
            let a = match la.into_iter().next() {
                Some(a) => a,
                None => break,
            };
            let r = sess.step_action(&a);
            acc.extend(r.event_delta);
        }
        assert_eq!(sess.phase(), "allyWin");
        // 누적 델타 = 세션 내부 전체 로그.
        assert_eq!(canonical_json(&acc), canonical_json(&sess.state.log), "델타 누적 == 전체 로그");
        // 관측은 종료 상태(legalActions 비어있음).
        let obs = sess.observation();
        assert!(obs.legal_actions.is_empty());
        assert_eq!(obs.phase, "allyWin");
    }
}
