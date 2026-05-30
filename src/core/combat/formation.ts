// 포메이션 열보너스 — 총량보존(같은 열 유닛 수로 분배). (6.1)
import type { FormationBonusKind, GameState, Unit } from "../types.ts";

export function getFormationBonus(state: GameState, unit: Unit, kind: FormationBonusKind): number {
  const layout = unit.side === "ally" ? state.allyFormation : state.enemyFormation;
  if (!layout) return 0;
  const total = layout.columns[unit.pos.col]?.[kind] ?? 0;
  if (total === 0) return 0;
  const count = state.units.filter(
    (u) => u.alive && u.side === unit.side && u.pos.col === unit.pos.col,
  ).length;
  return count > 0 ? total / count : 0; // 분수 허용(4/3 등), 최종 적용 시 반올림
}
