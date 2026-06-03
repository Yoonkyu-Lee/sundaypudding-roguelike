// 런 레지스트리 파사드 (7장) — 디자이너가 저작한 RunDef 모음. 진실 = 레포 JSON(에디터가 편집·내보내기).
// 코어는 RunDef 객체를 인자로 받음(순수); JSON 로딩은 데이터 경계에서.
// 레지스트리 본체 = runs.generated.ts — dev-write 미들웨어가 *.json을 스캔해 자동 재생성(F3).
import type { RunDef } from "../../core/types.ts";
import { RUNS } from "./runs.generated.ts";

export { RUNS };

export const DEFAULT_RUN: RunDef = RUNS.yain ?? Object.values(RUNS)[0];

// 본거지 편성: 선택한 1~4 캐릭을 기본 포메이션 슬롯에 순서대로 배치(전열 2 + 후열 2). 이후 파티 편성에서 재배치.
const DEFAULT_SLOTS = [
  { row: 1, col: 0 }, // 전열
  { row: 2, col: 0 }, // 전열
  { row: 1, col: 2 }, // 후열
  { row: 2, col: 2 }, // 후열
];
export function rosterFromIds(charIds: string[]): { charId: string; pos: { row: number; col: number } }[] {
  return charIds.slice(0, DEFAULT_SLOTS.length).map((charId, i) => ({ charId, pos: { ...DEFAULT_SLOTS[i] } }));
}
