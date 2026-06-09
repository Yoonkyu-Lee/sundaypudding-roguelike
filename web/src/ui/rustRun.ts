// 풀 게임 Rust 하네스 (P2-7/P3) — `?core=rust&full=1`. **전체 프로그램**(타이틀·허브·도감·에디터·런·전투·일시정지)을 Rust 코어로.
// 원래 프론트(실제 렌더러) 그대로 재사용, 엔진/상태/로직만 Rust(IPC). 메타(숙련도·해금)·에디터 저작은 프론트 영속.
// 이 파일 = 셸/디스패치(타이틀·허브·도감·에디터·런 비전투 + 부팅·키보드). 전투 루프는 `rustBattle.ts`로 분리.
import type { RunDef } from "../contract/types.ts";
import type { RunState, RunView } from "../contract/run.ts";
import { DEFAULT_RUN } from "../content/runs/index.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { createTimelinePanel } from "./battle/timelinePanel.ts";
import type { Ui } from "./battle/shared.ts";
import { renderTitle, renderHub, renderPause, renderError, type ShellHandlers } from "./shell.ts";
import { renderCharDex, type CharDexHandlers } from "./charDex.ts";
import { createHub } from "./hub.ts";
import { renderEditor } from "./editor/editorRender.ts";
import { createEditor } from "./editor/controller.ts";
import { createJobEditor } from "./editor/jobEditor.ts";
import { createItemEditor } from "./editor/itemEditor.ts";
import { createSkillEditor } from "./editor/skillEditor.ts";
import { createRustOverlay, type RustOverlay, type SheetBundle } from "./rustOverlay.ts";
import { createBattleController, type BattleState } from "./rustBattle.ts";
import { recordRunProgress } from "./runProgress.ts";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
function invoker(): Invoke | null {
  const t = (globalThis as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  return t?.core?.invoke ?? null;
}

const SAVE_KEY = "spr_rust_save_v1";

export function mountRustRun(app: HTMLElement, startSeed: number): void {
  const invoke = invoker();
  if (!invoke) { app.innerHTML = `<div class="rb-root"><p style="color:var(--enemy)">Rust 코어(Tauri) 런타임이 아님 — 앱에서 ?core=rust&full=1 로 실행하세요.</p></div>`; return; }
  let seed = startSeed;
  let appState: "title" | "hub" | "editor" | "jobsEditor" | "itemsEditor" | "skillsEditor" | "run" | "chardex" = "title";
  let hubMode: "menu" | "campaign" = "menu"; // 허브 하위 뷰(진입점 메뉴 / 캠페인 런 목록)
  let charDexSel: string | null = null; // 도감 선택 캐릭 id
  let lastError: string | null = null; // 셸(허브/에디터)에서 IPC 런 생성 실패 표시 — 죽은 클릭 방지
  let startedDef: RunDef | null = null; // 시작한 런 정의(승리 시 출연진 해금용 — CDX)
  let runActive = false;
  let pauseOpen = false;
  // 공유 런/전투 가변상태(rustBattle와 참조 공유) — view/cur/busy/logEvents/tgtInfo.
  const st: BattleState = { view: null, cur: null, busy: false, logEvents: [], tgtInfo: null };
  const panel = createTimelinePanel();
  const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed, sheetCharId: null, sheetUid: null, partyOpen: false, sheetDetail: false, dialog: null };
  let bundle: SheetBundle | null = null; // 시트/편성 오버레이 원시 데이터(IPC run_sheet_data)
  let overlay: RustOverlay | null = null; // 아래에서 생성(render/mutate 전방참조)
  const hub = createHub();

  // 허브 data()용 stub run(편성=빈 파티 / 진행=현재 view.party). hub.data는 party/floor/runDef.floors만 사용.
  function stubRun(): RunState {
    const party = st.view ? st.view.party.map((p) => ({ charId: p.charId })) : [];
    return { party, floor: st.view ? st.view.floor - 1 : 0, runDef: { id: DEFAULT_RUN.id, name: DEFAULT_RUN.name, floors: new Array(st.view?.totalFloors ?? DEFAULT_RUN.floors.length) } } as unknown as RunState;
  }
  function noteProgress(): void { recordRunProgress(st.view, startedDef); }

  // ── IPC 호출 ──
  function showErr(where: string, err: unknown): void {
    ui.dialog = { speaker: `IPC오류(${where})`, text: String(err) };
    st.busy = false;
    if (appState === "run" && st.view) render();
  }
  async function callView(cmd: string, args?: Record<string, unknown>): Promise<RunView> { return (await invoke!(cmd, args)) as RunView; }
  async function act(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (st.busy) return; st.busy = true;
    try { st.view = await callView(cmd, args); } catch (e) { showErr(cmd, e); return; } finally { st.busy = false; }
    noteProgress();
    if (st.view.phase === "battle") { await battle.enterBattle(); } else { render(); }
    persist();
  }

  // ── 세이브/이어하기 영속화 (localStorage, Rust 세션 직렬화 IPC) ──
  // TS 경로(spr_save_v1)와 포맷 비호환 → 전용 키. run_save=JSON 문자열, run_load=복원 후 RunView(또는 null=폐기).
  function persist(): void {
    if (!(appState === "run" && runActive)) return;
    void (async () => { try { const json = (await invoke!("run_save")) as string; if (json) localStorage.setItem(SAVE_KEY, json); } catch { /* 용량/비활성 무시 */ } })();
  }
  function clearSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } }

  // ── 시트/편성 오버레이(Rust 백킹) ──
  async function refreshBundle(): Promise<void> { try { bundle = (await invoke!("run_sheet_data")) as SheetBundle; } catch (e) { showErr("run_sheet_data", e); } }
  async function openOverlay(): Promise<void> { await refreshBundle(); render(); }
  overlay = createRustOverlay({
    app, ui, invoke: invoke!,
    getBundle: () => bundle,
    // 변이(장착/활성/진형) → 뷰·번들 재조회 → 재렌더(맵 진형/오버레이 동기).
    mutate: (fn) => { void (async () => { try { await fn(); st.view = await callView("run_view"); await refreshBundle(); } catch (e) { showErr("overlay", e); return; } render(); persist(); })(); },
    rerender: render,
  });

  // ── 셸(타이틀/허브/일시정지/에디터) ──
  const shell: ShellHandlers = {
    onStart: () => { appState = "hub"; hubMode = "menu"; render(); },
    onEditor: () => { appState = "editor"; render(); },
    onJobEditor: () => { appState = "jobsEditor"; render(); },
    onItemEditor: () => { appState = "itemsEditor"; render(); },
    onSkillEditor: () => { appState = "skillsEditor"; render(); },
    onEnterCampaign: () => { hubMode = "campaign"; render(); },
    onCharDex: () => { appState = "chardex"; render(); },
    onHubBack: () => { hubMode = "menu"; render(); },
    // 캠페인 = 선택 런의 고정 로스터로 시작(run_create_def — 주인공 강제, 자유 편성 없음).
    onNewRun: async () => {
      clearSave();
      const def = hub.selectedRunDef();
      try { st.view = await callView("run_create_def", { seed: ++seed, runDef: def }); }
      catch (e) { lastError = `런을 시작할 수 없습니다 — ${String(e)} (데스크톱 엔진을 다시 빌드하세요: cd desktop && cargo build)`; render(); return; }
      startedDef = def; lastError = null; runActive = true; pauseOpen = false; appState = "run"; st.cur = null; noteProgress(); if (st.view.phase === "battle") await battle.enterBattle(); else render(); persist();
    },
    onResumeRun: () => { appState = "run"; pauseOpen = false; if (st.view?.phase === "battle") void battle.enterBattle(); else render(); },
    onAbandonRun: () => { runActive = false; clearSave(); render(); },
    onToHub: () => { appState = "hub"; hubMode = "menu"; pauseOpen = false; if (st.view && (st.view.phase === "won" || st.view.phase === "lost")) { runActive = false; clearSave(); } render(); },
    onResume: () => { pauseOpen = false; render(); },
    onToTitle: () => { appState = "title"; hubMode = "menu"; runActive = false; pauseOpen = false; clearSave(); render(); },
    onSelectRun: (id) => { if (runActive) return; hub.setRun(id); render(); },
    onToggleChar: (charId) => { if (runActive) return; hub.toggle(charId); render(); },
  };

  // ── 전투 서브컨트롤러(분리) — 공유 st + 부모 콜백으로 구동 ──
  const battle = createBattleController({
    app, ui, panel, invoke, st, shell,
    getAppState: () => appState,
    getPauseOpen: () => pauseOpen,
    setPauseOpen: (v) => { pauseOpen = v; },
    getOverlay: () => overlay,
    render, persist, showErr, noteProgress, openOverlay,
  });

  // ── 에디터(저작) — testRun=Rust 런 생성 ──
  const editor = createEditor({
    testRun: async (def: RunDef) => {
      clearSave();
      try { st.view = await callView("run_create_def", { seed: ++seed, runDef: def }); }
      catch (e) { lastError = `테스트 런 실패 — ${String(e)}`; render(); return; }
      startedDef = def; lastError = null; runActive = true; pauseOpen = false; appState = "run"; st.cur = null; noteProgress(); if (st.view.phase === "battle") await battle.enterBattle(); else render(); persist();
    },
    rerender: render,
    toTitle: () => { appState = "title"; render(); },
  });

  // ── 전직 트리 에디터(⑤-a, jobs.json 저작) ──
  const jobEditor = createJobEditor({ onBack: () => { appState = "hub"; hubMode = "menu"; render(); } });
  const itemEditor = createItemEditor({ onBack: () => { appState = "hub"; hubMode = "menu"; render(); } });
  const skillEditor = createSkillEditor({ onBack: () => { appState = "hub"; hubMode = "menu"; render(); } });

  // ── 캐릭터 도감(CDX) ──
  const charDexHandlers: CharDexHandlers = {
    onSelect: (charId) => { charDexSel = charId; render(); },
    onBack: () => { appState = "hub"; hubMode = "menu"; render(); },
  };

  // ── 런(비전투) ──
  const runHandlers: RunHandlers = {
    onNode: (id) => act("run_enter_node", { nodeId: id }),
    onReward: (id) => act("run_choose_reward", { optionId: id }),
    onBuy: (id) => act("run_buy", { offerId: id }),
    onLeaveShop: () => act("run_leave_shop"),
    onEncounterChoice: (id) => act("run_encounter", { choiceId: id }),
    onClassChange: (charId, toJobId) => act("run_class_change", { charId, toJobId }),
    onClassChangeSkip: () => act("run_class_change_skip"),
    onToggleSkill: (charId, skillId) => act("run_set_active", { charId, skillId }),
    onRestart: () => shell.onNewRun(),
    onToHub: () => shell.onToHub(),
    onPause: () => { pauseOpen = true; render(); },
    onOpenParty: (charId) => { ui.partyOpen = true; ui.sheetCharId = charId; void openOverlay(); },
  };

  // ── 최상위 렌더 디스패치 ──
  function render(): void {
    if (appState !== "run") {
      app.querySelector(".pause-overlay")?.remove();
      if (appState === "title") renderTitle(app, shell);
      else if (appState === "editor") renderEditor(app, editor.data(), editor.handlers);
      else if (appState === "jobsEditor") jobEditor.render(app);
      else if (appState === "itemsEditor") itemEditor.render(app);
      else if (appState === "skillsEditor") skillEditor.render(app);
      else if (appState === "chardex") renderCharDex(app, charDexSel, charDexHandlers);
      else renderHub(app, hub.data(stubRun(), runActive, hubMode), shell);
      if (lastError) renderError(app, lastError, () => { lastError = null; render(); });
      return;
    }
    if (st.view?.phase === "battle") { battle.renderBattle(); }
    else { renderRunScreen(app, st.view!, runHandlers); if (pauseOpen) renderPause(app, shell); else app.querySelector(".pause-overlay")?.remove(); overlay?.renderOverlay(); }
  }

  // Esc: 런 중 일시정지 토글 / 에디터 단축키 / 도감 복귀
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    const editing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (appState === "editor") {
      if (editing) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); editor.handlers.onSelectAll(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); editor.handlers.onDeleteSel(); }
      return;
    }
    if (appState === "jobsEditor" || appState === "itemsEditor" || appState === "skillsEditor") { if (e.key === "Escape" && !editing) { appState = "hub"; hubMode = "menu"; render(); } return; }
    if (e.key === "Escape" && appState === "chardex") { appState = "hub"; hubMode = "menu"; render(); return; }
    if (e.key !== "Escape" || appState !== "run") return;
    if (ui.sheetUid || ui.partyOpen) { ui.sheetUid = null; ui.partyOpen = false; ui.sheetCharId = null; render(); }
    else if (ui.selectedSkillId) battle.battleHandlers.onCancel();
    else { pauseOpen = !pauseOpen; render(); }
  });
  const devToolState = () => appState === "editor" || appState === "jobsEditor" || appState === "itemsEditor" || appState === "skillsEditor";
  window.addEventListener("contextmenu", (e) => { if (!devToolState() && !(e.target as HTMLElement)?.closest("input,textarea")) e.preventDefault(); });

  // 부팅: 세이브 있으면 복원(이어하기 활성) 후 렌더. 손상/비호환이면 run_load=null → 폐기.
  void (async () => {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (json) { const v = (await invoke!("run_load", { json })) as RunView | null; if (v) { st.view = v; runActive = true; } else clearSave(); }
    } catch { /* 무시 */ }
    render();
  })();
}
