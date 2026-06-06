// 웹 엔트리 — 런 컨트롤러. 맵 ↔ 전투 ↔ 보상 ↔ 결과를 run.phase로 분기.
// 전투는 render.ts(renderApp) 재사용, 맵/보상/결과는 runRender.ts. (7장)
import { step } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { createRun, resolveBattleEnd, getRunView, type RunState } from "../core/run.ts";
import type { Action, RunDef } from "../core/types.ts";
import { CHARACTERS } from "../data/characters.ts";
import { grantWin, masteryMap } from "./meta.ts";
import { renderApp, type Ui } from "./render.ts";
import { renderRunScreen } from "./runRender.ts";
import { createTimelinePanel, type RollView } from "./battle/timelinePanel.ts";
import { createOverlay } from "./overlay.ts";
import { renderTitle, renderHub, renderPause, type ShellHandlers } from "./shell.ts";
import { createHub } from "./hub.ts";
import { saveRun, clearSave, loadRun } from "./save.ts";
import { renderEditor } from "./editor/editorRender.ts";
import { createEditor } from "./editor/controller.ts";
import { makeBattleHandlers, makeRunHandlers, type AppCtx } from "./handlers/index.ts";
import { mountRustBattle } from "./rustBattle.ts";
import { mountRustRun } from "./rustRun.ts";

const app = document.getElementById("app")!;
const panel = createTimelinePanel(); // 행동서열 패널 — 주사위(rolling)↔전투(live) 한 컴포넌트, 전투 셸에 영속 마운트

const hub = createHub(); // 본거지 편성 컨트롤러(선택 로스터·런 생성)
const makeRun = (s: number) => hub.makeRun(s);

let run: RunState;
let seed = 42;
let busy = false;
let appState: "title" | "hub" | "editor" | "run" = "title"; // 게임 흐름 셸 (+에디터)
let runActive = false; // 진행 중 런이 있나(이어하기 가능)
let pauseOpen = false; // 런 중 일시정지 오버레이

// 런 이어하기 영속화는 web/save.ts. 런 진행 중인 상태만 저장.
function persist(): void { if (appState === "run" && runActive) saveRun(run); }
const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed, sheetCharId: null, sheetUid: null, partyOpen: false, sheetDetail: false, dialog: null };

function resetUi(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
  ui.damaged = new Set();
  ui.moved = new Set();
  ui.sheetCharId = null; // 노드 전환 시 시트/파티뷰 닫기
  ui.sheetUid = null;
  ui.partyOpen = false;
  ui.sheetDetail = false;
  ui.dialog = null;
}
function endTargeting(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
}

// 오버레이(파티 편성/캐릭터 시트) 컨트롤러 — run/ui/render 주입(run은 newRun에서 재할당 → getter)
const overlay = createOverlay({ app, ui, getRun: () => run, render });

let introRound = 0; // 마지막으로 주사위 연출한 라운드 (라운드마다 1회)

function render(): void {
  // 최상위: 타이틀/집은 런 바깥 (오버레이 제거 후 전환)
  if (appState !== "run") {
    app.querySelector(".pause-overlay")?.remove();
    if (appState === "title") renderTitle(app, shellHandlers);
    else if (appState === "editor") renderEditor(app, editor.data(), editor.handlers);
    else renderHub(app, hub.data(run, runActive), shellHandlers);
    return;
  }
  if (run.phase === "battle" && run.battle) {
    const b = run.battle;
    // 새 라운드 시작 시 SPD 주사위 연출을 먼저 재생, 끝나면 전투 렌더 (8.5: 이벤트 재생)
    if (b.phase === "inProgress" && b.round !== introRound) {
      introRound = b.round;
      const rs = [...b.log].reverse().find((e) => e.t === "roundStart" && e.round === b.round);
      if (rs && rs.t === "roundStart") {
        busy = true;
        const views: RollView[] = rs.rolls.map((r) => {
          const u = b.units.find((x) => x.uid === r.uid)!;
          return { ...r, name: u.name, avatar: CHARACTERS[u.charId]?.avatar, side: u.side };
        });
        // 셸+존 렌더(패널 마운트, 레일 위치 확정) 후 같은 tick에 굴림 시작 → stale 깜빡임 없음
        renderApp(app, b, ui, battleHandlers, panel);
        panel.playRoll(b.round, views, rs.order.map((e) => e.uid), () => {
          busy = false;
          renderBattle(); // 도킹 완료 후 전투 진행(driveBattle)
        });
        return;
      }
    }
    renderBattle();
  } else {
    introRound = 0; // 전투를 떠나면 리셋 → 다음 전투는 1라운드부터 연출
    renderRunScreen(app, getRunView(run), runHandlers);
    overlay.renderOverlay();
  }
  if (pauseOpen) renderPause(app, shellHandlers);
  else app.querySelector(".pause-overlay")?.remove();
  persist();
}

function renderBattle(): void {
  renderApp(app, run.battle!, ui, battleHandlers, panel);
  overlay.renderOverlay();
  persist();
  driveBattle();
}

// ── 전투 진행 ──
function driveBattle(): void {
  const b = run.battle!;
  if (b.phase !== "inProgress") {
    // 전투 승리 — 생존 아군에 숙련도 XP(5.3 소량). 모드가 숙련도 사용할 때만.
    if (b.phase === "allyWin" && run.useMastery) grantWin(b.units.filter((u) => u.side === "ally" && u.alive).map((u) => u.charId));
    // 전투 종료 — 결과를 잠깐 보여준 뒤 런으로 복귀
    busy = true;
    setTimeout(() => {
      busy = false;
      resolveBattleEnd(run);
      resetUi();
      render();
    }, 1100);
    return;
  }
  const actor = b.units.find((u) => u.uid === b.current!.uid)!;
  if (actor.side === "enemy") {
    busy = true;
    setTimeout(() => {
      busy = false;
      battleStep(chooseAction(b));
    }, 600);
  }
}

