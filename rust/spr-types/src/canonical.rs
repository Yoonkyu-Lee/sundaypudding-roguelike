//! canonical 직렬화 — TS `canonicalJson`(SERIALIZATION-CONTRACT)과 바이트 동일.
//! 규칙: ①키 lexicographic 정렬 ②정수만 ③undefined/None 생략 ④UTF-8 표준 이스케이프 ⑤공백 없음.
//! 구현: serde → `serde_json::Value`(기본 `Map`=`BTreeMap`=정렬) → 컴팩트 문자열. None은 `skip_serializing_if`로 생략.
use serde::Serialize;

/// 값을 canonical JSON 문자열로(정렬키·컴팩트). 이벤트 로그 differential 비교 기준.
/// `?Sized` — `&[GameEvent]` 같은 슬라이스도 허용.
pub fn canonical_json<T: Serialize + ?Sized>(v: &T) -> String {
    // to_value가 struct를 BTreeMap 기반 Value로 — 필드 선언순서와 무관하게 정렬됨.
    let value = serde_json::to_value(v).expect("canonical: to_value");
    serde_json::to_string(&value).expect("canonical: to_string")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Serialize;
    use serde_json::json;

    #[test]
    fn sorts_keys_integers_arrays() {
        // TS canonicalJson 레퍼런스(추출)와 바이트 동일해야.
        assert_eq!(
            canonical_json(&json!({"t":"damage","toShield":3,"base":10,"final":10,"targetUid":"e0_thug","toHp":7})),
            r#"{"base":10,"final":10,"t":"damage","targetUid":"e0_thug","toHp":7,"toShield":3}"#
        );
        assert_eq!(
            canonical_json(&json!({"nested":{"z":1,"a":2,"m":[3,2,1]},"arr":[{"k":"b"},{"k":"a"}],"flag":true,"neg":-5})),
            r#"{"arr":[{"k":"b"},{"k":"a"}],"flag":true,"neg":-5,"nested":{"a":2,"m":[3,2,1],"z":1}}"#
        );
    }

    #[test]
    fn omits_none_like_undefined() {
        #[derive(Serialize)]
        struct Ev {
            #[serde(rename = "skillId")]
            skill_id: &'static str,
            t: &'static str,
            uid: &'static str,
            #[serde(rename = "targetUid", skip_serializing_if = "Option::is_none")]
            target_uid: Option<&'static str>,
        }
        // targetUid=None → 생략(TS undefined 동일). 정렬: skillId < t < uid.
        let e = Ev { skill_id: "kim_punch", t: "skillUsed", uid: "a0_kim", target_uid: None };
        assert_eq!(canonical_json(&e), r#"{"skillId":"kim_punch","t":"skillUsed","uid":"a0_kim"}"#);
    }
}
