// 포메이션 배치 데이터 (6장). 열별 보너스 "총량" — 그 열 유닛들에게 분배(총량보존, 6.1).
import type { FormationLayout } from "../contract/types.ts";

/** 표준 배치(일반 전투 통일, 6.3). 앞 2열=공격, 뒤 2열=방어. */
export const STANDARD_FORMATION: FormationLayout = {
  id: "standard",
  columns: [
    { attackPower: 4 }, // 0열
    { attackPower: 4 }, // 1열
    { defensePower: 4 }, // 2열
    { defensePower: 4 }, // 3열
  ],
};
