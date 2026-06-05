//! 차등(differential) 코퍼스 재생 (P1-10/11) — TS 골든 오라클이 기록한 행동벡터를 Rust가 재생,
//! 전체 이벤트 로그가 시드별 바이트 동일한지 검증. 40벡터/수백스텝(skip·AoE앵커·free-cell·사망·패시브 포함).
//! 코퍼스 재생성: `node scripts/export-diff-corpus.ts` (TS 변경 시).
use serde::Deserialize;
use spr_core::battle::create_battle_with;
use spr_core::flow::step;
use spr_types::canonical::canonical_json;
use spr_types::combat::Action;

#[derive(Deserialize)]
struct Vector {
    seed: u32,
    actions: Vec<Action>,
    phase: String,
    log: String,
}

#[derive(Deserialize)]
struct Corpus {
    vectors: Vec<Vector>,
}

const CORPUS: &str = include_str!("diff-corpus.generated.json");

#[test]
fn replay_diff_corpus_byte_identical() {
    let corpus: Corpus = serde_json::from_str(CORPUS).expect("코퍼스 파싱");
    let chars = spr_data::characters();
    let skills = spr_data::skills();
    let traits = spr_data::traits();
    let defs = spr_data::status_defs();
    let enc = spr_data::demo_encounter();

    assert!(!corpus.vectors.is_empty(), "코퍼스 비어있음");
    for v in &corpus.vectors {
        let mut s = create_battle_with(v.seed, &enc, &chars, &skills, &traits, &defs);
        for a in &v.actions {
            if s.phase != "inProgress" {
                break;
            }
            step(&mut s, a, &defs, &skills);
        }
        assert_eq!(s.phase, v.phase, "seed {} phase", v.seed);
        assert_eq!(canonical_json(&s.log), v.log, "seed {} 전체 로그 바이트 동일", v.seed);
    }
}
