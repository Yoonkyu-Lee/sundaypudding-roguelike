//! spr-data — 디자이너 데이터 로드 (TS `src/data/data.generated.json`을 serde로).
//! P1-7: 번들을 `serde_json::Value`로 로드 + **canonical 라운드트립 게이트**(로드→Rust canonical→커밋 바이트 일치).
//! → 로더 + canonical 직렬화 계약을 *전 실데이터*(Korean/emoji 포함)로 검증. 타입 구조체는 엔진 슬라이스(P1-9)에서 도입.
use serde_json::Value;
use spr_types::data::{Character, Encounter, StatusDef};
use std::collections::HashMap;

/// 커밋된 데이터 번들 JSON(컴파일 시 임베드 — 런타임 경로 불요). TS `npm run data:export` 산출.
pub const DATA_JSON: &str = include_str!("../../../src/data/data.generated.json");

/// 데이터 번들을 serde_json::Value로 로드.
pub fn data_value() -> Value {
    serde_json::from_str(DATA_JSON).expect("data.generated.json 파싱 실패")
}

/// 캐릭터 맵(id→Character). makeUnit 등 엔진이 소비.
pub fn characters() -> HashMap<String, Character> {
    serde_json::from_value(data_value()["characters"].clone()).expect("characters 역직렬화")
}

/// 데모 전투 인코딩(헤드리스 demo·테스트).
pub fn demo_encounter() -> Encounter {
    serde_json::from_value(data_value()["demoEncounter"].clone()).expect("demoEncounter 역직렬화")
}

/// 상태이상 정의 맵(id→StatusDef).
pub fn status_defs() -> HashMap<String, StatusDef> {
    serde_json::from_value(data_value()["statuses"].clone()).expect("statuses 역직렬화")
}

#[cfg(test)]
mod tests {
    use super::*;
    use spr_types::canonical::canonical_json;

    #[test]
    fn roundtrip_canonical_matches_committed() {
        // 커밋 파일은 TS canonicalJson 산출(끝 개행). Rust canonical(value)이 동일 바이트여야
        // → Rust canonical == TS canonical을 전 실데이터로 입증(정렬키·정수·UTF-8 Korean/emoji).
        let committed = DATA_JSON.trim_end_matches('\n');
        let value = data_value();
        assert_eq!(canonical_json(&value), committed, "Rust canonical ≠ 커밋 data.generated.json");
    }

    #[test]
    fn top_level_maps_present() {
        let v = data_value();
        for key in ["aiProfiles", "characters", "items", "skills", "statuses", "traits", "nodeRosters", "demoEncounter", "standardFormation", "encounterEvents"] {
            assert!(v.get(key).is_some(), "번들에 '{}' 누락", key);
        }
        assert_eq!(v["skills"].as_object().unwrap().len(), 50, "skills 50개");
    }
}
