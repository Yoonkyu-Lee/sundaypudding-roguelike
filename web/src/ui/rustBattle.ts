// 전투 서브컨트롤러 (rustRun에서 분리) — IPC 전투 루프(주사위 연출·AI 자동진행·step·타겟팅 미리보기) + 전투 핸들러.
// 공유 가변상태(view/cur/busy/logEvents/tgtInfo)는 BattleState `st`를 **참조로** 받아 rustRun과 공유.
import type { Action, GameEvent, Observation } from "../contract/types.ts";
import type { RunView } from "../contract/run.ts";
import { SKILLS } from "../content/skills.ts";
import { DEFAULT_RUN } from "../content/runs/index.ts";
import { renderAppObs, type ObsTargeting } from "./render.ts";
import type { RollView, TimelinePanel } from "./battle/timelinePanel.ts";
import type { Handlers, SkillBarEntry, Ui } from "./battle/shared.ts";
import { renderPause, type ShellHandlers } from "./shell.ts";
import type { RustOverlay } from "./rustOverlay.ts";
import { grantWin } from "./meta.ts";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
interface BattleView { observation: Observation | null; skillBar: SkillBarEntry[] }
interface BattleStepResult { eventDelta: GameEvent[]; observation: Observation | null; view: RunView }

/** rustRun과 **참조 공유**하는 가변 런/전투 상태. */
export interface BattleState {
  view: RunView | null;
  cur: { obs: Observation; bar: SkillBarEntry[] } | null;
  busy: boolean;
  logEvents: GameEvent[];
  tgtInfo: ObsTargeting | null;
}
/** 전투 컨트롤러가 부모(rustRun)에서 받는 의존성. */
export interface BattleCtx {
  app: HTMLElement;
  ui: Ui;
  panel: TimelinePanel;
  invoke: Invoke;
  st: BattleState;
  shell: ShellHandlers;
  getAppState: () => string;
  getPauseOpen: () => boolean;
  setPauseOpen: (v: boolean) => void;
  getOverlay: () => RustOverlay | null;
  render: () => void; // 최상위 디스패치(전투→비전투 전환 시)
  persist: () => void;
  showErr: (where: string, err: unknown) => void;
  noteProgress: () => void;
  openOverlay: () => void;
}
export interface BattleController {
  enterBattle: () => Promise<void>;
  renderBattle: () => void;
  battleHandlers: Handlers;
}

