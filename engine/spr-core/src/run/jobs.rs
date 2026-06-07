//! 전직(전직 시스템, GAME-DESIGN 4.7) — 런 한정 직업 전환.
//! 전직 = ① 직업 갱신(트리 간선 따라) ② 도달 차수 = 새 직업 classReq ③ 패시브(grantsTraitIds) 누적.
//! 부여 패시브는 유닛 빌드(`make_unit_grown`)·run-스코프(`fire_run_trigger`)서 `job_trait_ids`로 적용.
//! 노드/레이어 배선은 S3, 보상 게이트는 S4. 여기선 순수 상태 전이 + 조회.
use super::data::RunData;
use super::layers::advance_core;
use super::types::RunState;

/// 전직: `char_id`를 `to_job_id`로 전환. **현재 직업의 advancesTo에 있어야**(트리 간선) 성공.
/// 효과: 직업 갱신 + 도달 차수 = 새 직업 `classReq` + 패시브(grantsTraitIds) 누적(중복 방지). 런 한정·편도.
/// 비전투 전용(전투 중 무시). 성공 시 true + 런 로그 push.
pub fn class_change(run: &mut RunState, char_id: &str, to_job_id: &str, data: &RunData) -> bool {
    if run.phase == "battle" {
        return false;
    }
    let Some(to_job) = data.jobs.get(to_job_id) else {
        return false;
    };
    let Some(pi) = run.party.iter().position(|m| m.char_id == char_id) else {
        return false;
    };
    // 현재 직업의 advancesTo에 to_job_id가 있어야(트리 간선만 허용 — 임의 점프 금지).
    let edge_ok = run.party[pi]
        .job_id
        .as_deref()
        .and_then(|id| data.jobs.get(id))
        .map(|cj| cj.advances_to.iter().any(|j| j == to_job_id))
        .unwrap_or(false);
    if !edge_ok {
        return false;
    }
    let m = &mut run.party[pi];
    m.job_id = Some(to_job_id.to_string());
    m.class_tier = to_job.class_req;
    for t in &to_job.grants_trait_ids {
        if !m.job_trait_ids.contains(t) {
            m.job_trait_ids.push(t.clone());
        }
    }
    run.log.push(format!("전직: {} → {}", char_id, to_job.name));
    true
}

/// 전직 가능한 다음 직업 id 목록(현재 직업의 advancesTo). 레이어/UI가 선택지로 소비(S3/S5).
pub fn class_options(run: &RunState, char_id: &str, data: &RunData) -> Vec<String> {
    run.party
        .iter()
        .find(|m| m.char_id == char_id)
        .and_then(|m| m.job_id.as_deref())
        .and_then(|id| data.jobs.get(id))
        .map(|j| j.advances_to.clone())
        .unwrap_or_default()
}

// ── classChange 상호작용 레이어 해소(S3) — step_core가 phase="classChange"로 블록한 것을 처리 ──

/// 전직 레이어 중 한 명 전직. phase=="classChange" + 남은 인원>0 + 유효 전직(트리 간선)일 때만.
/// 적용 후 남은 인원 -1; 0 도달 시 레이어 종료(advance_core로 다음 core 스텝). 성공 여부 반환.
pub fn choose_class_change(run: &mut RunState, char_id: &str, to_job_id: &str, d: &RunData) -> bool {
    if run.phase != "classChange" {
        return false;
    }
    let remaining = run.class_change_remaining.unwrap_or(0);
    if remaining <= 0 {
        return false;
    }
    if !class_change(run, char_id, to_job_id, d) {
        return false;
    }
    let left = remaining - 1;
    run.class_change_remaining = Some(left);
    if left <= 0 {
        finish_class_change(run, d);
    }
    true
}

/// 전직 레이어 건너뛰기(더 이상 전직 안 함) → 레이어 종료(다음 core 스텝).
pub fn skip_class_change(run: &mut RunState, d: &RunData) {
    if run.phase != "classChange" {
        return;
    }
    finish_class_change(run, d);
}

