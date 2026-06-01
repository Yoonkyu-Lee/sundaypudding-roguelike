// 웹 엔트리 — 런 컨트롤러. 맵 ↔ 전투 ↔ 보상 ↔ 결과를 run.phase로 분기.
// 전투는 render.ts(renderApp) 재사용, 맵/보상/결과는 runRender.ts. (7장)
import { step } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, setActiveSkill, buyShopOffer, leaveShop, chooseEncounterOption, serializeRun, deserializeRun, getRunView, type RunState } from "../core/run.ts";
import type { Action } from "../core/types.ts";
import { SKILLS } from "../data/skills.ts";
import { CHARACTERS } from "../data/characters.ts";
import { renderApp, type Handlers, type Ui } from "./render.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { createTimelinePanel, type RollView } from "./battle/timelinePanel.ts";
import { createOverlay } from "./overlay.ts";
import { renderTitle, renderHub, renderPause, type ShellHandlers, type HubData } from "./shell.ts";

const app = document.getElementById("app")!;
const panel = createTimelinePanel(); // 행동서열 패널 — 주사위(rolling)↔전투(live) 한 컴포넌트, 전투 셸에 영속 마운트

const ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } }, // 김두한 전방
  { charId: "shin", pos: { row: 2, col: 0 } }, // 신영균 전방
  { charId: "shanghai", pos: { row: 1, col: 2 } }, // 상하이 조 후방
  { charId: "cho", pos: { row: 2, col: 2 } }, // 조병옥 후방
];

let run: RunState;
let seed = 42;
let busy = false;
let appState: "title" | "hub" | "run" = "title"; // 게임 흐름 셸 (슬라이스2)
let runActive = false; // 진행 중 런이 있나(이어하기 가능)
let pauseOpen = false; // 런 중 일시정지 오버레이

// ── 런 이어하기 영속화 (localStorage, 슬라이스3) ──
const SAVE_KEY = "spr_save_v1"; // 스키마 변경 시 버전 bump → 구세이브 자연 폐기
function saveRun(): void { try { localStorage.setItem(SAVE_KEY, serializeRun(run)); } catch { /* 용량/비활성 무시 */ } }
function clearSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } }
function loadRun(): RunState | null { try { const s = localStorage.getItem(SAVE_KEY); return s ? deserializeRun(s) : null; } catch { return null; } }
function persist(): void { if (appState === "run" && runActive) saveRun(); } // 런 진행 중인 상태만 저장
const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed, sheetCharId: null, sheetUid: null, partyOpen: false, sheetDetail: false };

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
}
function endTargeting(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
}

// 오버레이(파티 편성/캐릭터 시트) 컨트롤러 — run/ui/render 주입(run은 newRun에서 재할당 → getter)
const overlay = createOverlay({ app, ui, getRun: () => run, render });

let introRound = 0; // 마지막으로 주사위 연출한 라운드 (라운드마다 1회)

function hubData(): HubData {
  return {
    roster: ROSTER.map((m) => ({ charId: m.charId, name: CHARACTERS[m.charId].name, avatar: CHARACTERS[m.charId].avatar })),
    runActive,
    act: runActive ? run.act : undefined,
    totalActs: run.acts.length,
  };
}

