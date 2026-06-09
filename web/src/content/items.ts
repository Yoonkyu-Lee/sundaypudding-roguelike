// 장착 아이템 (4.3) — 데이터 주도. 스탯은 오직 장착으로만 변동(4.2).
// 무기 = 공격 측(dmgFlat·crit%), 방어구 = 생존 측(hp·쉴드획득). 지닌물건 = 후속(데이터 없음).
// 메커니즘(스탯 합산·equip)은 엔진(core), 값은 여기.
//
// 진실원 = items.json (아이템 에디터가 저작·내보내기 — jobs.json/runs와 동일 패턴). 이 파일은 타입드 로더.
//   items.json = { items: Record<id,ItemDef>, pool: string[] }. pool = 상점/보상 추첨 등장 풀.
import type { ItemDef } from "../contract/types.ts";
import ITEMS_JSON from "./items.json" with { type: "json" };

export const ITEMS: Record<string, ItemDef> = ITEMS_JSON.items as unknown as Record<string, ItemDef>;

/** 상점/보상 등장 가능한 아이템 풀 (출현 순서는 추첨). */
export const ITEM_POOL: string[] = ITEMS_JSON.pool as unknown as string[];
