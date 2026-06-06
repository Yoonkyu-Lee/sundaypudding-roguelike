// 데이터 JSON 파생 (PORTING.md P0-4) — TS data 모듈(타입 authoring 소스)을 canonical JSON 번들로 방출.
// 단일 진실원 = TS(타입검증 유지), JSON = 파생 아티팩트(Rust serde 로드). 드리프트는 data-export.test가 게이트.
// 실행: npm run data:export (TS data 변경 후 재생성 → diff 리뷰 → 커밋).
// canonical: 정렬키·정수전용(P0-2 후 데이터에 float 0)·undefined 생략 → Rust BTreeMap/i64로 동일 바이트.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ITEMS } from "../src/data/items.ts";
import { SKILLS } from "../src/data/skills.ts";
import { CHARACTERS } from "../src/data/characters.ts";
import { TRAITS } from "../src/data/traits.ts";
import { AI_PROFILES } from "../src/data/ai.ts";
import { STATUS_DEFS } from "../src/data/statuses.ts";
import { NODE_ROSTERS, DEMO_ENCOUNTER } from "../src/data/encounters.ts";
import { STANDARD_FORMATION } from "../src/data/formations.ts";
import { ENCOUNTER_EVENTS } from "../src/data/events.ts";
import { RUNS } from "../src/data/runs/index.ts";
import { canonicalJson } from "../src/core/tests/harness/canonical.ts";

/** 디자이너 저작 데이터 전체 — Rust가 로드할 단일 번들(런 그래프 포함, P2 런 레이어 포팅용). */
export function dataBundle(): Record<string, unknown> {
  return {
    items: ITEMS,
    skills: SKILLS,
    characters: CHARACTERS,
    traits: TRAITS,
    aiProfiles: AI_PROFILES,
    statuses: STATUS_DEFS,
    nodeRosters: NODE_ROSTERS,
    demoEncounter: DEMO_ENCOUNTER,
    standardFormation: STANDARD_FORMATION,
    encounterEvents: ENCOUNTER_EVENTS,
    runs: RUNS, // 저작 런 그래프(id→RunDef). 런 오케스트레이션 포팅이 소비.
  };
}

/** 번들의 canonical JSON 문자열(정렬키·정수). 게이트와 생성기가 공유. */
export function dataBundleJson(): string {
  return canonicalJson(dataBundle());
}

export const BUNDLE_PATH = resolve(import.meta.dirname, "..", "src", "data", "data.generated.json");

// 직접 실행 시 파일 작성(테스트 import 시엔 작성 안 함)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("export-data.ts")) {
  writeFileSync(BUNDLE_PATH, dataBundleJson() + "\n");
  console.log(`데이터 번들 방출: ${Object.keys(dataBundle()).length} 맵 → src/data/data.generated.json`);
}