fn finish_class_change(run: &mut RunState, d: &RunData) {
    run.class_change_remaining = None;
    advance_core(run, d);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::passives::compile::compile_rules;
    use std::collections::HashMap;

    fn setup() -> (RunState, RunData) {
        let data = RunData::load();
        let rd = spr_data::default_run();
        let run = crate::run::create_run(42, &rd.roster.clone(), &rd, &HashMap::new(), false, &data.chars);
        (run, data)
    }

    #[test]
    fn create_run_seeds_root_job() {
        let (run, _d) = setup();
        let kim = run.party.iter().find(|m| m.char_id == "kim").unwrap();
        assert_eq!(kim.job_id.as_deref(), Some("kim_job_brawler"));
        assert_eq!(kim.class_tier, 0);
        assert!(kim.job_trait_ids.is_empty());
    }

    #[test]
    fn class_change_advances_grants_and_validates_edge() {
        let (mut run, data) = setup();
        // 루트 → 1차(우미관 두목): 유효 간선.
        assert!(class_change(&mut run, "kim", "kim_job_boss", &data));
        let kim = run.party.iter().find(|m| m.char_id == "kim").unwrap();
        assert_eq!(kim.job_id.as_deref(), Some("kim_job_boss"));
        assert_eq!(kim.class_tier, 1);
        assert_eq!(kim.job_trait_ids, vec!["kim_oyabun_will".to_string()]);
        // 두목(advancesTo 없음) → 다른 1차로 전직 불가(간선 없음).
        assert!(!class_change(&mut run, "kim", "kim_job_fist", &data));
        // 전투 중 전직 불가.
        run.phase = "battle".into();
        assert!(!class_change(&mut run, "kim", "kim_job_boss", &data));
    }

    #[test]
    fn class_options_lists_advances_to() {
        let (run, data) = setup();
        let mut opts = class_options(&run, "kim", &data);
        opts.sort();
        assert_eq!(opts, vec!["kim_job_boss".to_string(), "kim_job_fist".to_string()]);
    }

    #[test]
    fn job_trait_compiles_into_unit_rules() {
        let chars = spr_data::characters();
        let skills = spr_data::skills();
        let traits = spr_data::traits();
        let base = compile_rules("kim", &[], &[], &chars, &skills, &traits).len();
        let with_job = compile_rules("kim", &[], &["kim_oyabun_will".to_string()], &chars, &skills, &traits).len();
        assert_eq!(with_job, base + 1, "전직 부여 패시브 1룰 추가");
    }

    #[test]
    fn class_change_layer_blocks_resolves_and_advances() {
        let data = RunData::load();
        // 전직 노드(core=[classChange max2]) 1개를 가진 최소 런.
        let rd: spr_types::map::RunDef = serde_json::from_str(
            r#"{"id":"t","name":"t","useMastery":false,"entryFloorId":"f",
                "roster":[{"charId":"kim","pos":{"row":1,"col":0}}],
                "floors":[{"id":"f","entryNodeId":"s","nodes":[
                    {"id":"s","type":"start","q":0,"r":0},
                    {"id":"jc","type":"rest","q":1,"r":0,"core":[{"kind":"classChange","max":2}]},
                    {"id":"c","type":"clear","q":2,"r":0}
                ],"edges":[{"from":"s","to":"jc"},{"from":"jc","to":"c"}]}]}"#,
        )
        .expect("runDef 파싱");
        let mut run = crate::run::create_run(1, &rd.roster.clone(), &rd, &HashMap::new(), false, &data.chars);
        // 전직 노드 진입 → classChange phase 블록.
        crate::run::enter_node(&mut run, "jc", &data);
        assert_eq!(run.phase, "classChange");
        assert_eq!(run.class_change_remaining, Some(2));
        // 한 명 전직(루트→두목): 남은 인원 1, 아직 블록.
        assert!(choose_class_change(&mut run, "kim", "kim_job_boss", &data));
        assert_eq!(run.class_change_remaining, Some(1));
        assert_eq!(run.phase, "classChange");
        assert_eq!(run.party[0].job_id.as_deref(), Some("kim_job_boss"));
        // 두목은 말단(advancesTo 없음) → 더 전직 불가. skip으로 레이어 종료 → advance_core → 노드 완료 → 맵 복귀.
        skip_class_change(&mut run, &data);
        assert_eq!(run.class_change_remaining, None);
        assert_ne!(run.phase, "classChange");
    }

    #[test]
    fn job_passive_fires_in_battle_after_class_change() {
        // 끝-끝: 전직 → 부여 패시브(두목의 의리: battleStart 아군 공위증)가 실제 전투에서 발동하는지.
        use crate::battle::create_battle_grown;
        use spr_types::data::Encounter;
        let data = RunData::load();
        let rd = spr_data::default_run();
        let mut run = crate::run::create_run(7, &rd.roster.clone(), &rd, &HashMap::new(), false, &data.chars);
        let enc = Encounter { id: "c".into(), name: "전투".into(), allies: vec![], enemies: data.node_rosters["battle"].clone(), boss: false };
        // 기준: 전직 전엔 battleStart에 kim에게 might 없음.
        let b0 = create_battle_grown(7, &enc, &run.party, &run.pending_statuses, &[], &data.chars, &data.skills, &data.traits, &data.items, &data.defs);
        let kim0 = b0.units.iter().find(|u| u.char_id == "kim").unwrap();
        assert!(!kim0.statuses.iter().any(|s| s.def_id == "might"), "전직 전 kim에 might 없음");
        // 우미관 두목 전직 → 두목의 의리(battleStart allAllies might) 부여.
        assert!(class_change(&mut run, "kim", "kim_job_boss", &data));
        let b1 = create_battle_grown(7, &enc, &run.party, &run.pending_statuses, &[], &data.chars, &data.skills, &data.traits, &data.items, &data.defs);
        let kim1 = b1.units.iter().find(|u| u.char_id == "kim").unwrap();
        assert!(kim1.statuses.iter().any(|s| s.def_id == "might"), "전직 후 battleStart에 아군 공위증 발동(두목의 의리)");
    }

    #[test]
    fn class_change_survives_save_roundtrip() {
        let (mut run, data) = setup();
        assert!(class_change(&mut run, "kim", "kim_job_fist", &data));
        let json = super::super::save::serialize_run(&run);
        let loaded = super::super::save::deserialize_run(&json).expect("세이브 로드");
        let kim = loaded.party.iter().find(|m| m.char_id == "kim").unwrap();
        assert_eq!(kim.job_id.as_deref(), Some("kim_job_fist"));
        assert_eq!(kim.class_tier, 1);
        assert_eq!(kim.job_trait_ids, vec!["kim_relentless".to_string()]);
    }
}
