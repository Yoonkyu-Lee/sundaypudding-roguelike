// 웹 엔트리. 코어를 브라우저에서 구동 + 2단계 GUI(스킬 선택 → 타겟팅 → 실행).
// 아군 = 사람(클릭), 적 = AI(자동). (8.5)
import { createBattle, getLegalActions, step } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import { SKILLS } from "../data/skills.ts";
import type { Action, GameState } from "../core/types.ts";
import { renderApp, type Handlers, type Ui } from "./render.ts";

const app = document.getElementById("app")!;

let state: GameState;
let busy = false;
const ui: Ui = { selectedSkillId: null, hoverTargetUid: null, damaged: new Set(), seed: 42 };

function rerender(): void {
  renderApp(app, state, ui, handlers);
}

function applyStep(action: Action): void {
  const before = state.log.length;
  step(state, action);
  ui.damaged = new Set(state.log.slice(before).flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])));
  ui.selectedSkillId = null;
  ui.hoverTargetUid = null;
  tick();
}

function tick(): void {
  rerender();
  if (state.phase !== "inProgress" || !state.current) return;
  const actor = state.units.find((u) => u.uid === state.current!.uid)!;
  if (actor.side === "enemy") {
    busy = true;
    setTimeout(() => {
      busy = false;
      applyStep(chooseAction(state));
    }, 650);
  }
}

const handlers: Handlers = {
  onSkill(skillId) {
    if (busy || state.phase !== "inProgress") return;
    const sk = SKILLS[skillId];
    if (sk?.target === "self") {
      // 자기 대상 스킬은 즉시 시전
      applyStep({ type: "skill", skillId, targetUid: state.current!.uid });
    } else {
      ui.selectedSkillId = skillId;
      ui.hoverTargetUid = null;
      rerender();
    }
  },
  onTarget(uid) {
    if (busy || !ui.selectedSkillId) return;
    applyStep({ type: "skill", skillId: ui.selectedSkillId, targetUid: uid });
  },
  onHover(uid) {
    if (ui.selectedSkillId && uid !== ui.hoverTargetUid) {
      ui.hoverTargetUid = uid;
      rerender();
    }
  },
  onCancel() {
    ui.selectedSkillId = null;
    ui.hoverTargetUid = null;
    rerender();
  },
  onSkip() {
    if (busy) return;
    applyStep({ type: "skip" });
  },
  onNewBattle(s) {
    newBattle(s);
  },
};

function newBattle(s: number): void {
  ui.seed = Number.isFinite(s) ? s : 42;
  state = createBattle(ui.seed, DEMO_ENCOUNTER);
  ui.damaged = new Set();
  ui.selectedSkillId = null;
  ui.hoverTargetUid = null;
  tick();
}

// Esc로 타겟팅 취소
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.selectedSkillId) handlers.onCancel();
});

newBattle(42);
