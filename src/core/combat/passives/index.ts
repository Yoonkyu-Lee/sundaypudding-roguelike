// 패시브/특성 디스패치 배럴. 전투 훅·makeUnit은 여기서만 import.
export { compileRules } from "./compile.ts";
export { fireTrigger, onUnitTurnStart, applySpeedRollPassives } from "./dispatch.ts";
export { applyEffect } from "./effects.ts"; // 효과 인터프리터(테스트/도구용 노출)
export type { TriggerCtx, RuleCtx } from "./ctx.ts";
