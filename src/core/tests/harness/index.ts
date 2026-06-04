// 검증 harness 배럴 — 무작위 스트레스 런 + self-consistency.
export { stressRun, type StressRunResult, type StressRunOpts, type Outcome, type ActionPolicy } from "./stressRun.ts";
export { stressTrace, tracesMatch, battleTrace } from "./selfConsistency.ts";
