// 전투 구성(배치) 데이터. 아군/적 그리드 좌표 배치. (2.1)
import type { FormationLayout, Pos } from "../contract/types.ts";

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

// 적 구성 기본 테이블 — 콘텐츠 소스는 노드의 인라인 roster(레이어 소유). 이 표는 ① 에디터 새 combat 레이어 기본 시드
// ② 엔진 안전 fallback(roster 비면 battle) ③ 레거시 type 노드 경로(run/run.ts)로만 쓰임. (구 rosterPreset 폐기)
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
