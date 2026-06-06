// 풀 게임 Rust 하네스 (P2-7/P3) — `?core=rust&full=1`. **전체 프로그램**(타이틀·허브·에디터·런·전투·일시정지)을 Rust 코어로.
// 원래 프론트(실제 렌더러) 그대로 재사용, 엔진/상태/로직만 Rust(IPC). 메타(숙련도)·에디터 저작은 프론트 영속 유지.
import type { Action, GameEvent, Observation } from "../core/types.ts";
import type { RunDef } from "../core/types.ts";
import type { RunState, RunView } from "../core/run.ts";
import { SKILLS } from "../data/skills.ts";
import { DEFAULT_RUN } from "../data/runs/index.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { renderAppObs, type ObsTargeting } from "./render.ts";
import { createTimelinePanel, type RollView } from "./battle/timelinePanel.ts";
import type { Handlers, SkillBarEntry, Ui } from "./battle/shared.ts";
import { renderTitle, renderHub, renderPause, type ShellHandlers } from "./shell.ts";
import { createHub } from "./hub.ts";
import { renderEditor } from "./editor/editorRender.ts";
import { createEditor } from "./editor/controller.ts";
import { createRustOverlay, type RustOverlay, type SheetBundle } from "./rustOverlay.ts";
import { grantWin } from "./meta.ts";

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
  let tgtInfo: ObsTargeting | null = null; // 타겟팅 미리보기(IPC battle_targeting)
  let bundle: SheetBundle | null = null; // 시트/편성 오버레이 원시 데이터(IPC run_sheet_data)
  let overlay: RustOverlay | null = null; // 아래에서 생성(render/mutate 전방참조)
  const hub = createHub();

  // 허브 data()용 stub run(편성=빈 파티 / 진행=현재 view.party). hub.data는 party/floor/runDef.floors만 사용.
  function stubRun(): RunState {
    const party = view ? view.party.map((p) => ({ charId: p.charId })) : [];
    return { party, floor: view ? view.floor - 1 : 0, runDef: { id: DEFAULT_RUN.id, name: DEFAULT_RUN.name, floors: new Array(view?.totalFloors ?? DEFAULT_RUN.floors.length) } } as unknown as RunState;
  }
  function selectedIds(): string[] { return hub.data(stubRun(), false).pool.filter((p) => p.selected).map((p) => p.charId); }

  // ── IPC 호출 ──
  function showErr(where: string, err: unknown): void {
    ui.dialog = { speaker: `IPC오류(${where})`, text: String(err) };
    busy = false;
    if (appState === "run" && view) render();
  }
  async function callView(cmd: string, args?: Record<string, unknown>): Promise<RunView> { return (await invoke!(cmd, args)) as RunView; }
  async function act(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    try { view = await callView(cmd, args); } catch (e) { showErr(cmd, e); return; } finally { busy = false; }
    if (view.phase === "battle") { await enterBattle(); } else { render(); }
  }

  // ── 시트/편성 오버레이(Rust 백킹) ──
  async function refreshBundle(): Promise<void> { try { bundle = (await invoke!("run_sheet_data")) as SheetBundle; } catch (e) { showErr("run_sheet_data", e); } }
  async function openOverlay(): Promise<void> { await refreshBundle(); render(); }
  overlay = createRustOverlay({
    app, ui, invoke: invoke!,
    getBundle: () => bundle,
    // 변이(장착/활성/진형) → 뷰·번들 재조회 → 재렌더(맵 진형/오버레이 동기).
    mutate: (fn) => { void (async () => { try { await fn(); view = await callView("run_view"); await refreshBundle(); } catch (e) { showErr("overlay", e); return; } render(); })(); },
    rerender: render,
  });

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
    onOpenParty: (charId) => { ui.partyOpen = true; ui.sheetCharId = charId; void openOverlay(); },
  };

  // ── 전투 ──
  async function refreshBattle(): Promise<void> { try { const bv = (await invoke!("run_battle_view")) as BattleView; cur = bv.observation ? { obs: bv.observation, bar: bv.skillBar } : null; } catch (e) { showErr("run_battle_view", e); } }
  function renderBattle(): void {
    if (!cur) return;
    renderAppObs(app, cur.obs, cur.bar, logEvents, ui, battleHandlers, panel, tgtInfo ?? undefined);
    if (pauseOpen) renderPause(app, shell);
    if (overlay) overlay.renderOverlay();
  }
  // 호버 칸의 HP 손실 예고 + 끼어들기 고스트를 IPC로 가져와 캐시 후 재렌더.
  async function fetchTargeting(): Promise<void> {
    if (!ui.selectedSkillId || !ui.hoverCell) { tgtInfo = null; renderBattle(); return; }
    const sid = ui.selectedSkillId; const pos = ui.hoverCell;
    try { tgtInfo = (await invoke!("run_battle_targeting", { skillId: sid, row: pos.row, col: pos.col })) as ObsTargeting; } catch { tgtInfo = null; }
    if (ui.selectedSkillId === sid && ui.hoverCell?.row === pos.row && ui.hoverCell?.col === pos.col) renderBattle();
  }
  // 라운드 시작 시 SPD 주사위 연출(roundStart 델타). 연출 끝나면 onDone에서 전투 진행. 연출 없으면 false.
  function playDice(delta: GameEvent[]): boolean {
    if (!cur) return false;
    const rs = [...delta].reverse().find((e) => e.t === "roundStart");
    if (!rs || rs.t !== "roundStart") return false;
    const all = [...cur.obs.allies, ...cur.obs.enemies];
    const views: RollView[] = rs.rolls.map((r) => { const u = all.find((x) => x.uid === r.uid); return { ...r, name: u?.name ?? r.uid, avatar: u?.avatar, side: (u?.side ?? "ally") as "ally" | "enemy" }; });
    busy = true;
    renderBattle(); // 셸·패널 마운트 보장
    panel.playRoll(rs.round, views, rs.order.map((e) => e.uid), () => { busy = false; renderBattle(); void maybeAuto(); });
    return true;
  }
  async function enterBattle(): Promise<void> {
    ui.selectedSkillId = null; ui.hoverCell = null; tgtInfo = null; logEvents = [];
    await refreshBattle();
    const init = (await invoke!("run_battle_init")) as BattleStepResult;
    logEvents.push(...init.eventDelta);
    if (!playDice(init.eventDelta)) { renderBattle(); await maybeAuto(); }
  }
  async function maybeAuto(): Promise<void> {
    while (appState === "run" && view?.phase === "battle" && cur && cur.obs.phase === "inProgress" && cur.obs.current?.side === "enemy") {
      await new Promise((r) => setTimeout(r, 240)); await step("run_battle_ai_step");
    }
  }
  async function step(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    let res: BattleStepResult;
    try { res = (await invoke!(cmd, args)) as BattleStepResult; } catch (e) { showErr(cmd, e); renderBattle(); return; }
    logEvents.push(...res.eventDelta);
    ui.damaged = new Set(res.eventDelta.flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
    ui.moved = new Set(res.eventDelta.flatMap((e) => (e.t === "move" ? [e.uid] : [])));
    const dlg = [...res.eventDelta].reverse().find((e) => e.t === "dialog");
    ui.dialog = dlg && dlg.t === "dialog" ? { speaker: dlg.speaker, text: dlg.text } : null;
    // 전투 승리 시 생존 아군 숙련도 XP(5.3) — DEFAULT_RUN.useMastery일 때만(TS driveBattle 대응).
    if (res.eventDelta.some((e) => e.t === "battleEnd" && e.phase === "allyWin") && DEFAULT_RUN.useMastery) {
      grantWin((res.view.party ?? view?.party ?? []).filter((p) => p.alive).map((p) => p.charId));
    }
    view = res.view; busy = false;
    if (view.phase !== "battle") {
      // 전투 종료 — 막타·승패를 잠깐 보여준 뒤 런(보상/패배)으로 복귀(TS driveBattle 1.1s 대응).
      if (res.observation) { cur = { obs: res.observation, bar: [] }; renderBattle(); }
      busy = true;
      setTimeout(() => { busy = false; cur = null; render(); }, 1100);
      return;
    }
    await refreshBattle();
    if (playDice(res.eventDelta)) return; // 새 라운드 주사위 → onDone에서 렌더+진행
    renderBattle(); await maybeAuto();
  }

  const battleHandlers: Handlers = {
    onSkill: (id) => {
      if (busy || !cur || cur.obs.phase !== "inProgress") return;
      const sk = SKILLS[id];
      if (sk?.target === "self") { const actor = [...cur.obs.allies, ...cur.obs.enemies].find((u) => u.uid === cur!.obs.current?.uid); if (actor) void step("run_battle_step", { action: { type: "skill", skillId: id, targetCell: { ...actor.pos } } }); return; }
      ui.selectedSkillId = id; ui.hoverCell = null; ui.pickedCells = []; tgtInfo = null; renderBattle();
    },
    onCellClick: (pos) => {
      if (busy || !ui.selectedSkillId) return;
      const skillId = ui.selectedSkillId; const sk = SKILLS[skillId];
      if (sk?.area?.kind === "free") {
        if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
        if (ui.pickedCells.length >= sk.area.count) { const cells = ui.pickedCells.slice(); ui.selectedSkillId = null; ui.pickedCells = []; ui.hoverCell = null; tgtInfo = null; void step("run_battle_step", { action: { type: "skill", skillId, cells } }); }
        else renderBattle();
      } else { ui.selectedSkillId = null; ui.hoverCell = null; tgtInfo = null; void step("run_battle_step", { action: { type: "skill", skillId, targetCell: pos } }); }
    },
    onCellHover: (pos) => {
      if (!ui.selectedSkillId) return;
      // 변경 시에만 재렌더 — innerHTML 교체가 mouseenter 재발화 → 무한 재렌더로 클릭이 삼켜지는 것 방지(TS handlers/battle.ts와 동일).
      const c = ui.hoverCell;
      if ((pos?.row ?? -9) !== (c?.row ?? -9) || (pos?.col ?? -9) !== (c?.col ?? -9)) { ui.hoverCell = pos; tgtInfo = null; renderBattle(); void fetchTargeting(); }
    },
    onCancel: () => { ui.selectedSkillId = null; ui.hoverCell = null; ui.pickedCells = []; tgtInfo = null; renderBattle(); },
    onSkip: () => { if (busy) return; ui.selectedSkillId = null; void step("run_battle_step", { action: { type: "skip" } as Action }); },
    onToggleDetail: () => { ui.sheetDetail = !ui.sheetDetail; renderBattle(); },
    onNewBattle: () => shell.onNewRun(),
    onOpenSheet: (uid) => { ui.sheetUid = uid; void openOverlay(); },
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
    else { renderRunScreen(app, view!, runHandlers); if (pauseOpen) renderPause(app, shell); else app.querySelector(".pause-overlay")?.remove(); overlay?.renderOverlay(); }
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
    if (ui.sheetUid || ui.partyOpen) { ui.sheetUid = null; ui.partyOpen = false; ui.sheetCharId = null; render(); }
    else if (ui.selectedSkillId) battleHandlers.onCancel();
    else { pauseOpen = !pauseOpen; render(); }
  });
  window.addEventListener("contextmenu", (e) => { if (appState !== "editor" && !(e.target as HTMLElement)?.closest("input,textarea")) e.preventDefault(); });

  render();
}
