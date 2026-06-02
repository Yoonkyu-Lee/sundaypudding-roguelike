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

// 노드 타입별 적 구성표 (7장). 디자이너 편집 영역 — 엔진은 키로 조회만(run/run.ts).
// 키는 NodeType 문자열("battle"|"elite"|"boss"). data는 core/run을 import하지 않으므로 string 키.
export const NODE_ROSTERS: Record<string, Placement[]> = {
  // 잡몹 (일반전투/기본값)
  battle: [
    { charId: "thug", pos: { row: 1, col: 0 } },
    { charId: "thug", pos: { row: 2, col: 0 } },
    { charId: "thug2", pos: { row: 0, col: 0 } },
  ],
  elite: [
    { charId: "thug2", pos: { row: 1, col: 0 } },
    { charId: "thug", pos: { row: 2, col: 0 } },
    { charId: "jung", pos: { row: 1, col: 2 } }, // 좌익 정진영
  ],
  // 좌익(조선공산당) 진영 — 보스전 적 진형 보너스 활성(6.3)
  boss: [
    { charId: "shim", pos: { row: 1, col: 0 } }, // 탱커(도발)
    { charId: "chunho", pos: { row: 2, col: 0 } }, // 암살자
    { charId: "jung", pos: { row: 1, col: 2 } }, // 딜러
    { charId: "doctor", pos: { row: 2, col: 2 } }, // 힐러
  ],
};

export const DEMO_ENCOUNTER: Encounter = {
  id: "demo",
  name: "데모 조우",
  allies: [
    { charId: "kim", pos: { row: 1, col: 0 } }, // 전방 브루저
    { charId: "shanghai", pos: { row: 2, col: 1 } }, // 한 칸 뒤 원거리 딜러
    { charId: "cho", pos: { row: 2, col: 2 } }, // 후방 서포터
  ],
  enemies: [
    { charId: "thug", pos: { row: 1, col: 0 } }, // 전방 (근접 사정권)
    { charId: "thug", pos: { row: 2, col: 0 } }, // 전방
    { charId: "thug2", pos: { row: 1, col: 2 } }, // 후방 → 근접기 안 닿음(원거리 필요)
  ],
};
