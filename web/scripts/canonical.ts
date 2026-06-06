// canonical JSON 직렬화 (SERIALIZATION-CONTRACT.md) — TS data 번들 ↔ Rust serde 바이트 동일 계약.
// 규칙: ① 객체 키 lexicographic 오름차순 ② 수치는 정수만 ③ undefined 값 키 생략 ④ 문자열 표준 이스케이프 ⑤ 공백 없음.
// (구 src/core/tests/harness/canonical.ts — TS 엔진 은퇴로 데이터 export 파이프라인 옆으로 이주. 유일 소비자=export-data.ts)

/** 값을 canonical JSON 문자열로(정렬키·정수·undefined 생략). 비유한수·비정수·미지 타입은 throw. */
export function canonicalJson(v: unknown): string {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "number") {
    const n = v as number;
    if (!Number.isFinite(n)) throw new Error(`canonical: non-finite ${n}`);
    if (!Number.isInteger(n)) throw new Error(`canonical: 비정수 수치 ${n} — 데이터는 정수 계약`);
    return String(n);
  }
  if (t === "boolean") return (v as boolean) ? "true" : "false";
  if (t === "string") return JSON.stringify(v); // 표준 이스케이프
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  if (t === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort(); // 정렬키 + undefined 생략
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
  }
  throw new Error(`canonical: unserializable ${t}`);
}
