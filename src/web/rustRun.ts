// 풀 게임 Rust 하네스 (P2-7/P3) — `?core=rust&full=1`. 전체 로그라이크를 Rust RunSession(IPC)으로 구동.
// **비전투 = 실제 renderRunScreen, 전투 = 실제 renderAppObs**(진짜 셸·그리드·스킬카드·타임라인·로그·타겟팅). 엔진만 Rust, UI는 그대로.
import type { Action, GameEvent, Observation } from "../core/types.ts";
import type { RunView } from "../core/run.ts";
import { SKILLS } from "../data/skills.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { renderAppObs } from "./render.ts";
import { createTimelinePanel } from "./battle/timelinePanel.ts";
import type { Handlers, SkillBarEntry, Ui } from "./battle/shared.ts";

interface BattleView { observation: Observation | null; skillBar: SkillBarEntry[] }
interface BattleStepResult { eventDelta: GameEvent[]; observation: Observation | null; view: RunView }

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
function invoker(): Invoke | null {
  const t = (globalThis as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  return t?.core?.invoke ?? null;
}

export function mountRustRun(app: HTMLElement, startSeed: number): void {
  const invoke = invoker();
  if (!invoke) { app.innerHTML = `<div class="rb-root"><p style="color:var(--enemy)">Rust 코어(Tauri) 런타임이 아님 — 앱에서 ?core=rust&full=1 로 실행하세요.</p></div>`; return; }
  let seed = startSeed;
  let view: RunView;
  let busy = false;
  const panel = createTimelinePanel();
  const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed, sheetCharId: null, sheetUid: null, partyOpen: false, sheetDetail: false, dialog: null };
  let cur: { obs: Observation; bar: SkillBarEntry[] } | null = null;
  let logEvents: GameEvent[] = [];

  // ── 런(비전투) ──
  async function callView(cmd: string, args?: Record<string, unknown>): Promise<RunView> { return (await invoke!(cmd, args)) as RunView; }
  async function start(): Promise<void> { ui.seed = seed; view = await callView("run_create", { seed }); cur = null; render(); }
  async function act(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    view = await callView(cmd, args);
    busy = false;
    if (view.phase === "battle") { await enterBattle(); } else { render(); }
  }
  const runHandlers: RunHandlers = {
    onNode: (id) => act("run_enter_node", { nodeId: id }),
    onReward: (id) => act("run_choose_reward", { optionId: id }),
    onBuy: (id) => act("run_buy", { offerId: id }),
    onLeaveShop: () => act("run_leave_shop"),
    onEncounterChoice: (id) => act("run_encounter", { choiceId: id }),
    onToggleSkill: (charId, skillId) => act("run_set_active", { charId, skillId }),
    onRestart: () => { seed += 1; start(); },
    onToHub: () => { seed += 1; start(); },
    onPause: () => {},
    onOpenParty: () => {}, // 파티 편성 오버레이는 후속(Rust 시트/편성)
  };

  // ── 전투 ──
  async function refreshBattle(): Promise<void> {
    const bv = (await invoke!("run_battle_view")) as BattleView;
    cur = bv.observation ? { obs: bv.observation, bar: bv.skillBar } : null;
  }
  function renderBattle(): void { if (cur) renderAppObs(app, cur.obs, cur.bar, logEvents, ui, battleHandlers, panel); }

  async function enterBattle(): Promise<void> {
    ui.selectedSkillId = null; ui.hoverCell = null; logEvents = [];
    await refreshBattle(); renderBattle(); await maybeAuto();
  }
  async function maybeAuto(): Promise<void> {
    while (view.phase === "battle" && cur && cur.obs.phase === "inProgress" && cur.obs.current?.side === "enemy") {
      await new Promise((r) => setTimeout(r, 240));
      await step("run_battle_ai_step");
    }
  }
  async function step(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    const res = (await invoke!(cmd, args)) as BattleStepResult;
    logEvents.push(...res.eventDelta);
    ui.damaged = new Set(res.eventDelta.flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
    ui.moved = new Set(res.eventDelta.flatMap((e) => (e.t === "move" ? [e.uid] : [])));
    const dlg = [...res.eventDelta].reverse().find((e) => e.t === "dialog");
    ui.dialog = dlg && dlg.t === "dialog" ? { speaker: dlg.speaker, text: dlg.text } : null;
    view = res.view; busy = false;
    if (view.phase !== "battle") { cur = null; render(); return; }
    await refreshBattle(); renderBattle(); await maybeAuto();
  }

  // 전투 핸들러 — 실제 handlers/battle.ts 로직 미러(앵커=targetCell, 엔진이 skill.target 측에서 대상 해소). self=즉시, free=다중칸.
  const battleHandlers: Handlers = {
    onSkill: (id) => {
      if (busy || !cur || cur.obs.phase !== "inProgress") return;
      const sk = SKILLS[id];
      if (sk?.target === "self") {
        const actor = [...cur.obs.allies, ...cur.obs.enemies].find((u) => u.uid === cur!.obs.current?.uid);
        if (actor) void step("run_battle_step", { action: { type: "skill", skillId: id, targetCell: { ...actor.pos } } });
        return;
      }
      ui.selectedSkillId = id; ui.hoverCell = null; ui.pickedCells = []; renderBattle();
    },
    onCellClick: (pos) => {
      if (busy || !ui.selectedSkillId) return;
      const skillId = ui.selectedSkillId;
      const sk = SKILLS[skillId];
      if (sk?.area?.kind === "free") {
        if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
        if (ui.pickedCells.length >= sk.area.count) { const cells = ui.pickedCells.slice(); ui.selectedSkillId = null; ui.pickedCells = []; ui.hoverCell = null; void step("run_battle_step", { action: { type: "skill", skillId, cells } }); }
        else renderBattle();
      } else {
        ui.selectedSkillId = null; ui.hoverCell = null;
        void step("run_battle_step", { action: { type: "skill", skillId, targetCell: pos } });
      }
    },
    onCellHover: (pos) => { if (!ui.selectedSkillId) return; ui.hoverCell = pos; renderBattle(); },
    onCancel: () => { ui.selectedSkillId = null; ui.hoverCell = null; ui.pickedCells = []; renderBattle(); },
    onSkip: () => { if (busy) return; ui.selectedSkillId = null; void step("run_battle_step", { action: { type: "skip" } as Action }); },
    onToggleDetail: () => { ui.sheetDetail = !ui.sheetDetail; renderBattle(); },
    onNewBattle: () => { seed += 1; start(); },
    onOpenSheet: () => {}, // 캐릭터 시트는 후속(Rust 시트)
    onPause: () => {},
  };

  function render(): void {
    if (view.phase === "battle") { renderBattle(); return; }
    renderRunScreen(app, view, runHandlers); // 실제 런 화면
  }

  start();
}
