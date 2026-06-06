// 면적 스킬 기하 — 앵커칸 + AreaShape → 영향 칸들(순수 기하, 엔진 상태 무관).
// 프론트 타겟팅 풋프린트 하이라이트용(구 core/combat/targeting.computeAreaCells — 코어 은퇴로 프론트 이주).
// 결정/판정은 Rust 엔진(compute_area_cells)이 진실원; 이건 호버 미리보기 표시 기하만.
import type { AreaShape, Pos } from "../../core/types.ts";

export function computeAreaCells(anchor: Pos, area: AreaShape | undefined, rows: number, cols: number): Pos[] {
  const a = area ?? { kind: "single" as const };
  const cells: Pos[] = [];
  const push = (r: number, c: number) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) cells.push({ row: r, col: c });
  };
  switch (a.kind) {
    case "single": push(anchor.row, anchor.col); break;
    case "row": for (let c = 0; c < cols; c++) push(anchor.row, c); break;
    case "col": for (let r = 0; r < rows; r++) push(r, anchor.col); break;
    case "square": {
      const rad = a.radius ?? 1;
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) push(anchor.row + dr, anchor.col + dc);
      break;
    }
    case "cross": {
      const rad = a.radius ?? 1;
      push(anchor.row, anchor.col);
      for (let d = 1; d <= rad; d++) {
        push(anchor.row + d, anchor.col); push(anchor.row - d, anchor.col);
        push(anchor.row, anchor.col + d); push(anchor.row, anchor.col - d);
      }
      break;
    }
    case "all": for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) push(r, c); break;
  }
  return cells;
}
