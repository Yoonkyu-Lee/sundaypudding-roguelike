// 게임 모드 (0.1/7.4) — 모드 = 런 베이스의 설정. 디자이너가 여기에 캠페인/챌린지 등을 데이터로 추가.
import type { GameMode } from "../core/types.ts";
import { ACTS } from "./maps.ts";

// 기본 로스터 (우익 4인). 모드별로 다른 로스터 가능.
const DEFAULT_ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } }, // 김두한 전방
  { charId: "shin", pos: { row: 2, col: 0 } }, // 신영균 전방
  { charId: "shanghai", pos: { row: 1, col: 2 } }, // 상하이 조 후방
  { charId: "cho", pos: { row: 2, col: 2 } }, // 조병옥 후방
];

export const MODES: Record<string, GameMode> = {
  normal: {
    id: "normal",
    name: "일반",
    desc: "3개 액트를 돌파. 숙련도가 보상 스킬 tier를 해금.",
    roster: DEFAULT_ROSTER,
    acts: ACTS,
    useMastery: true,
  },
  // 후속(디자이너): campaign(1:多 서사), challenge(점수/제약) 등 — 같은 형태로 추가.
};

export const DEFAULT_MODE: GameMode = MODES.normal;

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
