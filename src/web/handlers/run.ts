// 런 입력 핸들러 — 노드 진입·보상·스킬 출전·상점·인카운터·파티 편성·집/일시정지. main에서 분리(글루).
import { enterNode, chooseReward, setActiveSkill, buyShopOffer, leaveShop, chooseEncounterOption } from "../../core/run.ts";
import type { RunHandlers } from "../runRender.ts";
import type { AppCtx } from "./ctx.ts";

export function makeRunHandlers(ctx: AppCtx): RunHandlers {
  const { ui } = ctx;
  return {
    onNode(id) {
      const run = ctx.getRun();
      if (ctx.isBusy() || run.phase !== "map") return;
      enterNode(run, id);
      ctx.resetUi();
      ctx.render();
    },
    onReward(id) {
      const run = ctx.getRun();
      if (ctx.isBusy() || run.phase !== "reward") return;
      chooseReward(run, id);
      ctx.render();
    },
    onRestart() { ctx.restart(); },
    onToggleSkill(charId, skillId) {
      const run = ctx.getRun();
      if (ctx.isBusy() || run.phase !== "map") return;
      setActiveSkill(run, charId, skillId);
      ctx.render();
    },
    onBuy(offerId) {
      const run = ctx.getRun();
      if (ctx.isBusy() || run.phase !== "shop") return;
      buyShopOffer(run, offerId);
      ctx.render();
    },
    onLeaveShop() {
      const run = ctx.getRun();
      if (ctx.isBusy() || run.phase !== "shop") return;
      leaveShop(run);
      ctx.resetUi();
      ctx.render();
    },
    onEncounterChoice(choiceId) {
      const run = ctx.getRun();
      if (ctx.isBusy() || run.phase !== "encounter") return;
      chooseEncounterOption(run, choiceId);
      ctx.resetUi();
      ctx.render();
    },
    onOpenParty(charId) {
      if (ctx.getRun().phase === "battle") return; // 비전투면 어디서나 편성
      ui.partyOpen = true;
      ui.sheetCharId = charId;
      ctx.render();
    },
    onToHub() { ctx.toHub(); }, // 승패 화면 "집으로"
    onPause() { ctx.openPause(); }, // 헤더 ⏸
  };
}
