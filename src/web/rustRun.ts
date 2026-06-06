// 풀 게임 Rust 하네스 (P2-7) — `?core=rust&full=1`. 전체 로그라이크를 Rust RunSession(IPC)으로 구동.
// 맵 진행·보상·상점·인카운터·전투 전부 Rust 코어. 전투는 실제 unitCard 그리드 재사용(관측은 TS와 바이트 동일).
// 범위: yain 런. AI 적턴 자동(run_battle_ai_step). 타입스크립트 코어와 동일 differential 입증분의 육안 확인.
import type { Action, GameEvent, Observation, UnitView } from "../core/types.ts";
import { unitCard } from "./battle/unitCard.ts";
import { esc, type TgtCtx } from "./battle/shared.ts";

const INERT: TgtCtx = { active: false, validHit: new Map(), previewLoss: new Map(), casterUid: null, areaSide: null, hoverCell: null, anchorOk: new Set(), footprint: new Set(), picked: new Set() };

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
function invoker(): Invoke | null {
  const t = (globalThis as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  return t?.core?.invoke ?? null;
}

interface RunView {
  phase: string; floor: number; totalFloors: number; gold: number;
  nodes: { id: string; type: string; status: string; label?: string }[];
  party: { name: string; charId: string; hp: number; maxHp: number; alive: boolean; activeCount: number; skills: { id: string; name: string; active: boolean }[] }[];
  rewards: { id: string; label: string }[] | null;
  shop: { id: string; cost: number; label: string }[] | null;
  encounter: { id: string; title: string; text: string; choices: { id: string; label: string }[] } | null;
  log: string[];
}
interface BattleStepResult { eventDelta: GameEvent[]; observation: Observation | null; view: RunView }

const NODE_ICON: Record<string, string> = { start: "🚪", battle: "⚔️", elite: "💀", boss: "👑", shop: "🛒", rest: "🏕️", encounter: "❓", clear: "🏁" };

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
    // 적 턴이면 자동 진행
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

  function partyBar(): string {
    return `<div class="rr-party">${view.party.map((p) => `<div class="rr-pm ${p.alive ? "" : "dead"}"><span class="rr-nm">${esc(p.name)}</span><div class="rr-hpbar"><div class="rr-hp" style="width:${Math.max(0, (p.hp / p.maxHp) * 100)}%"></div></div><span class="rr-hpn">${p.hp}/${p.maxHp}</span></div>`).join("")}</div>`;
  }
  function logBox(): string {
    return `<div class="rb-log"><div class="loginner">${view.log.slice(-12).map(esc).join("<br>")}</div></div>`;
  }
  function header(): string {
    return `<header class="rb-head"><h1>🍮 풀 게임</h1><span class="rb-badge rust">Rust 코어 · RunSession (IPC)</span><span class="rb-phase">${esc(view.phase)} · 층 ${view.floor}/${view.totalFloors}</span><span class="rb-seed">💰${view.gold} · seed ${seed}</span><button class="rb-ctl" data-new="1">새 게임</button></header>`;
  }

  function render(): void {
    let body = "";
    if (view.phase === "battle" && obs) {
      const cur = obs.current?.uid ?? null;
      const acts = obs.phase === "inProgress" && obs.current?.side === "ally"
        ? obs.legalActions.map((la, i) => `<button class="rb-act" data-ai="${i}">${esc(la.label)}${la.hitChance != null ? ` <small>${la.hitChance}%</small>` : ""}</button>`).join("")
        : `<span class="rb-phase">적 행동 중…</span>`;
      body = `<div class="arena">${grid("아군", obs.allies, "ally", cur)}${grid("적", obs.enemies, "enemy", cur)}</div><div class="rb-actions">${acts}</div>`;
    } else if (view.phase === "map") {
      const ns = view.nodes.filter((n) => n.status === "reachable");
      body = `<div class="rr-section"><h2>다음 행선지</h2><div class="rb-actions">${ns.map((n) => `<button class="rb-act" data-node="${n.id}">${NODE_ICON[n.type] ?? "•"} ${esc(n.label ?? n.type)}</button>`).join("") || "(없음)"}</div></div>`;
    } else if (view.phase === "reward" && view.rewards) {
      body = `<div class="rr-section"><h2>보상 선택</h2><div class="rb-actions">${view.rewards.map((r) => `<button class="rb-act" data-rw="${r.id}">${esc(r.label)}</button>`).join("")}</div></div>`;
    } else if (view.phase === "shop" && view.shop) {
      body = `<div class="rr-section"><h2>상점 (💰${view.gold})</h2><div class="rb-actions">${view.shop.map((o) => `<button class="rb-act" data-buy="${o.id}" ${view.gold < o.cost ? "disabled" : ""}>${esc(o.label)} <small>${o.cost}G</small></button>`).join("")}<button class="rb-ctl" data-leave="1">나가기</button></div></div>`;
    } else if (view.phase === "encounter" && view.encounter) {
      const e = view.encounter;
      body = `<div class="rr-section"><h2>${esc(e.title)}</h2><p class="rr-text">${esc(e.text)}</p><div class="rb-actions">${e.choices.map((c) => `<button class="rb-act" data-enc="${c.id}">${esc(c.label)}</button>`).join("")}</div></div>`;
    } else if (view.phase === "won" || view.phase === "lost") {
      body = `<div class="rr-section"><h2>${view.phase === "won" ? "🎉 클리어!" : "💀 패배"}</h2><div class="rb-actions"><button class="rb-act" data-new="1">새 게임 (seed ${seed + 1})</button></div></div>`;
    }

    app.innerHTML = `<div class="rb-root">${header()}${partyBar()}${body}${logBox()}</div>`;
    app.querySelector<HTMLButtonElement>("[data-new]")?.addEventListener("click", () => { seed += 1; start(); });
    app.querySelectorAll<HTMLButtonElement>("[data-node]").forEach((b) => b.addEventListener("click", () => act("run_enter_node", { nodeId: b.dataset.node })));
    app.querySelectorAll<HTMLButtonElement>("[data-rw]").forEach((b) => b.addEventListener("click", () => act("run_choose_reward", { optionId: b.dataset.rw })));
    app.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => b.addEventListener("click", () => act("run_buy", { offerId: b.dataset.buy })));
    app.querySelector<HTMLButtonElement>("[data-leave]")?.addEventListener("click", () => act("run_leave_shop"));
    app.querySelectorAll<HTMLButtonElement>("[data-enc]").forEach((b) => b.addEventListener("click", () => act("run_encounter", { choiceId: b.dataset.enc })));
    app.querySelectorAll<HTMLButtonElement>(".rb-act[data-ai]").forEach((b) => b.addEventListener("click", () => battleStep("run_battle_step", { action: obs!.legalActions[Number(b.dataset.ai)].action as Action })));
    const lp = app.querySelector<HTMLElement>(".loginner"); if (lp) lp.scrollTop = lp.scrollHeight;
  }

  start();
}
