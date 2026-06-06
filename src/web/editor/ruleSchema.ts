// 트리거 룰 에디터 스키마 (Phase E4) — when/if/then의 큐레이트 카탈로그 + 폼 필드 스펙.
// 엔진은 모든 변형을 해석하나, GUI는 자주 쓰는 부분집합만 노출(스키마라 행 추가로 확장 쉬움).
import type { Trigger, Condition, Effect } from "../../contract/types.ts";
import type { FieldSpec } from "./layerSchema.ts";

export interface SpecRow { label: string; fields: FieldSpec[]; make: () => object; }

const CMP: FieldSpec = { key: "cmp", label: "비교", type: "select", options: ["lt", "lte", "eq", "gte", "gt"] };
const WHO: FieldSpec = { key: "who", label: "대상", type: "select", options: ["self", "subject", "target"] };
const TARGET: FieldSpec = { key: "target", label: "효과대상", type: "select", options: ["self", "subject", "target", "allAllies", "allEnemies", "randomEnemy", "randomAlly"] };

// when — 자주 쓰는 트리거. (대부분 파라미터 없음)
export const WHEN_SPECS: Record<string, SpecRow> = {
  battleStart: { label: "전투 시작", fields: [], make: () => ({ on: "battleStart" }) },
  roundStart: { label: "라운드 시작", fields: [], make: () => ({ on: "roundStart" }) },
  turnStart: { label: "턴 시작", fields: [{ key: "who", label: "누구", type: "select", options: ["self", "ally", "enemy", "any"] }], make: () => ({ on: "turnStart" }) },
  everyNTurns: { label: "N턴마다", fields: [{ key: "n", label: "N", type: "number" }], make: () => ({ on: "everyNTurns", n: 3 }) },
  onHit: { label: "명중 시", fields: [{ key: "as", label: "역할", type: "select", options: ["attacker", "target"] }], make: () => ({ on: "onHit" }) },
  damaged: { label: "피격 시", fields: [], make: () => ({ on: "damaged" }) },
  kill: { label: "처치 시", fields: [], make: () => ({ on: "kill" }) },
  death: { label: "사망 시", fields: [{ key: "who", label: "누구", type: "select", options: ["self", "ally", "enemy", "any"] }], make: () => ({ on: "death" }) },
};
export const WHEN_KINDS = Object.keys(WHEN_SPECS);

// if — 자주 쓰는 조건.
export const COND_SPECS: Record<string, SpecRow> = {
  round: { label: "라운드", fields: [CMP, { key: "v", label: "값", type: "number" }], make: () => ({ c: "round", cmp: "eq", v: 2 }) },
  hpPct: { label: "HP%", fields: [WHO, CMP, { key: "v", label: "%", type: "number" }], make: () => ({ c: "hpPct", who: "self", cmp: "lte", v: 50 }) },
  chance: { label: "확률%", fields: [{ key: "pct", label: "%", type: "number" }], make: () => ({ c: "chance", pct: 50 }) },
  hasStatus: { label: "상태 보유", fields: [WHO, { key: "statusId", label: "상태", type: "select", optionsFrom: "statuses" }], make: () => ({ c: "hasStatus", who: "self", statusId: "" }) },
  outnumbered: { label: "수적 열세", fields: [], make: () => ({ c: "outnumbered" }) },
};
export const COND_KINDS = Object.keys(COND_SPECS);

// then — 큐레이트 효과(연출 + 전투 개입). showDialog가 간판.
export const EFFECT_SPECS: Record<string, SpecRow> = {
  showDialog: { label: "💬 대사", fields: [{ key: "speaker", label: "화자(선택)", type: "text" }, { key: "text", label: "내용", type: "text" }], make: () => ({ do: "showDialog", text: "" }) },
  applyStatus: { label: "상태 부여", fields: [TARGET, { key: "statusId", label: "상태", type: "select", optionsFrom: "statuses" }, { key: "stacks", label: "스택", type: "number" }, { key: "duration", label: "지속", type: "number" }], make: () => ({ do: "applyStatus", target: "allEnemies", statusId: "", stacks: 1, duration: 2 }) },
  damage: { label: "피해", fields: [TARGET, { key: "amount", label: "양", type: "number" }], make: () => ({ do: "damage", target: "randomEnemy", amount: 5 }) },
  heal: { label: "회복", fields: [TARGET, { key: "amount", label: "양", type: "number" }], make: () => ({ do: "heal", target: "self", amount: 5 }) },
};
export const EFFECT_KINDS = Object.keys(EFFECT_SPECS);

export const whenKindOf = (w: Trigger) => w.on;
export const condKindOf = (c: Condition) => c.c;
export const effectKindOf = (e: Effect) => e.do;
