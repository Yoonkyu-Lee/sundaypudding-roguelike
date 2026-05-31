// 맵 생성 데이터 (7장) — 디자이너 편집. 값만 여기, 생성 메커니즘은 core/run/map.ts(genMap).
import type { MapGenConfig } from "../core/types.ts";

// 기본 런 맵: 깊이 3, 첫 행 전투(안전 시작), 타입 가중치 = 잡몹 위주 + 엘리트/휴식/상점/인카운터.
export const DEFAULT_MAP: MapGenConfig = {
  rows: 3,
  startWidth: [2, 3],
  firstRowType: "battle",
  nodeWeights: { battle: 3, elite: 1, rest: 1, shop: 1, encounter: 1 },
  branch: { keepQChance: 50, extraSameChance: 40, extraLeftChance: 40 },
};
