// canonical 이벤트 직렬화 (Codex 적대검토 (a)·SERIALIZATION-CONTRACT.md) — TS↔Rust 바이트 동일 계약.
// 규칙: ① 객체 키 lexicographic 오름차순 ② 수치는 정수만(소수점·지수 표기 없음) ③ undefined 값 키 생략
//       ④ 문자열 UTF-8(JSON 표준 이스케이프) ⑤ 공백 없음. → serde 기본(BTreeMap·i64)으로 재현 가능.
// JS의 JSON.stringify는 삽입 순서 키라 Rust serde와 어긋남 → 정렬키 canonical로 통일.
import type { GameEvent } from "../../types.ts";

/** 값을 canonical JSON 문자열로(정렬키·정수·undefined 생략). 비유한수·비정수·미지 타입은 throw. */
export function canonicalJson(v: unknown): string {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "number") {
    const n = v as number;
    if (!Number.isFinite(n)) throw new Error(`canonical: non-finite ${n}`);
    if (!Number.isInteger(n)) throw new Error(`canonical: 비정수 수치 ${n} — 이벤트 로그는 정수 계약(슬라이스1 정수화)`);
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

/** 이벤트 로그를 canonical 직렬화. 정수 계약 위반 시 throw로 회귀 검출(differential 비교 기준). */
export function canonicalLog(log: GameEvent[]): string {
  return canonicalJson(log);
}
