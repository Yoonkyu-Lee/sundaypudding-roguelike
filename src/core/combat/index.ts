// 전투 엔진 공개 API 배럴. 소비자(run/ai/web/cli/test)는 여기(또는 core/engine.ts 파사드)에서만 import.
export { createBattle } from "./state.ts";
export { step } from "./flow.ts";
export { getLegalActions, computeHitChance, computeAreaCells, reachableColumns } from "./targeting.ts";
export { buildObservation } from "./observation.ts";
export { getFormationBonus } from "./formation.ts";
export { computeDamage, previewDamage, previewDamageParts, previewHpLoss } from "./damage.ts";
export { predictInterruptSubjects } from "./interrupt.ts";
export { unitById, totalStacks, isFrozen } from "../util.ts";
