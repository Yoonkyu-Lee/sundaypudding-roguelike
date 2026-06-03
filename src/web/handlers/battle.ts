// 전투 입력 핸들러 — 스킬 선택·타겟팅(단일/자유다중)·취소·스킵·시트·일시정지. main에서 분리(글루).
import { SKILLS } from "../../data/skills.ts";
import type { Handlers } from "../render.ts";
import type { AppCtx } from "./ctx.ts";

export function makeBattleHandlers(ctx: AppCtx): Handlers {
  const { ui } = ctx;
  return {
    onSkill(skillId) {
      const run = ctx.getRun();
      if (ctx.isBusy() || !run.battle || run.battle.phase !== "inProgress") return;
      const sk = SKILLS[skillId];
      if (sk?.target === "self") {
        // 자기 대상은 즉시 시전 (앵커=자신 위치)
        const actor = run.battle.units.find((u) => u.uid === run.battle!.current!.uid)!;
        ctx.battleStep({ type: "skill", skillId, targetCell: { ...actor.pos } });
        return;
      }
      ui.selectedSkillId = skillId;
      ui.hoverCell = null;
      ui.pickedCells = [];
      ctx.render();
    },
    onCellClick(pos) {
      if (ctx.isBusy() || !ui.selectedSkillId) return;
      const sk = SKILLS[ui.selectedSkillId];
      if (sk.area?.kind === "free") {
        const count = sk.area.count;
        if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
        if (ui.pickedCells.length >= count) ctx.battleStep({ type: "skill", skillId: ui.selectedSkillId, cells: ui.pickedCells.slice() });
        else ctx.render();
      } else {
        ctx.battleStep({ type: "skill", skillId: ui.selectedSkillId, targetCell: pos });
      }
    },
    onCellHover(pos) {
      if (!ui.selectedSkillId) return;
      const cur = ui.hoverCell;
      if ((pos?.row ?? -9) !== (cur?.row ?? -9) || (pos?.col ?? -9) !== (cur?.col ?? -9)) {
        ui.hoverCell = pos;
        ctx.render();
      }
    },
    onCancel() {
      ctx.endTargeting();
      ctx.render();
    },
    onSkip() {
      if (!ctx.isBusy()) ctx.battleStep({ type: "skip" });
    },
    onNewBattle() {
      ctx.restart(); // 전투 화면의 '새 전투' = 런 재시작
    },
    onOpenSheet(uid) {
      ui.sheetUid = uid; // 전투 유닛 프로필(아군/적)
      ctx.render();
    },
    onToggleDetail() {
      ui.sheetDetail = !ui.sheetDetail; // 전역 자세히(피해 분해/스탯 원본 병기)
      ctx.render();
    },
    onPause() { ctx.openPause(); },
  };
}
