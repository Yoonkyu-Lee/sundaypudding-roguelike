// 타겟팅·면적·합법행동 (2.4/2.7/8.2). 위치 마스크, 면적 모양, 명중, 행동 공간 열거.
import type { AreaShape, GameState, LegalAction, Pos, Skill, Unit } from "../types.ts";
import { SKILLS } from "../../data/skills.ts";
import { aliveUnits, clamp, isFrozen, samePos, statMod, unitById } from "../util.ts";

/** 도달 가능 열(reach, 2.4): **최전열(살아있는 적의 최소 열)부터 연속 n칸.** 근접은 전열에서 안쪽으로 인접 n칸만 닿음(빈 열을 건너뛰어 먼 열에 닿지 않음). 전열이 죽으면 다음 최전열로 전진 → 적이 있는 한 항상 ≥1열(교착 방지). */
export function reachableColumns(state: GameState, side: "ally" | "enemy", reach: number): number[] {
  const occ = aliveUnits(state, side).map((u) => u.pos.col);
  if (occ.length === 0 || reach <= 0) return [];
  const front = Math.min(...occ);
  const out: number[] = [];
  for (let c = front; c < front + reach; c++) out.push(c); // 전열부터 연속(인접) n칸
  return out;
}

export function validTargets(state: GameState, actor: Unit, skill: Skill): Unit[] {
  if (skill.target === "self") return [actor];
  const side = skill.target === "enemy" ? (actor.side === "ally" ? "enemy" : "ally") : actor.side;
  let cands = aliveUnits(state, side);
  if (skill.reach !== undefined) {
    // 동적 근접: 전방 reach개 점유 열만 (전방이 비면 다음 열이 전열 → 교착 방지)
    const cols = new Set(reachableColumns(state, side, skill.reach));
    cands = cands.filter((c) => cols.has(c.pos.col));
  } else if (skill.targetCells && skill.targetCells.length > 0) {
    cands = cands.filter((c) => skill.targetCells!.some((cell) => samePos(cell, c.pos)));
  }
  return cands;
}

/** 진영 그리드 크기(유닛 배치 기준, 최소 4×4) */
export function sideDims(state: GameState, side: "ally" | "enemy"): { rows: number; cols: number } {
  let rows = 4;
  let cols = 4;
  for (const u of state.units) {
    if (u.side !== side) continue;
    rows = Math.max(rows, u.pos.row + 1);
    cols = Math.max(cols, u.pos.col + 1);
  }
  return { rows, cols };
}

/** 면적 모양 → 앵커 기준 영향 칸 목록. 엔진(효과 적용)과 웹(바닥 하이라이트)이 공유. */
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

/** 면적 스킬의 영향 유닛. 앵커=칸(Pos). free면 cells(자유선택). single/all 외엔 풋프린트 내 같은 진영 유닛 */
export function areaTargets(state: GameState, actor: Unit, skill: Skill, anchor: Pos, freeCells?: Pos[]): Unit[] {
  if (skill.target === "self") return [actor];
  const side = skill.target === "enemy" ? (actor.side === "ally" ? "enemy" : "ally") : actor.side;
  const area = skill.area;
  const unitsIn = (cells: Pos[]) =>
    state.units.filter((u) => u.alive && u.side === side && cells.some((c) => c.row === u.pos.row && c.col === u.pos.col));
  if (!area || area.kind === "single") return unitsIn([anchor]);
  if (area.kind === "all") return validTargets(state, actor, skill); // 마스크 존중
  if (area.kind === "free") return unitsIn(freeCells ?? []);
  const dims = sideDims(state, side);
  return unitsIn(computeAreaCells(anchor, area, dims.rows, dims.cols));
}

export function computeHitChance(actor: Unit, skill: Skill, target: Unit): number {
  if (skill.alwaysHit || skill.target !== "enemy") return 100;
  return clamp(Math.round(actor.accuracy + statMod(actor, "accuracy") + skill.accuracy - (target.evasion + statMod(target, "evasion"))), 0, 100);
}

export function getLegalActions(state: GameState): LegalAction[] {
  if (state.phase !== "inProgress" || !state.current) return [];
  const actor = unitById(state, state.current.uid);

  if (isFrozen(actor)) {
    return [{ action: { type: "skip" }, label: "스킵 (빙결)" }];
  }

  const out: LegalAction[] = [];
  for (const skillId of actor.activeSkillIds) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    if (skill.active === false) continue; // 순수 패시브(능동 파트 없음)는 스킬창에 안 뜸
    if ((actor.cooldowns[skillId] ?? 0) > 0) continue; // 쿨다운 중 (2.10)
    if (skill.usableFrom && skill.usableFrom.length > 0) {
      if (!skill.usableFrom.some((c) => samePos(c, actor.pos))) continue;
    }
    const targets = validTargets(state, actor, skill);
    if (targets.length === 0) continue; // 사정권에 대상 없음 → 사용 불가
    for (const tgt of targets) {
      out.push({
        action: { type: "skill", skillId, targetUid: tgt.uid },
        label: `${skill.name} → ${tgt.name}`,
        skillName: skill.name,
        targetUid: tgt.uid,
        hitChance: computeHitChance(actor, skill, tgt),
      });
    }
  }

  // 쓸 수 있는 기술이 하나도 없으면 효과 없는 스킵 (2.10)
  if (out.length === 0) {
    return [{ action: { type: "skip" }, label: "스킵 (쓸 수 있는 기술 없음)" }];
  }
  // 자발적 대기: 아무것도 안 하고 턴 넘기기 (쿨 소모·효과 없음). 모든 유닛 상시 선택지.
  out.push({ action: { type: "skip" }, label: "대기 (턴 넘김)" });
  return out;
}