function battleStep(action: Action): void {
  const b = run.battle!;
  const before = b.log.length;
  step(b, action);
  const newEvents = b.log.slice(before);
  ui.damaged = new Set(newEvents.flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
  ui.moved = new Set(newEvents.flatMap((e) => (e.t === "move" ? [e.uid] : [])));
  const dlg = [...newEvents].reverse().find((e) => e.t === "dialog"); // 직전 step의 대사 → 오버레이(없으면 해제)
  ui.dialog = dlg && dlg.t === "dialog" ? { speaker: dlg.speaker, text: dlg.text } : null;
  endTargeting();
  render();
}

// ── 앱 액션(핸들러 간 공유) + 핸들러 생성 ──
function restart(): void { seed += 1; newRun(seed); }
function openPause(): void { pauseOpen = true; render(); }
const ctx: AppCtx = {
  ui,
  getRun: () => run,
  isBusy: () => busy,
  render, resetUi, endTargeting, battleStep, restart, openPause,
  toHub: () => shellHandlers.onToHub(),
};
const battleHandlers = makeBattleHandlers(ctx);
const runHandlers = makeRunHandlers(ctx);

function newRun(s: number): void {
  seed = s;
  ui.seed = s;
  run = makeRun(s);
  resetUi();
  runActive = true;
  pauseOpen = false;
  appState = "run";
  render();
}

// ── 런 에디터 (E1: 런 목록·드래프트·테스트플레이) ──
/** 드래프트/런을 즉시 플레이(허브 우회) — 런 자체 로스터로 createRun. */
function testRun(def: RunDef): void {
  seed += 1;
  ui.seed = seed;
  run = createRun(seed, def.roster, def, { mastery: masteryMap(), useMastery: def.useMastery });
  resetUi();
  runActive = true;
  pauseOpen = false;
  appState = "run";
  render();
}
const editor = createEditor({ testRun, rerender: render, toTitle: () => { appState = "title"; render(); } });

// 게임 흐름 셸 핸들러 (타이틀/집/일시정지)
const shellHandlers: ShellHandlers = {
  onStart() { appState = "hub"; render(); },
  onEditor() { appState = "editor"; render(); },
  onSelectRun(id) { if (runActive) return; hub.setRun(id); render(); }, // 비전투에서만 런 전환
  onNewRun() { newRun(seed + 1); },
  onResumeRun() { appState = "run"; pauseOpen = false; render(); },
  onAbandonRun() { runActive = false; clearSave(); render(); },
  onToHub() { appState = "hub"; pauseOpen = false; if (run.phase === "won" || run.phase === "lost") { runActive = false; clearSave(); } render(); },
  onResume() { pauseOpen = false; render(); },
  onToTitle() { appState = "title"; pauseOpen = false; runActive = false; clearSave(); render(); },
  onToggleChar(charId) {
    if (runActive) return; // 런 중엔 편성 잠금
    hub.toggle(charId);
    render();
  },
};

// 입력 필드(라벨 input·드롭다운 등) 포커스 중엔 단축키를 가로채지 않음 — 백스페이스=글자 삭제
const inEditableField = (e: Event): boolean => {
  const t = e.target as HTMLElement | null;
  const tag = t?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!t?.isContentEditable;
};

// Esc: 오버레이(파티뷰>시트>타겟팅)를 먼저 닫고, 런 중 다 닫혀 있으면 일시정지 토글
window.addEventListener("keydown", (e) => {
  if (appState === "editor") {
    if (inEditableField(e)) return; // 라벨 편집 중 Backspace/Ctrl+A는 텍스트 입력에 양보
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); editor.handlers.onSelectAll(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); editor.handlers.onDeleteSel(); }
    return;
  }
  if (e.key !== "Escape" || appState !== "run") return;
  if (ui.partyOpen) { ui.partyOpen = false; ui.sheetCharId = null; render(); }
  else if (ui.sheetUid) { ui.sheetUid = null; render(); }
  else if (ui.selectedSkillId) battleHandlers.onCancel();
  else { pauseOpen = !pauseOpen; render(); }
});

// 우클릭 네이티브 메뉴 차단(게임 톤) — 에디터(개발자 도구)·입력 필드(붙여넣기)는 예외
window.addEventListener("contextmenu", (e) => { if (appState === "editor" || inEditableField(e)) return; e.preventDefault(); });

// 부팅: `?core=rust|ts` 면 **전투 엔진 검증 하네스**(P1-13 — Rust/TS 백엔드로 데모 전투),
// 아니면 일반 게임(타이틀→허브→런, TS 그대로). 하네스는 기존 흐름을 건드리지 않는 별도 진입.
const params = new URLSearchParams(location.search);
const coreFlag = params.get("core");
if ((coreFlag === "rust" || coreFlag === "ts") && params.get("full") === "1") {
  mountRustRun(app, seed); // 풀 게임(Rust RunSession)
} else if (coreFlag === "rust" || coreFlag === "ts") {
  mountRustBattle(app, seed); // 전투 데모
} else {
  const loaded = loadRun();
  if (loaded) { run = loaded; runActive = true; seed = run.seed; }
  else run = makeRun(seed);
  render();
}
