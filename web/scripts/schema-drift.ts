// 스키마 드리프트 가드 — TS 콘텐츠 ↔ Rust 엔진 스키마 일치 자동 검증(check 게이트).
// 두 스키마는 손글씨 유지(TS contract/types ↔ Rust spr-types). 이 가드는 *조용한 드리프트*만 잡는다:
//   data.generated.json에 있는 콘텐츠 필드가 대응 Rust 구조체에 없으면 → serde가 말없이 무시(엔진이 영영 못 봄).
// (필수 필드·태그 enum 변종 드리프트는 이미 engine cargo test가 콘텐츠를 타입 역직렬화하며 잡음.)
// 규약: Rust 구조체는 *저작되는 모든 콘텐츠 필드를 선언*한다(엔진이 안 써도 — 프론트 전용 name/desc 등 포함).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERE = import.meta.dirname; // web/scripts
const ENGINE_SRC = resolve(HERE, "..", "..", "engine", "spr-types", "src");
const DATA_JSON = resolve(HERE, "..", "src", "content", "data.generated.json");

interface Pair { dataKey: string; rustFile: string; rustType: string; kind: "record" | "single"; }
// 최상위 콘텐츠 맵 ↔ Rust 구조체. (runs/encounterEvents/nodeRosters/demoEncounter=중첩 다수 → 엔진 타입로드가 커버, 후속)
const PAIRS: Pair[] = [
  { dataKey: "characters", rustFile: "data.rs", rustType: "Character", kind: "record" },
  { dataKey: "jobs", rustFile: "data.rs", rustType: "JobDef", kind: "record" },
  { dataKey: "skills", rustFile: "skills.rs", rustType: "Skill", kind: "record" },
  { dataKey: "statuses", rustFile: "data.rs", rustType: "StatusDef", kind: "record" },
  { dataKey: "items", rustFile: "data.rs", rustType: "ItemDef", kind: "record" },
  { dataKey: "traits", rustFile: "passives.rs", rustType: "TraitDef", kind: "record" },
  { dataKey: "aiProfiles", rustFile: "ai.rs", rustType: "AiProfile", kind: "record" },
  { dataKey: "standardFormation", rustFile: "data.rs", rustType: "FormationLayout", kind: "single" },
];

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Rust 구조체가 받아들이는 JSON 키 집합(serde rename 우선, 없으면 필드명; rename_all="camelCase" 존중). */
function rustStructKeys(src: string, typeName: string): Set<string> {
  const m = new RegExp(`pub struct ${typeName}\\b[^{]*\\{`).exec(src);
  if (!m) throw new Error(`Rust 구조체 ${typeName} 못 찾음(${typeName})`);
  const headStart = Math.max(0, m.index - 200);
  const renameAll = /rename_all\s*=\s*"camelCase"/.test(src.slice(headStart, m.index));
  let i = src.indexOf("{", m.index), depth = 0, end = i;
  for (; end < src.length; end++) { if (src[end] === "{") depth++; else if (src[end] === "}") { depth--; if (depth === 0) break; } }
  const body = src.slice(i + 1, end);
  const keys = new Set<string>();
  let pendingRename: string | null = null;
  for (const line of body.split("\n")) {
    const rn = /#\[serde\([^\]]*rename\s*=\s*"([^"]+)"/.exec(line);
    if (rn) pendingRename = rn[1];
    const f = /^\s*pub\s+([a-z_][a-z0-9_]*)\s*:/.exec(line);
    if (f) { keys.add(pendingRename ?? (renameAll ? snakeToCamel(f[1]) : f[1])); pendingRename = null; }
  }
  return keys;
}

/** data.generated.json 콘텐츠 필드가 전부 대응 Rust 구조체에 선언돼 있는지 검사. 위반 목록 반환. */
export function checkSchemaDrift(): string[] {
  const fails: string[] = [];
  const data = JSON.parse(readFileSync(DATA_JSON, "utf8")) as Record<string, unknown>;
  for (const p of PAIRS) {
    let rustKeys: Set<string>;
    try { rustKeys = rustStructKeys(readFileSync(resolve(ENGINE_SRC, p.rustFile), "utf8"), p.rustType); }
    catch (e) { fails.push(String((e as Error).message)); continue; }
    const slot = data[p.dataKey];
    const entries = p.kind === "record" ? Object.values((slot ?? {}) as Record<string, unknown>) : [slot];
    const dataKeys = new Set<string>();
    for (const e of entries) if (e && typeof e === "object") for (const k of Object.keys(e)) dataKeys.add(k);
    for (const k of dataKeys) if (!rustKeys.has(k)) {
      fails.push(`스키마 드리프트: data.${p.dataKey} 필드 "${k}" → Rust ${p.rustType}(${p.rustFile})에 없음. serde가 말없이 무시함 → 구조체에 필드 추가(엔진 미사용이면 #[serde(default)] 선언만)`);
    }
  }
  return fails;
}
