// rich 행동 열거 — getLegalActions(단일타겟 targetUid만)이 못 내보내는 엔진 입력 형태를 추가로 자극.
// (Codex 적대검토 (c): 명령공간 커버 확대) — 웹 UI는 targetCell/cells를 보내므로 엔진은 이 형태를 받아들인다.
// resolveSkill: anchor = targetCell ?? targetUid위치 ?? actor위치; free AoE는 cells 사용(targeting.ts areaTargets).
// 따라서 빈칸 AoE 앵커·free-cell 선택을 fuzz하려면 targetCell/cells를 직접 생성해야 한다.
//
// 불변: step()이 throw하는 행동(쿨다운>0·빙결·미지 스킬)은 절대 포함하지 않는다(getLegalActions와 동일 가용성 필터).
// 결정론: 입력 state만으로 동일 목록·동일 순서(골든/self-consistency 안정).
import type { Action, GameState, Pos } from "../../types.ts";
import { SKILLS } from "../../../data/skills.ts";
import { getLegalActions } from "../../engine.ts";
import { isFrozen, samePos, unitById } from "../../util.ts";

const ROWS = 4;
const COLS = 4;

/** getLegalActions 기반 + AoE 앵커(targetCell, 빈칸 포함)·free AoE(cells) 변형을 더한 엔진-수용 행동 목록. */
export function enumerateRichActions(state: GameState): Action[] {
  const out: Action[] = getLegalActions(state).map((a) => a.action); // 베이스라인(skip + targetUid 단일타겟)
  if (state.phase !== "inProgress" || !state.current) return out;
  const actor = unitById(state, state.current.uid);
  if (isFrozen(actor)) return out; // 빙결 = skip만

  const cellsAll: Pos[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cellsAll.push({ row: r, col: c });

  for (const skillId of actor.activeSkillIds) {
    const skill = SKILLS[skillId];
    if (!skill || skill.active === false) continue;
    if ((actor.cooldowns[skillId] ?? 0) > 0) continue; // step() throw 방지
    if (skill.usableFrom && skill.usableFrom.length > 0 && !skill.usableFrom.some((c) => samePos(c, actor.pos))) continue;
    if (skill.target === "self") continue; // self 앵커는 고정 — 칸 변형 의미 없음

    const side = skill.target === "enemy" ? (actor.side === "ally" ? "enemy" : "ally") : actor.side;
    const occupied = state.units.filter((u) => u.alive && u.side === side).map((u) => u.pos);
    const isOcc = (p: Pos) => occupied.some((o) => samePos(o, p));
    const empties = cellsAll.filter((p) => !isOcc(p));

    if (skill.area?.kind === "free") {
      for (const p of occupied) out.push({ type: "skill", skillId, cells: [{ ...p }] }); // 점유 칸 선택
      if (occupied.length >= 2) out.push({ type: "skill", skillId, cells: [{ ...occupied[0] }, { ...occupied[1] }] }); // 다중 선택
      if (empties.length > 0) out.push({ type: "skill", skillId, cells: [{ ...empties[0] }] }); // 빈 free-cell(무효 선택)
    } else {
      const sample = [...occupied, ...empties.slice(0, 3)]; // 점유 + 빈칸 일부(빈칸 AoE 앵커)
      for (const p of sample) out.push({ type: "skill", skillId, targetCell: { ...p } });
    }
  }
  return out;
}
