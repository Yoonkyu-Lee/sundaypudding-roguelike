// 전투 구성(배치) 데이터. 아군/적 그리드 좌표 배치. (2.1)
import type { FormationLayout, Pos } from "../core/types.ts";

export interface Placement {
  charId: string;
  pos: Pos;
}

export interface Encounter {
  id: string;
  name: string;
  allies: Placement[];
  enemies: Placement[];
  /** 보스전 여부. 적 진형 보너스는 보스전에만 적용(6.3) */
  boss?: boolean;
  /** 아군 열보너스 배치 override. 없으면 표준(6.3) */
  allyFormation?: FormationLayout;
  /** 보스 기믹용 적 열보너스 배치(6.3) */
  enemyFormation?: FormationLayout;
}

export const DEMO_ENCOUNTER: Encounter = {
  id: "demo",
  name: "데모 조우",
  allies: [
    { charId: "beef", pos: { row: 1, col: 0 } }, // 전방 탱
    { charId: "pudding", pos: { row: 2, col: 1 } }, // 한 칸 뒤 딜러
  ],
  enemies: [
    { charId: "slime", pos: { row: 1, col: 0 } }, // 전방 (근접 사정권)
    { charId: "slime", pos: { row: 2, col: 0 } }, // 전방
    { charId: "frostspirit", pos: { row: 1, col: 2 } }, // 후방 → 근접기 안 닿음(밀치기/원거리 필요)
  ],
};
