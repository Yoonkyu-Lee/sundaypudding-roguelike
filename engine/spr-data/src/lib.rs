//! spr-data — 디자이너 데이터 로드 (TS `src/data/data.generated.json`을 serde로).
//! P1-7: 번들을 `serde_json::Value`로 로드 + **canonical 라운드트립 게이트**(로드→Rust canonical→커밋 바이트 일치).
//! → 로더 + canonical 직렬화 계약을 *전 실데이터*(Korean/emoji 포함)로 검증. 타입 구조체는 엔진 슬라이스(P1-9)에서 도입.
use serde_json::Value;
use spr_types::ai::AiProfile;
use spr_types::data::{Character, Encounter, FormationLayout, ItemDef, JobDef, Placement, StatusDef};
use spr_types::map::{EncounterEvent, RunDef};
use spr_types::passives::TraitDef;
use spr_types::skills::Skill;
use std::collections::HashMap;

/// 커밋된 데이터 번들 JSON(컴파일 시 임베드 — 런타임 경로 불요). TS `npm run data:export` 산출.
pub const DATA_JSON: &str = include_str!("../../../web/src/content/data.generated.json");

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

/// 스킬 맵(id→Skill). 타겟팅·스킬해소 엔진이 소비.
pub fn skills() -> HashMap<String, Skill> {
    serde_json::from_value(data_value()["skills"].clone()).expect("skills 역직렬화")
}

/// 장착 아이템 맵(id→ItemDef). 전투 생성 시 장비 보정 합산.
pub fn items() -> HashMap<String, ItemDef> {
    serde_json::from_value(data_value()["items"].clone()).expect("items 역직렬화")
}

/// 노드 적 구성 맵(key→Placement[]). 전투 레이어 fallback 적 배치.
pub fn node_rosters() -> HashMap<String, Vec<Placement>> {
    serde_json::from_value(data_value()["nodeRosters"].clone()).expect("nodeRosters 역직렬화")
}

/// 보상/상점 추첨 풀(아이템 id 순서 보존). TS ITEM_POOL.
pub fn item_pool() -> Vec<String> {
    serde_json::from_value(data_value()["itemPool"].clone()).expect("itemPool 역직렬화")
}

/// 표준 포메이션(6.3). 아군 기본·보스전 적용.
pub fn standard_formation() -> FormationLayout {
    serde_json::from_value(data_value()["standardFormation"].clone()).expect("standardFormation 역직렬화")
}

/// 특성 맵(id→TraitDef). 룰 컴파일이 charId의 traitIds로 조회.
pub fn traits() -> HashMap<String, TraitDef> {
    serde_json::from_value(data_value()["traits"].clone()).expect("traits 역직렬화")
}

/// 전직 직업 트리 맵(id→JobDef, 4.7). classChange가 advancesTo/grantsTraitIds로 조회.
pub fn jobs() -> HashMap<String, JobDef> {
    serde_json::from_value(data_value()["jobs"].clone()).expect("jobs 역직렬화")
}

/// AI 프로파일 맵(id→AiProfile). chooseAction이 actor.aiProfileId로 조회.
pub fn ai_profiles() -> HashMap<String, AiProfile> {
    serde_json::from_value(data_value()["aiProfiles"].clone()).expect("aiProfiles 역직렬화")
}

/// 저작 런 맵(id→RunDef). 런 오케스트레이션이 소비. (레이어/core 본문은 시퀀서 슬라이스서 확장)
pub fn runs() -> HashMap<String, RunDef> {
    serde_json::from_value(data_value()["runs"].clone()).expect("runs 역직렬화")
}

/// 인카운터 이벤트 풀(순서 보존 — event 레이어 랜덤 선택). TS ENCOUNTER_EVENTS.
pub fn encounter_events() -> Vec<EncounterEvent> {
    serde_json::from_value(data_value()["encounterEvents"].clone()).expect("encounterEvents 역직렬화")
}

/// 기본 런(yain, 없으면 첫 런). TS DEFAULT_RUN.
pub fn default_run() -> RunDef {
    let all = runs();
    all.get("yain").cloned().unwrap_or_else(|| all.into_values().next().expect("런 0개"))
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
        for key in ["aiProfiles", "characters", "jobs", "items", "skills", "statuses", "traits", "nodeRosters", "demoEncounter", "standardFormation", "encounterEvents"] {
            assert!(v.get(key).is_some(), "번들에 '{}' 누락", key);
        }
        assert_eq!(v["skills"].as_object().unwrap().len(), 71, "skills 71개"); // +야인시대 런1 19(young/gaekko/jin/wangcho/jp/miwa/det/kane)
    }
}
