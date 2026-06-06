// 풀 게임 Rust 하네스 (P2-7/P3) — `?core=rust&full=1`. **전체 프로그램**(타이틀·허브·에디터·런·전투·일시정지)을 Rust 코어로.
// 원래 프론트(실제 렌더러) 그대로 재사용, 엔진/상태/로직만 Rust(IPC). 메타(숙련도)·에디터 저작은 프론트 영속 유지.
import type { Action, GameEvent, Observation } from "../core/types.ts";
import type { RunDef } from "../core/types.ts";
import type { RunState, RunView } from "../core/run.ts";
import { SKILLS } from "../data/skills.ts";
import { DEFAULT_RUN } from "../data/runs/index.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { renderAppObs } from "./render.ts";
import { createTimelinePanel } from "./battle/timelinePanel.ts";
import type { Handlers, SkillBarEntry, Ui } from "./battle/shared.ts";
import { renderTitle, renderHub, renderPause, type ShellHandlers } from "./shell.ts";
import { createHub } from "./hub.ts";
import { renderEditor } from "./editor/editorRender.ts";
import { createEditor } from "./editor/controller.ts";

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
  let appState: "title" | "hub" | "editor" | "run" = "title";
  let runActive = false;
  let pauseOpen = false;
  let view: RunView | null = null;
  let busy = false;
  const panel = createTimelinePanel();
  const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed, sheetCharId: null, sheetUid: null, partyOpen: false, sheetDetail: false, dialog: null };
  let cur: { obs: Observation; bar: SkillBarEntry[] } | null = null;
  let logEvents: GameEvent[] = [];
  const hub = createHub();

  // 허브 data()용 stub run(편성=빈 파티 / 진행=현재 view.party). hub.data는 party/floor/runDef.floors만 사용.
  function stubRun(): RunState {
    const party = view ? view.party.map((p) => ({ charId: p.charId })) : [];
    return { party, floor: view ? view.floor - 1 : 0, runDef: { id: DEFAULT_RUN.id, name: DEFAULT_RUN.name, floors: new Array(view?.totalFloors ?? DEFAULT_RUN.floors.length) } } as unknown as RunState;
  }
  function selectedIds(): string[] { return hub.data(stubRun(), false).pool.filter((p) => p.selected).map((p) => p.charId); }

  // ── IPC 호출 ──
  async function callView(cmd: string, args?: Record<string, unknown>): Promise<RunView> { return (await invoke!(cmd, args)) as RunView; }
  async function act(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    view = await callView(cmd, args); busy = false;
    if (view.phase === "battle") { await enterBattle(); } else { render(); }
  }

  // ── 셸(타이틀/허브/일시정지/에디터) ──
  const shell: ShellHandlers = {
    onStart: () => { appState = "hub"; render(); },
    onEditor: () => { appState = "editor"; render(); },
    onNewRun: async () => { view = await callView("run_create_roster", { seed: ++seed, charIds: selectedIds() }); runActive = true; pauseOpen = false; appState = "run"; cur = null; if (view.phase === "battle") await enterBattle(); else render(); },
    onResumeRun: () => { appState = "run"; pauseOpen = false; render(); },
    onAbandonRun: () => { runActive = false; render(); },
    onToHub: () => { appState = "hub"; pauseOpen = false; if (view && (view.phase === "won" || view.phase === "lost")) runActive = false; render(); },
    onResume: () => { pauseOpen = false; render(); },
    onToTitle: () => { appState = "title"; runActive = false; pauseOpen = false; render(); },
    onSelectRun: (id) => { if (runActive) return; hub.setRun(id); render(); },
    onToggleChar: (charId) => { if (runActive) return; hub.toggle(charId); render(); },
  };

  // ── 에디터(저작) — testRun=Rust 런 생성 ──
  const editor = createEditor({
    testRun: async (def: RunDef) => { view = await callView("run_create_def", { seed: ++seed, runDef: def }); runActive = true; pauseOpen = false; appState = "run"; cur = null; if (view.phase === "battle") await enterBattle(); else render(); },
    rerender: render,
    toTitle: () => { appState = "title"; render(); },
  });

  // ── 런(비전투) ──
  const runHandlers: RunHandlers = {
    onNode: (id) => act("run_enter_node", { nodeId: id }),
    onReward: (id) => act("run_choose_reward", { optionId: id }),
    onBuy: (id) => act("run_buy", { offerId: id }),
    onLeaveShop: () => act("run_leave_shop"),
    onEncounterChoice: (id) => act("run_encounter", { choiceId: id }),
    onToggleSkill: (charId, skillId) => act("run_set_active", { charId, skillId }),
    onRestart: () => shell.onNewRun(),
    onToHub: () => shell.onToHub(),
    onPause: () => { pauseOpen = true; render(); },
    onOpenParty: () => {}, // 파티 편성 오버레이는 후속(Rust 시트/편성)
  };

  // ── 전투 ──
  async function refreshBattle(): Promise<void> { const bv = (await invoke!("run_battle_view")) as BattleView; cur = bv.observation ? { obs: bv.observation, bar: bv.skillBar } : null; }
  function renderBattle(): void { if (cur) { renderAppObs(app, cur.obs, cur.bar, logEvents, ui, battleHandlers, panel); if (pauseOpen) renderPause(app, shell); } }
  async function enterBattle(): Promise<void> { ui.selectedSkillId = null; ui.hoverCell = null; logEvents = []; await refreshBattle(); renderBattle(); await maybeAuto(); }
  async function maybeAuto(): Promise<void> {
    while (appState === "run" && view?.phase === "battle" && cur && cur.obs.phase === "inProgress" && cur.obs.current?.side === "enemy") {
      await new Promise((r) => setTimeout(r, 240)); await step("run_battle_ai_step");
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

  const battleHandlers: Handlers = {
    onSkill: (id) => {
      if (busy || !cur || cur.obs.phase !== "inProgress") return;
      const sk = SKILLS[id];
      if (sk?.target === "self") { const actor = [...cur.obs.allies, ...cur.obs.enemies].find((u) => u.uid === cur!.obs.current?.uid); if (actor) void step("run_battle_step", { action: { type: "skill", skillId: id, targetCell: { ...actor.pos } } }); return; }
      ui.selectedSkillId = id; ui.hoverCell = null; ui.pickedCells = []; renderBattle();
    },
    onCellClick: (pos) => {
      if (busy || !ui.selectedSkillId) return;
      const skillId = ui.selectedSkillId; const sk = SKILLS[skillId];
      if (sk?.area?.kind === "free") {
        if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
        if (ui.pickedCells.length >= sk.area.count) { const cells = ui.pickedCells.slice(); ui.selectedSkillId = null; ui.pickedCells = []; ui.hoverCell = null; void step("run_battle_step", { action: { type: "skill", skillId, cells } }); }
        else renderBattle();
      } else { ui.selectedSkillId = null; ui.hoverCell = null; void step("run_battle_step", { action: { type: "skill", skillId, targetCell: pos } }); }
    },
    onCellHover: (pos) => { if (!ui.selectedSkillId) return; ui.hoverCell = pos; renderBattle(); },
    onCancel: () => { ui.selectedSkillId = null; ui.hoverCell = null; ui.pickedCells = []; renderBattle(); },
    onSkip: () => { if (busy) return; ui.selectedSkillId = null; void step("run_battle_step", { action: { type: "skip" } as Action }); },
    onToggleDetail: () => { ui.sheetDetail = !ui.sheetDetail; renderBattle(); },
    onNewBattle: () => shell.onNewRun(),
    onOpenSheet: () => {},
    onPause: () => { pauseOpen = true; render(); },
  };

  // ── 최상위 렌더 디스패치 ──
  function render(): void {
    if (appState !== "run") {
      app.querySelector(".pause-overlay")?.remove();
      if (appState === "title") renderTitle(app, shell);
      else if (appState === "editor") renderEditor(app, editor.data(), editor.handlers);
      else renderHub(app, hub.data(stubRun(), runActive), shell);
      return;
    }
    if (view?.phase === "battle") { renderBattle(); }
    else { renderRunScreen(app, view!, runHandlers); if (pauseOpen) renderPause(app, shell); else app.querySelector(".pause-overlay")?.remove(); }
  }

  // Esc: 런 중 일시정지 토글 / 에디터 단축키
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    const editing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (appState === "editor") {
      if (editing) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); editor.handlers.onSelectAll(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); editor.handlers.onDeleteSel(); }
      return;
    }
    if (e.key !== "Escape" || appState !== "run") return;
    if (ui.selectedSkillId) battleHandlers.onCancel();
    else { pauseOpen = !pauseOpen; render(); }
  });
  window.addEventListener("contextmenu", (e) => { if (appState !== "editor" && !(e.target as HTMLElement)?.closest("input,textarea")) e.preventDefault(); });

  render();
}
