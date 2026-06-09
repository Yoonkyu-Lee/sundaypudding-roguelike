// SkillEffect 폼 스펙 (⑤-c 스킬 에디터) — 8종 판별 유니온의 종류별 라벨·필드·기본값.
// ruleSchema 패턴 미러. 필드 type: number/text/select(고정 옵션)/status(STATUS_DEFS)/char(CHARACTERS).
// status·char 옵션은 에디터가 주입(이 스키마는 콘텐츠 import 무의존).
export type EffFieldType = "number" | "text" | "select" | "status" | "char";
export interface EffField { key: string; label: string; type: EffFieldType; options?: string[] }
export interface EffSpec { label: string; fields: EffField[]; make: () => Record<string, unknown> }

const STATUS_FIELDS: EffField[] = [
  { key: "statusId", label: "상태", type: "status" },
  { key: "stacks", label: "스택", type: "number" },
  { key: "duration", label: "지속", type: "number" },
];

export const SKILL_EFFECT_SPECS: Record<string, EffSpec> = {
  damage: { label: "피해", fields: [{ key: "amount", label: "양", type: "number" }], make: () => ({ kind: "damage", amount: 8 }) },
  applyStatus: { label: "상태 부여(대상)", fields: STATUS_FIELDS, make: () => ({ kind: "applyStatus", statusId: "", stacks: 1, duration: 2 }) },
  applyStatusSelf: { label: "상태 부여(자신)", fields: STATUS_FIELDS, make: () => ({ kind: "applyStatusSelf", statusId: "", stacks: 1, duration: 2 }) },
  shield: { label: "쉴드", fields: [{ key: "amount", label: "양", type: "number" }], make: () => ({ kind: "shield", amount: 8 }) },
  heal: { label: "회복", fields: [{ key: "amount", label: "양", type: "number" }], make: () => ({ kind: "heal", amount: 8 }) },
  cleanse: { label: "정화", fields: [], make: () => ({ kind: "cleanse" }) },
  move: { label: "이동", fields: [{ key: "who", label: "주체", type: "select", options: ["self", "target"] }, { key: "deltaCol", label: "열 변화", type: "number" }], make: () => ({ kind: "move", who: "self", deltaCol: -1 }) },
  summon: { label: "소환", fields: [{ key: "charId", label: "캐릭", type: "char" }, { key: "count", label: "수", type: "number" }, { key: "duration", label: "지속", type: "number" }], make: () => ({ kind: "summon", charId: "", count: 1, duration: 2 }) },
};
export const EFFECT_KINDS = Object.keys(SKILL_EFFECT_SPECS);

// AreaShape 종류 — radius(square/cross) / count(free) 조건부 필드.
export const AREA_KINDS = ["single", "row", "col", "square", "cross", "all", "free"] as const;
