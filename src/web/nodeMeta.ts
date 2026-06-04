// 노드 종류 표시(아이콘/이름) — 런 렌더와 런 에디터 공용. (도메인 명칭: UI-GLOSSARY)
import type { NodeType } from "../core/types.ts";

export const TYPE_ICON: Record<NodeType, string> = {
  start: "📍", battle: "⚔️", elite: "💀", shop: "🛒", encounter: "❓", rest: "🏕️", boss: "👑", clear: "🚩",
};
export const TYPE_NAME: Record<NodeType, string> = {
  start: "입장", battle: "전투", elite: "엘리트", shop: "상점", encounter: "인카운터", rest: "휴식", boss: "보스", clear: "클리어",
};
/** 에디터 카탈로그에서 배치 가능한 노드 종류(입장 start는 층당 1개 시드 — 제외). */
export const CATALOG_TYPES: NodeType[] = ["battle", "elite", "boss", "shop", "rest", "encounter", "clear"];
