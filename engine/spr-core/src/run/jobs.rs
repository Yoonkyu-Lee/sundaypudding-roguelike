//! 전직(전직 시스템, GAME-DESIGN 4.7) — 런 한정 직업 전환.
//! 전직 = ① 직업 갱신(트리 간선 따라) ② 도달 차수 = 새 직업 classReq ③ 패시브(grantsTraitIds) 누적.
//! 부여 패시브는 유닛 빌드(`make_unit_grown`)·run-스코프(`fire_run_trigger`)서 `job_trait_ids`로 적용.
//! 노드/레이어 배선은 S3, 보상 게이트는 S4. 여기선 순수 상태 전이 + 조회.
use super::data::RunData;
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
