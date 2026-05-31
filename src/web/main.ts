// 웹 엔트리 — 런 컨트롤러. 맵 ↔ 전투 ↔ 보상 ↔ 결과를 run.phase로 분기.
// 전투는 render.ts(renderApp) 재사용, 맵/보상/결과는 runRender.ts. (7장)
import { step } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, getRunView, type RunState } from "../core/run.ts";
import type { Action } from "../core/types.ts";
import { SKILLS } from "../data/skills.ts";
import { CHARACTERS } from "../data/characters.ts";
import { renderApp, type Handlers, type Ui } from "./render.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { playRoundIntro, type RollView } from "./battle/roundIntro.ts";

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
const ui: Ui = { selectedSkillId: null, hoverCell: null, pickedCells: [], damaged: new Set(), moved: new Set(), seed };

function resetUi(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
  ui.damaged = new Set();
  ui.moved = new Set();
}
function endTargeting(): void {
  ui.selectedSkillId = null;
  ui.hoverCell = null;
  ui.pickedCells = [];
}

let introRound = 0; // 마지막으로 주사위 연출한 라운드 (라운드마다 1회)

function render(): void {
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
        playRoundIntro(app, b.round, views, rs.order.map((e) => e.uid), () => {
          busy = false;
          renderBattle();
        });
        return;
      }
    }
    renderBattle();
  } else {
    introRound = 0; // 전투를 떠나면 리셋 → 다음 전투는 1라운드부터 연출
    renderRunScreen(app, getRunView(run), runHandlers);
  }
}

function renderBattle(): void {
  renderApp(app, run.battle!, ui, battleHandlers);
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
