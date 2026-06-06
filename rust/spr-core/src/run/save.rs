//! 런 세이브 직렬화 (TS `web/save.ts` + `core/run/save.ts` 대응). RunState 전 트리 serde → JSON.
//! 영속화(localStorage)는 프론트가 담당. 여기선 순수 직렬화/역직렬화 + 손상 폐기(파싱 실패=None).
//! GameState.log은 #[serde(skip)](append-only·복원 시 빈 벡터) → 전투 중에도 안전 저장.
use super::types::RunState;

/// RunState → JSON 문자열(세이브). 실패 시 빈 문자열.
pub fn serialize_run(run: &RunState) -> String {
    serde_json::to_string(run).unwrap_or_default()
}

/// JSON → RunState. 파싱/스키마 손상 시 None(세이브 폐기 → 새로 시작, TS deserializeRun 대응).
pub fn deserialize_run(json: &str) -> Option<RunState> {
    serde_json::from_str(json).ok()
}
