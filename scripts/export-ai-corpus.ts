// AI 차등 코퍼스 — TS(골든)가 chooseAction(양 진영)으로 전투 풀 플레이한 최종 로그를 시드별 기록.
// 두 시나리오: demo(그리디 위주) + profiled(4 AI 프로파일 enemy로 applyProfile/조건/가중치 경로 자극).
// Rust가 같은 시드로 choose_action 자가구동 → 전체 로그 바이트 동일(AI+전투 동시, 순수·결정론).
import { writeFileSync } from "node:fs";
import { createBattle } from "../src/core/combat/state.ts";
import { step } from "../src/core/combat/flow.ts";
import { chooseAction } from "../src/core/ai.ts";
import { canonicalJson } from "../src/core/tests/harness/canonical.ts";
import { DEMO_ENCOUNTER } from "../src/data/encounters.ts";
import type { Encounter } from "../src/data/encounters.ts";

// 4 프로파일(skirmisher/assassin/guardian/healer) enemy vs 데모 아군 — 프로파일 인터프리터 전 경로.
const PROFILED: Encounter = {
  id: "prof", name: "프로파일 검증",
  allies: [
    { charId: "kim", pos: { row: 0, col: 0 } },
    { charId: "shanghai", pos: { row: 1, col: 0 } },
    { charId: "cho", pos: { row: 2, col: 0 } },
  ],
  enemies: [
    { charId: "jung", pos: { row: 0, col: 0 } },
    { charId: "chunho", pos: { row: 1, col: 0 } },
    { charId: "shim", pos: { row: 2, col: 0 } },
    { charId: "doctor", pos: { row: 3, col: 0 } },
  ],
};

const SEEDS = [1, 7, 42, 100, 2024];
function playLog(seed: number, enc: Encounter): string {
  const s = createBattle(seed, enc);
  let guard = 0;
  while (s.phase === "inProgress" && guard++ < 4000) step(s, chooseAction(s));
  return canonicalJson(s.log);
}
const demo: Record<string, string> = {};
const profiled: Record<string, string> = {};
for (const seed of SEEDS) { demo[String(seed)] = playLog(seed, DEMO_ENCOUNTER); profiled[String(seed)] = playLog(seed, PROFILED); }

writeFileSync("rust/spr-core/tests/ai-corpus.generated.json", JSON.stringify({ demo, profiled }, null, 0) + "\n", "utf8");
console.log(`✅ AI 코퍼스(demo+profiled) ${SEEDS.length}시드 → rust/spr-core/tests/ai-corpus.generated.json`);
