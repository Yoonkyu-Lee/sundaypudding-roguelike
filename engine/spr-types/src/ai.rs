//! AI 행동결정 정책 스키마 (TS `types/ai.ts`). 우선순위 룰 리스트. 순수·결정론(rng 미사용).
//! prefer/target은 String, weight는 f64(점수 가산 — AI는 f64 스코어, TS와 동일 연산으로 동치).
use serde::Deserialize;
use std::collections::HashMap;

/// AI 조건(if). 판별 `c`. v는 정수(HP%/라운드/수).
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "c")]
pub enum AiCondition {
    #[serde(rename = "selfHpPct")]
    SelfHpPct { cmp: String, v: i64 },
    #[serde(rename = "allyHpPctBelow")]
    AllyHpPctBelow { v: i64 },
    #[serde(rename = "enemyHpPctBelow")]
    EnemyHpPctBelow { v: i64 },
    #[serde(rename = "selfHasStatus")]
    SelfHasStatus {
        #[serde(rename = "statusId")]
        status_id: String,
    },
    #[serde(rename = "selfMissingStatus")]
    SelfMissingStatus {
        #[serde(rename = "statusId")]
        status_id: String,
    },
    #[serde(rename = "enemyHasStatus")]
    EnemyHasStatus {
        #[serde(rename = "statusId")]
        status_id: String,
    },
    #[serde(rename = "round")]
    Round { cmp: String, v: i64 },
    #[serde(rename = "outnumbered")]
    Outnumbered,
    #[serde(rename = "allyCount")]
    AllyCount { cmp: String, v: i64 },
}

/// 한 우선순위 룰: if 모두 참이면 prefer 종류를 target/weight 선호로 선택.
#[derive(Debug, Clone, Deserialize)]
pub struct AiRule {
    #[serde(rename = "if", default)]
    pub if_conds: Option<Vec<AiCondition>>,
    #[serde(default)]
    pub prefer: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub weight: Option<HashMap<String, f64>>,
}

/// AI 프로파일 = 우선순위 룰 배열(위→아래 첫 적용가능 룰이 결정).
#[derive(Debug, Clone, Deserialize)]
pub struct AiProfile {
    pub id: String,
    pub rules: Vec<AiRule>,
    // 프론트 표시 전용. 엔진 미사용 — 콘텐츠 필드 전체 선언 규약(드리프트 가드).
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub desc: Option<String>,
}