export function createBattleController(ctx: BattleCtx): BattleController {
  const { app, ui, panel, invoke, st, shell } = ctx;

  async function refreshBattle(): Promise<void> {
    try { const bv = (await invoke("run_battle_view")) as BattleView; st.cur = bv.observation ? { obs: bv.observation, bar: bv.skillBar } : null; } catch (e) { ctx.showErr("run_battle_view", e); }
  }
  function renderBattle(): void {
    if (!st.cur) return;
    renderAppObs(app, st.cur.obs, st.cur.bar, st.logEvents, ui, battleHandlers, panel, st.tgtInfo ?? undefined);
    if (ctx.getPauseOpen()) renderPause(app, shell);
    const ov = ctx.getOverlay();
    if (ov) ov.renderOverlay();
  }
  // 호버 칸의 HP 손실 예고 + 끼어들기 고스트를 IPC로 가져와 캐시 후 재렌더.
  async function fetchTargeting(): Promise<void> {
    if (!ui.selectedSkillId || !ui.hoverCell) { st.tgtInfo = null; renderBattle(); return; }
    const sid = ui.selectedSkillId; const pos = ui.hoverCell;
    try { st.tgtInfo = (await invoke("run_battle_targeting", { skillId: sid, row: pos.row, col: pos.col })) as ObsTargeting; } catch { st.tgtInfo = null; }
    if (ui.selectedSkillId === sid && ui.hoverCell?.row === pos.row && ui.hoverCell?.col === pos.col) renderBattle();
  }
  // 라운드 시작 SPD 주사위 연출(roundStart 델타). 연출 끝나면 onDone에서 진행. 연출 없으면 false.
  function playDice(delta: GameEvent[]): boolean {
    if (!st.cur) return false;
    const rs = [...delta].reverse().find((e) => e.t === "roundStart");
    if (!rs || rs.t !== "roundStart") return false;
    const all = [...st.cur.obs.allies, ...st.cur.obs.enemies];
    const views: RollView[] = rs.rolls.map((r) => { const u = all.find((x) => x.uid === r.uid); return { ...r, name: u?.name ?? r.uid, avatar: u?.avatar, side: (u?.side ?? "ally") as "ally" | "enemy" }; });
    st.busy = true;
    renderBattle(); // 셸·패널 마운트 보장
    panel.playRoll(rs.round, views, rs.order.map((e) => e.uid), () => { st.busy = false; renderBattle(); void maybeAuto(); });
    return true;
  }
  async function enterBattle(): Promise<void> {
    ui.selectedSkillId = null; ui.hoverCell = null; st.tgtInfo = null; st.logEvents = [];
    await refreshBattle();
    const init = (await invoke("run_battle_init")) as BattleStepResult;
    st.logEvents.push(...init.eventDelta);
    if (!playDice(init.eventDelta)) { renderBattle(); await maybeAuto(); }
  }
  async function maybeAuto(): Promise<void> {
    while (ctx.getAppState() === "run" && st.view?.phase === "battle" && st.cur && st.cur.obs.phase === "inProgress" && st.cur.obs.current?.side === "enemy") {
      await new Promise((r) => setTimeout(r, 240)); await step("run_battle_ai_step");
    }
  }
  async function step(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (st.busy) return; st.busy = true;
    let res: BattleStepResult;
    try { res = (await invoke(cmd, args)) as BattleStepResult; } catch (e) { ctx.showErr(cmd, e); renderBattle(); return; }
    st.logEvents.push(...res.eventDelta);
    ui.damaged = new Set(res.eventDelta.flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
    ui.moved = new Set(res.eventDelta.flatMap((e) => (e.t === "move" ? [e.uid] : [])));
    const dlg = [...res.eventDelta].reverse().find((e) => e.t === "dialog");
    ui.dialog = dlg && dlg.t === "dialog" ? { speaker: dlg.speaker, text: dlg.text } : null;
    // 전투 승리 시 생존 아군 숙련도 XP(5.3) — DEFAULT_RUN.useMastery일 때만(TS driveBattle 대응).
    if (res.eventDelta.some((e) => e.t === "battleEnd" && e.phase === "allyWin") && DEFAULT_RUN.useMastery) {
      grantWin((res.view.party ?? st.view?.party ?? []).filter((p) => p.alive).map((p) => p.charId));
    }
    st.view = res.view; st.busy = false;
    ctx.persist(); // 매 행동 후 영속(전투 중 포함 — GameState.log skip이라 안전)
    if (st.view.phase !== "battle") {
      // 전투 종료 — 막타·승패를 잠깐 보여준 뒤 런(보상/패배)으로 복귀(TS driveBattle 1.1s 대응).
      if (res.observation) { st.cur = { obs: res.observation, bar: [] }; renderBattle(); }
      st.busy = true;
      setTimeout(() => { st.busy = false; st.cur = null; ctx.render(); }, 1100);
      return;
    }
    await refreshBattle();
    if (playDice(res.eventDelta)) return; // 새 라운드 주사위 → onDone에서 렌더+진행
    renderBattle(); await maybeAuto();
  }

  const battleHandlers: Handlers = {
    onSkill: (id) => {
      if (st.busy || !st.cur || st.cur.obs.phase !== "inProgress") return;
      const sk = SKILLS[id];
      if (sk?.target === "self") { const actor = [...st.cur.obs.allies, ...st.cur.obs.enemies].find((u) => u.uid === st.cur!.obs.current?.uid); if (actor) void step("run_battle_step", { action: { type: "skill", skillId: id, targetCell: { ...actor.pos } } }); return; }
      ui.selectedSkillId = id; ui.hoverCell = null; ui.pickedCells = []; st.tgtInfo = null; renderBattle();
    },
    onCellClick: (pos) => {
      if (st.busy || !ui.selectedSkillId) return;
      const skillId = ui.selectedSkillId; const sk = SKILLS[skillId];
      if (sk?.area?.kind === "free") {
        if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
        if (ui.pickedCells.length >= sk.area.count) { const cells = ui.pickedCells.slice(); ui.selectedSkillId = null; ui.pickedCells = []; ui.hoverCell = null; st.tgtInfo = null; void step("run_battle_step", { action: { type: "skill", skillId, cells } }); }
        else renderBattle();
      } else { ui.selectedSkillId = null; ui.hoverCell = null; st.tgtInfo = null; void step("run_battle_step", { action: { type: "skill", skillId, targetCell: pos } }); }
    },
    onCellHover: (pos) => {
      if (!ui.selectedSkillId) return;
      // 변경 시에만 재렌더 — innerHTML 교체가 mouseenter 재발화 → 무한 재렌더로 클릭이 삼켜지는 것 방지.
      const c = ui.hoverCell;
      if ((pos?.row ?? -9) !== (c?.row ?? -9) || (pos?.col ?? -9) !== (c?.col ?? -9)) { ui.hoverCell = pos; st.tgtInfo = null; renderBattle(); void fetchTargeting(); }
    },
    onCancel: () => { ui.selectedSkillId = null; ui.hoverCell = null; ui.pickedCells = []; st.tgtInfo = null; renderBattle(); },
    onSkip: () => { if (st.busy) return; ui.selectedSkillId = null; void step("run_battle_step", { action: { type: "skip" } as Action }); },
    onToggleDetail: () => { ui.sheetDetail = !ui.sheetDetail; renderBattle(); },
    onNewBattle: () => shell.onNewRun(),
    onOpenSheet: (uid) => { ui.sheetUid = uid; void ctx.openOverlay(); },
    onPause: () => { ctx.setPauseOpen(true); ctx.render(); },
  };

  return { enterBattle, renderBattle, battleHandlers };
}
