// 런 레지스트리 (7장) — 디자이너가 저작한 RunDef 모음. 진실 = 레포 JSON(에디터가 편집·내보내기).
// 코어는 RunDef 객체를 인자로 받음(순수); JSON 로딩은 여기(데이터 경계)에서.
import type { RunDef } from "../../core/types.ts";
import yainJson from "./yain.json" with { type: "json" };

// JSON은 NodeType 등을 string으로 넓혀 추론 → RunDef로 단언(스키마 검증은 core/run/graph.ts validateRun).
const yain = yainJson as unknown as RunDef;

export const RUNS: Record<string, RunDef> = {
  yain,
  // 후속(디자이너/에디터): 새 런 JSON을 여기 등록.
};

export const DEFAULT_RUN: RunDef = RUNS.yain;

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
