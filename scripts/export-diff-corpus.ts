// 차등(differential) 코퍼스 생성 — TS(골든 오라클)로 여러 시드의 전투를 풀 플레이하며
// **선택한 행동벡터 + 최종 이벤트 로그**를 기록 → Rust가 같은 행동을 재생해 바이트 동일 검증(P1-10/11).
// 정책: 시드별 별도 RNG로 enumerateRichActions 중 1개를 무작위 선택(skip·AoE앵커·free-cell 포함 자극).
// 게임 RNG(state.rng)와 분리 → 선택은 결정론·기록되며, Rust는 자가생성 없이 재생만 한다(Codex 제약).
import { writeFileSync } from "node:fs";
import { createBattle } from "../src/core/combat/state.ts";
import { step } from "../src/core/combat/flow.ts";
import { enumerateRichActions } from "../src/core/tests/harness/richActions.ts";
import { canonicalJson } from "../src/core/tests/harness/canonical.ts";
import { Rng } from "../src/core/rng.ts";
import { DEMO_ENCOUNTER } from "../src/data/encounters.ts";

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const STEP_CAP = 2000;

const vectors = SEEDS.map((seed) => {
  const state = createBattle(seed, DEMO_ENCOUNTER);
  const sel = new Rng(seed * 1009 + 7); // 행동 선택용(게임 rng와 분리)
  const actions: unknown[] = [];
  let guard = 0;
  while (state.phase === "inProgress" && guard++ < STEP_CAP) {
    const rich = enumerateRichActions(state);
    if (rich.length === 0) break;
    const a = rich[sel.int(0, rich.length - 1)];
    actions.push(a);
    step(state, a);
  }
  return { seed, actions: JSON.parse(canonicalJson(actions)), phase: state.phase, log: canonicalJson(state.log) };
});

const out = "rust/spr-core/tests/diff-corpus.generated.json";
writeFileSync(out, JSON.stringify({ encounter: "demo", vectors }, null, 0) + "\n", "utf8");
const steps = vectors.reduce((s, v) => s + v.actions.length, 0);
console.log(`✅ ${vectors.length} vectors, ${steps} steps → ${out}`);
console.log("phases:", vectors.map((v) => v.phase).join(","));
