// 포메이션 열보너스 — 총량보존(같은 열 유닛 수로 분배). (6.1)
// 정수 분배: 몫(floor) + 나머지를 uid 오름차순으로 +1씩 → 유닛별 정수 보너스, 분배 합 == total 정확 보존.
// (NUMERIC-POLICY 옵션 B: 분수 제거 → 부동소수 의존 0, K1 "반올림 후 총량 비보존" 결함 해소. 결정론은 uid 정렬.)
import type { FormationBonusKind, GameState, Unit } from "../types.ts";

export function getFormationBonus(state: GameState, unit: Unit, kind: FormationBonusKind): number {
  const layout = unit.side === "ally" ? state.allyFormation : state.enemyFormation;
  if (!layout) return 0;
  const total = layout.columns[unit.pos.col]?.[kind] ?? 0;
  if (total === 0) return 0;
  // 같은 열·같은 편·생존 유닛(자신 포함)을 uid 오름차순 정렬 → 몫 + 나머지 분배.
  const peers = state.units
    .filter((u) => u.alive && u.side === unit.side && u.pos.col === unit.pos.col)
    .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  const count = peers.length;
  if (count === 0) return 0;
  const base = Math.floor(total / count); // floor → 음수 total에서도 나머지 0..count-1
  const rem = total - base * count; // = total mod count (정수 total 가정)
  const rank = peers.findIndex((u) => u.uid === unit.uid);
  return base + (rank < rem ? 1 : 0); // 앞(uid 작은) rem명에게 +1 → 합 == total
}
