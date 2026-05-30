// 웹 엔트리. 코어를 브라우저에서 그대로 구동하고, 뷰를 그린다.
// 아군 = 사람(버튼 클릭), 적 = AI(자동, 약간의 딜레이로 "재생" 느낌). (8.5)
import { createBattle, getLegalActions, step } from "../core/engine.ts";
import { chooseAction } from "../core/ai.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import type { GameState } from "../core/types.ts";
import { renderApp } from "./render.ts";

const app = document.getElementById("app")!;

let state: GameState;
let seed = 42;
let damaged = new Set<string>();
let busy = false;

function applyStep(action: Parameters<typeof step>[1]): void {
  const before = state.log.length;
  step(state, action);
  // 이번 스텝에 피해 본 유닛 → 플래시 (이벤트 로그 기반 연출)
  damaged = new Set(
    state.log.slice(before).flatMap((e) => (e.t === "damage" ? [e.targetUid] : [])),
  );
  tick();
}

function onAction(idx: number): void {
  if (busy || state.phase !== "inProgress") return;
  const legal = getLegalActions(state);
  const la = legal[idx];
  if (la) applyStep(la.action);
}

function tick(): void {
  renderApp(app, state, onAction, newBattle, damaged, seed);
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

function newBattle(s: number): void {
  seed = Number.isFinite(s) ? s : 42;
  state = createBattle(seed, DEMO_ENCOUNTER);
  damaged = new Set();
  tick();
}

newBattle(42);
