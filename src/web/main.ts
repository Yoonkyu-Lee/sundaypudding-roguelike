// 웹 엔트리 — 런 컨트롤러. 맵 ↔ 전투 ↔ 보상 ↔ 결과를 run.phase로 분기.
// 전투는 render.ts(renderApp) 재사용, 맵/보상/결과는 runRender.ts. (7장)
import { step } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, getRunView, type RunState } from "../core/run.ts";
import type { Action } from "../core/types.ts";
import { renderApp, type Handlers, type Ui } from "./render.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";

const app = document.getElementById("app")!;

const ROSTER = [
  { charId: "kim", pos: { row: 1, col: 0 } }, // 김두한 전방
  { charId: "shin", pos: { row: 2, col: 0 } }, // 신영균 전방
  { charId: "shanghai", pos: { row: 1, col: 2 } }, // 상하이 조 후방
  { charId: "cho", pos: { row: 2, col: 2 } }, // 조병옥 후방
];

let run: RunState;
let seed = 42;
let busy = false;
const ui: Ui = { selectedSkillId: null, hoverTargetUid: null, damaged: new Set(), seed };

function resetUi(): void {
  ui.selectedSkillId = null;
  ui.hoverTargetUid = null;
  ui.damaged = new Set();
}

function render(): void {
  if (run.phase === "battle" && run.battle) {
    renderApp(app, run.battle, ui, battleHandlers);
    driveBattle();
  } else {
    renderRunScreen(app, getRunView(run), runHandlers);
  }
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
  ui.damaged = new Set(b.log.slice(before).flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
  ui.selectedSkillId = null;
  ui.hoverTargetUid = null;
  render();
}

const battleHandlers: Handlers = {
  onSkill(skillId) {
    if (busy || !run.battle || run.battle.phase !== "inProgress") return;
    // 타겟팅 모드 진입 — self/ally 스킬은 자기/아군 칸이 하이라이트되어 클릭으로 시전
    ui.selectedSkillId = skillId;
    ui.hoverTargetUid = null;
    render();
  },
  onTarget(uid) {
    if (busy || !ui.selectedSkillId) return;
    battleStep({ type: "skill", skillId: ui.selectedSkillId, targetUid: uid });
  },
  onHover(uid) {
    if (ui.selectedSkillId && uid !== ui.hoverTargetUid) {
      ui.hoverTargetUid = uid;
      render();
    }
  },
  onCancel() {
    ui.selectedSkillId = null;
    ui.hoverTargetUid = null;
    render();
  },
  onSkip() {
    if (!busy) battleStep({ type: "skip" });
  },
  onNewBattle() {
    runHandlers.onRestart(); // 전투 화면의 '새 전투' = 런 재시작
  },
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
};

function newRun(s: number): void {
  seed = s;
  ui.seed = s;
  run = createRun(s, ROSTER);
  resetUi();
  render();
}

// Esc로 타겟팅 취소
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.selectedSkillId) battleHandlers.onCancel();
});

newRun(42);
