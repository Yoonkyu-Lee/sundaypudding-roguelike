// 풀 게임 Rust 하네스 (P2-7/P3) — `?core=rust&full=1`. 전체 로그라이크를 Rust RunSession(IPC)으로 구동.
// **비전투(맵/보상/상점/인카운터/결과) = 실제 renderRunScreen**(RunView 기반, TS와 동일 UI). 전투는 P3-2서 실제 renderApp로.
import type { Action, GameEvent, Observation, UnitView } from "../core/types.ts";
import type { RunView } from "../core/run.ts";
import { renderRunScreen, type RunHandlers } from "./runRender.ts";
import { unitCard } from "./battle/unitCard.ts";
import { esc, type TgtCtx } from "./battle/shared.ts";

const INERT: TgtCtx = { active: false, validHit: new Map(), previewLoss: new Map(), casterUid: null, areaSide: null, hoverCell: null, anchorOk: new Set(), footprint: new Set(), picked: new Set() };

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
function invoker(): Invoke | null {
  const t = (globalThis as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  return t?.core?.invoke ?? null;
}

interface BattleStepResult { eventDelta: GameEvent[]; observation: Observation | null; view: RunView }

export function mountRustRun(app: HTMLElement, startSeed: number): void {
  const invoke = invoker();
  if (!invoke) { app.innerHTML = `<div class="rb-root"><p style="color:var(--enemy)">Rust 코어(Tauri) 런타임이 아님 — 앱에서 ?core=rust&full=1 로 실행하세요.</p></div>`; return; }
  let seed = startSeed;
  let view: RunView;
  let obs: Observation | null = null;
  let busy = false;

  const grid = (title: string, units: UnitView[], side: "ally" | "enemy", cur: string | null): string => {
    let cells = "";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const u = units.find((x) => x.alive && x.pos.row === r && x.pos.col === c);
      cells += `<div class="cell">${u ? unitCard(u, u.uid === cur, false, INERT, false) : `<span class="empty">·</span>`}</div>`;
    }
    return `<div class="side ${side}"><h2>${title}</h2><div class="board">${cells}</div></div>`;
  };

  async function call(cmd: string, args?: Record<string, unknown>): Promise<RunView> {
    return (await invoke!(cmd, args)) as RunView;
  }

  async function start(): Promise<void> { view = await call("run_create", { seed }); obs = null; render(); }

  async function act(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    view = await call(cmd, args);
    busy = false;
    if (view.phase === "battle") { await enterBattle(); } else { render(); }
  }

  async function enterBattle(): Promise<void> {
    obs = (await invoke!("run_battle_obs")) as Observation | null;
    render();
    await maybeAuto();
  }

  async function maybeAuto(): Promise<void> {
    while (view.phase === "battle" && obs && obs.phase === "inProgress" && obs.current && obs.current.side === "enemy") {
      await new Promise((r) => setTimeout(r, 260));
      await battleStep("run_battle_ai_step");
    }
  }

  async function battleStep(cmd: string, args?: Record<string, unknown>): Promise<void> {
    if (busy) return; busy = true;
    const res = (await invoke!(cmd, args)) as BattleStepResult;
    busy = false;
    view = res.view; obs = res.observation;
    if (view.phase !== "battle") { render(); return; } // 전투 종료 → 런 뷰
    render();
    await maybeAuto();
  }

  // 비전투(런) 화면 — 실제 renderRunScreen + Rust IPC 핸들러.
  const runHandlers: RunHandlers = {
    onNode: (id) => act("run_enter_node", { nodeId: id }),
    onReward: (id) => act("run_choose_reward", { optionId: id }),
    onBuy: (id) => act("run_buy", { offerId: id }),
    onLeaveShop: () => act("run_leave_shop"),
    onEncounterChoice: (id) => act("run_encounter", { choiceId: id }),
    onToggleSkill: (charId, skillId) => act("run_set_active", { charId, skillId }),
    onRestart: () => { seed += 1; start(); },
    onToHub: () => { seed += 1; start(); },
    onPause: () => {}, // 하네스: 일시정지 메뉴 생략
    onOpenParty: () => {}, // 파티 편성 오버레이는 P3-3서(Rust 백엔드 시트/편성)
  };

  function battleScreen(): void {
    const cur = obs?.current?.uid ?? null;
    const acts = obs && obs.phase === "inProgress" && obs.current?.side === "ally"
      ? obs.legalActions.map((la, i) => `<button class="rb-act" data-ai="${i}">${esc(la.label)}${la.hitChance != null ? ` <small>${la.hitChance}%</small>` : ""}</button>`).join("")
      : `<span class="rb-phase">적 행동 중…</span>`;
    app.innerHTML = `<div class="rb-root">
      <header class="rb-head"><h1>🍮 전투</h1><span class="rb-badge rust">Rust 코어 (IPC)</span><span class="rb-seed">seed ${seed}</span></header>
      <div class="arena">${grid("아군", obs!.allies, "ally", cur)}${grid("적", obs!.enemies, "enemy", cur)}</div>
      <div class="rb-actions">${acts}</div></div>`;
    app.querySelectorAll<HTMLButtonElement>(".rb-act[data-ai]").forEach((b) => b.addEventListener("click", () => battleStep("run_battle_step", { action: obs!.legalActions[Number(b.dataset.ai)].action as Action })));
  }

  function render(): void {
    if (view.phase === "battle" && obs) { battleScreen(); return; }
    renderRunScreen(app, view, runHandlers); // 실제 런 화면(맵·보상·상점·인카운터·결과)
  }

  start();
}