function render(): void {
  // 최상위: 타이틀/집은 런 바깥 (오버레이 제거 후 전환)
  if (appState !== "run") {
    app.querySelector(".pause-overlay")?.remove();
    if (appState === "title") renderTitle(app, shellHandlers);
    else renderHub(app, hubData(), shellHandlers);
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
  endTargeting();
  render();
}

const battleHandlers: Handlers = {
  onSkill(skillId) {
    if (busy || !run.battle || run.battle.phase !== "inProgress") return;
    const sk = SKILLS[skillId];
    if (sk?.target === "self") {
      // 자기 대상은 즉시 시전 (앵커=자신 위치)
      const actor = run.battle.units.find((u) => u.uid === run.battle!.current!.uid)!;
      battleStep({ type: "skill", skillId, targetCell: { ...actor.pos } });
      return;
    }
    ui.selectedSkillId = skillId;
    ui.hoverCell = null;
    ui.pickedCells = [];
    render();
  },
  onCellClick(pos) {
    if (busy || !ui.selectedSkillId) return;
    const sk = SKILLS[ui.selectedSkillId];
    if (sk.area?.kind === "free") {
      const count = sk.area.count;
      if (!ui.pickedCells.some((p) => p.row === pos.row && p.col === pos.col)) ui.pickedCells.push(pos);
      if (ui.pickedCells.length >= count) battleStep({ type: "skill", skillId: ui.selectedSkillId, cells: ui.pickedCells.slice() });
      else render();
    } else {
      battleStep({ type: "skill", skillId: ui.selectedSkillId, targetCell: pos });
    }
  },
  onCellHover(pos) {
    if (!ui.selectedSkillId) return;
    const cur = ui.hoverCell;
    if ((pos?.row ?? -9) !== (cur?.row ?? -9) || (pos?.col ?? -9) !== (cur?.col ?? -9)) {
      ui.hoverCell = pos;
      render();
    }
  },
  onCancel() {
    endTargeting();
    render();
  },
  onSkip() {
    if (!busy) battleStep({ type: "skip" });
  },
  onNewBattle() {
    runHandlers.onRestart(); // 전투 화면의 '새 전투' = 런 재시작
  },
  onOpenSheet(uid) {
    ui.sheetUid = uid; // 전투 유닛 프로필(아군/적)
    render();
  },
  onToggleDetail() {
    ui.sheetDetail = !ui.sheetDetail; // 전역 자세히(피해 분해/스탯 원본 병기)
    render();
  },
  onPause() { pauseOpen = true; render(); },
};

// ── 런 핸들러 ──
const runHandlers: RunHandlers = {
  onNode(id) {
    if (busy || run.phase !== "map") return;
    enterNode(run, id);
    resetUi();
    render();
  },
  onReward(id) {
    if (busy || run.phase !== "reward") return;
    chooseReward(run, id);
    render();
  },
  onRestart() {
    seed += 1;
    newRun(seed);
  },
  onToggleSkill(charId, skillId) {
    if (busy || run.phase !== "map") return;
    setActiveSkill(run, charId, skillId);
    render();
  },
  onBuy(offerId) {
    if (busy || run.phase !== "shop") return;
    buyShopOffer(run, offerId);
    render();
  },
  onLeaveShop() {
    if (busy || run.phase !== "shop") return;
    leaveShop(run);
    resetUi();
    render();
  },
  onEncounterChoice(choiceId) {
    if (busy || run.phase !== "encounter") return;
    chooseEncounterOption(run, choiceId);
    resetUi();
    render();
  },
  onOpenParty(charId) {
    if (run.phase === "battle") return; // 비전투면 어디서나 편성
    ui.partyOpen = true;
    ui.sheetCharId = charId;
    render();
  },
  onToHub() { shellHandlers.onToHub(); }, // 승패 화면 "집으로"
  onPause() { pauseOpen = true; render(); }, // 헤더 ⏸
};

function newRun(s: number): void {
  seed = s;
  ui.seed = s;
  run = createRun(s, ROSTER);
  resetUi();
  runActive = true;
  pauseOpen = false;
  appState = "run";
  render();
}

// 게임 흐름 셸 핸들러 (타이틀/집/일시정지)
const shellHandlers: ShellHandlers = {
  onStart() { appState = "hub"; render(); },
  onNewRun() { newRun(seed + 1); },
  onResumeRun() { appState = "run"; pauseOpen = false; render(); },
  onAbandonRun() { runActive = false; clearSave(); render(); },
  onToHub() { appState = "hub"; pauseOpen = false; if (run.phase === "won" || run.phase === "lost") { runActive = false; clearSave(); } render(); },
  onResume() { pauseOpen = false; render(); },
  onToTitle() { appState = "title"; pauseOpen = false; runActive = false; clearSave(); render(); },
};

// Esc: 오버레이(파티뷰>시트>타겟팅)를 먼저 닫고, 런 중 다 닫혀 있으면 일시정지 토글
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || appState !== "run") return;
  if (ui.partyOpen) { ui.partyOpen = false; ui.sheetCharId = null; render(); }
  else if (ui.sheetUid) { ui.sheetUid = null; render(); }
  else if (ui.selectedSkillId) battleHandlers.onCancel();
  else { pauseOpen = !pauseOpen; render(); }
});

// 부팅: 저장된 런이 있으면 복원(이어하기 가능), 없으면 새 런 준비. 화면은 타이틀부터.
const loaded = loadRun();
if (loaded) { run = loaded; runActive = true; seed = run.seed; }
else run = createRun(seed, ROSTER);
render();
