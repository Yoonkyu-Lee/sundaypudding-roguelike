// 노드 에디터 폼의 진실원 (Phase E) — 레이어 kind별 편집 필드 스펙(선언적) + 카탈로그 + 요약/기본값.
// 단순 필드(숫자/텍스트/토글/select)는 폼 제너레이터가 자동 렌더. 리치 위젯(roster 4×4·선택지)은 E3.
import type { Layer } from "../../core/types.ts";

export interface FieldSpec { key: string; label: string; type: "number" | "text" | "bool" | "select"; options?: string[]; step?: number; }
export interface LayerSpec { label: string; fields: FieldSpec[]; make: () => Layer; }

export const LAYER_SPECS: Record<string, LayerSpec> = {
  combat: { label: "⚔ 전투", fields: [{ key: "rosterPreset", label: "적 프리셋", type: "select", options: ["battle", "elite", "boss"] }, { key: "boss", label: "진형 보너스", type: "bool" }], make: () => ({ kind: "combat", rosterPreset: "battle" }) },
  reward: { label: "🎁 보상(3택1)", fields: [], make: () => ({ kind: "reward" }) },
  shop: { label: "🏪 상점", fields: [], make: () => ({ kind: "shop" }) },
  event: { label: "❓ 인카운터", fields: [], make: () => ({ kind: "event" }) },
  gold: { label: "💰 골드 ±", fields: [{ key: "amount", label: "양", type: "number" }], make: () => ({ kind: "gold", amount: 10 }) },
  heal: { label: "❤ 회복", fields: [{ key: "pct", label: "비율(0~1)", type: "number", step: 0.1 }, { key: "revive", label: "전투불능 부활", type: "bool" }], make: () => ({ kind: "heal", pct: 0.5 }) },
  grantStatus: { label: "✨ 상태 부여(다음 전투)", fields: [{ key: "charId", label: "대상 charId(빈칸=전원)", type: "text" }, { key: "statusId", label: "상태 id", type: "text" }, { key: "stacks", label: "스택", type: "number" }, { key: "duration", label: "지속", type: "number" }], make: () => ({ kind: "grantStatus", statusId: "", stacks: 1, duration: 2 }) },
  text: { label: "💬 대사/로그", fields: [{ key: "text", label: "내용", type: "text" }], make: () => ({ kind: "text", text: "" }) },
};

/** 추가 카탈로그(표시 순서) — 상호작용 먼저, 데코 뒤. */
export const LAYER_KINDS: string[] = ["combat", "reward", "shop", "event", "gold", "heal", "grantStatus", "text"];

/** 레이어 1줄 요약(리스트 표기). */
export function layerSummary(L: Layer): string {
  switch (L.kind) {
    case "combat": return `전투 (${L.rosterPreset ?? "battle"}${L.boss ? " · 진형" : ""})`;
    case "reward": return "보상 3택1";
    case "shop": return "상점";
    case "event": return "인카운터(랜덤)";
    case "gold": return `골드 ${L.amount >= 0 ? "+" : ""}${L.amount}`;
    case "heal": return `회복 ${Math.round(L.pct * 100)}%${L.revive ? " · 부활" : ""}`;
    case "grantStatus": return `상태 ${L.statusId || "?"}×${L.stacks} (${L.charId || "전원"})`;
    case "text": return `"${L.text}"`;
  }
}
