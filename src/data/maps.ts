// 맵 생성 데이터 (7장) — 디자이너 편집. 값만 여기, 생성 메커니즘은 core/run/map.ts(genMap).
import type { MapGenConfig } from "../core/types.ts";

// 액트별 맵 (7.3 다층, 3액트 고정). 액트가 깊어질수록 깊이↑·엘리트 가중↑ = 난이도 램프.
export const ACTS: MapGenConfig[] = [
  // 액트 1 — 입문: 깊이 3, 잡몹 위주
  { rows: 3, startWidth: [2, 3], firstRowType: "battle", nodeWeights: { battle: 3, elite: 1, rest: 1, shop: 1, encounter: 1 }, branch: { keepQChance: 50, extraSameChance: 40, extraLeftChance: 40 } },
  // 액트 2 — 심화: 깊이 4, 엘리트 가중↑
  { rows: 4, startWidth: [2, 3], firstRowType: "battle", nodeWeights: { battle: 3, elite: 2, rest: 1, shop: 1, encounter: 1 }, branch: { keepQChance: 50, extraSameChance: 45, extraLeftChance: 45 } },
  // 액트 3 — 최종: 깊이 5, 엘리트 위주
  { rows: 5, startWidth: [3, 3], firstRowType: "battle", nodeWeights: { battle: 2, elite: 3, rest: 1, shop: 1, encounter: 1 }, branch: { keepQChance: 55, extraSameChance: 50, extraLeftChance: 50 } },
];

// 기본 맵 = 액트 1 (하위호환: 단일 맵 참조처).
export const DEFAULT_MAP: MapGenConfig = ACTS[0];
