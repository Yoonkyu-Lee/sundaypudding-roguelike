// 노드 에디터 폼의 진실원 (Phase E) — 레이어 kind별 편집 필드 스펙(선언적) + 카탈로그 + 요약/기본값.
// 단순 필드(숫자/텍스트/토글/select)는 폼 제너레이터가 자동 렌더. 리치 위젯(roster 4×4·선택지)은 E3.
import type { Layer } from "../../contract/types.ts";
import { NODE_ROSTERS } from "../../content/encounters.ts";

export interface FieldSpec { key: string; label: string; type: "number" | "text" | "bool" | "select" | "roster" | "csv"; options?: string[]; optionsFrom?: "chars" | "statuses"; allowEmpty?: boolean; step?: number; }
export interface LayerSpec { label: string; fields: FieldSpec[]; make: () => Layer; }

export const LAYER_SPECS: Record<string, LayerSpec> = {
  combat: { label: "⚔ 전투", fields: [{ key: "boss", label: "진형 보너스", type: "bool" }], make: () => ({ kind: "combat", roster: NODE_ROSTERS.battle.map((e) => ({ charId: e.charId, pos: { ...e.pos } })) }) }, // 기본 적(깡패) 시드 — 전장 그리드서 편집
  reward: { label: "🎁 보상", fields: [{ key: "tier", label: "등급(1~3, 높을수록 선택지·아이템↑)", type: "number" }], make: () => ({ kind: "reward", tier: 1 }) },
  shop: { label: "🏪 상점", fields: [], make: () => ({ kind: "shop" }) },
  event: { label: "❓ 인카운터", fields: [], make: () => ({ kind: "event" }) },
  classChange: { label: "🔀 전직", fields: [{ key: "max", label: "전직 가능 인원", type: "number" }], make: () => ({ kind: "classChange", max: 1 }) }, // 4.7 — 전직노드(2~3)·쉼터(1)

  gold: { label: "💰 골드 ±", fields: [{ key: "amount", label: "양", type: "number" }], make: () => ({ kind: "gold", amount: 10 }) },
  heal: { label: "❤ 회복", fields: [{ key: "pct", label: "퍼센트(0~100)", type: "number" }, { key: "revive", label: "전투불능 부활", type: "bool" }], make: () => ({ kind: "heal", pct: 50 }) },
  grantStatus: { label: "✨ 상태 부여(다음 전투)", fields: [{ key: "charId", label: "대상(비움=전원)", type: "select", optionsFrom: "chars", allowEmpty: true }, { key: "statusId", label: "상태", type: "select", optionsFrom: "statuses" }, { key: "stacks", label: "스택", type: "number" }, { key: "duration", label: "지속", type: "number" }], make: () => ({ kind: "grantStatus", statusId: "", stacks: 1, duration: 2 }) },
  text: { label: "💬 대사/로그", fields: [{ key: "text", label: "내용", type: "text" }], make: () => ({ kind: "text", text: "" }) },
  partyChange: { label: "👥 파티 변동(합류/이탈)", fields: [{ key: "add", label: "합류(charId, 쉼표구분)", type: "csv" }, { key: "remove", label: "이탈(charId, 쉼표구분)", type: "csv" }], make: () => ({ kind: "partyChange", add: [], remove: [] }) }, // 런 중 스토리 합류/이탈
  resource: { label: "⚖ 자원 변경", fields: [{ key: "id", label: "자원 id(민심 등)", type: "text" }, { key: "delta", label: "증감", type: "number" }], make: () => ({ kind: "resource", id: "", delta: 0 }) }, // 런 자원 게이지(R1)
};

/** core 슬롯 추가 카탈로그(상호작용 먼저, 데코 뒤). */
export const LAYER_KINDS: string[] = ["combat", "reward", "shop", "event", "classChange", "gold", "heal", "grantStatus", "text", "partyChange", "resource"];
/** onEnter/onResolve 슬롯 카탈로그 — 데코레이터만(즉시 실행). */
export const DECO_KINDS: string[] = ["gold", "heal", "grantStatus", "text", "partyChange", "resource"];

/** 레이어 1줄 요약(리스트 표기). */
export function layerSummary(L: Layer): string {
  switch (L.kind) {
    case "combat": return `전투 (적 ${L.roster?.length ?? 0}${L.boss ? " · 진형" : ""})`;
    case "reward": return "보상 3택1";
    case "shop": return "상점";
    case "event": return "인카운터(랜덤)";
    case "classChange": return `전직 (최대 ${L.max ?? 1}명)`;
    case "gold": return `골드 ${L.amount >= 0 ? "+" : ""}${L.amount}`;
    case "heal": return `회복 ${Math.round(L.pct * 100)}%${L.revive ? " · 부활" : ""}`;
    case "grantStatus": return `상태 ${L.statusId || "?"}×${L.stacks} (${L.charId || "전원"})`;
    case "text": return `"${L.text}"`;
    case "partyChange": return `파티 변동 (+${L.add?.length ?? 0}/−${L.remove?.length ?? 0})`;
    case "resource": return `자원 ${L.id || "?"} ${L.delta >= 0 ? "+" : ""}${L.delta}`;
  }
}
