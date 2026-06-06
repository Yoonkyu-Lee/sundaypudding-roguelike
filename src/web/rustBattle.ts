// Rust 코어 검증 전투 하네스 (P1-13) — `?core=rust`/`?core=ts` 진입.
// 목적: 포팅한 엔진을 **실제 데스크톱 앱에서 살아있는 채로** 확인. selectBattleBackend로 TS/Rust 백엔드 선택,
// 데모 전투를 **실제 전투 카드(unitCard)** 로 렌더(관측은 이미 TS와 바이트 동일) + 관측의 legalActions로 행동.
// 범위: 전투(데모)만. AI 미포팅 → 적 턴/자동은 first-legal(코퍼스 differential로 TS↔Rust 동일 입증된 정책).
import type { Action, GameEvent, Observation, UnitView } from "../core/types.ts";
import { unitCard } from "./battle/unitCard.ts";
import { esc, type TgtCtx } from "./battle/shared.ts";
import { selectBattleBackend, type BattleBackend } from "./coreAdapter.ts";

const INERT: TgtCtx = {
  active: false, validHit: new Map(), previewLoss: new Map(), casterUid: null,
  areaSide: null, hoverCell: null, anchorOk: new Set(), footprint: new Set(), picked: new Set(),
};

function grid(title: string, units: UnitView[], side: "ally" | "enemy", curUid: string | null): string {
  let cells = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const u = units.find((x) => x.alive && x.pos.row === row && x.pos.col === col);
      cells += `<div class="cell">${u ? unitCard(u, u.uid === curUid, false, INERT, false) : `<span class="empty">·</span>`}</div>`;
    }
  }
  return `<div class="side ${side}"><h2>${title}</h2><div class="board">${cells}</div></div>`;
}

function nameMap(obs: Observation): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of [...obs.allies, ...obs.enemies]) m.set(u.uid, u.name);
  return m;
}

/** 이벤트 델타 한 줄(하네스 전용 — formatEvent는 GameState 필요하므로 관측 이름맵으로 간소 렌더). */
function fmtDelta(ev: GameEvent, nm: Map<string, string>): string {
  const n = (uid?: string) => (uid ? nm.get(uid) ?? uid : "");
  switch (ev.t) {
    case "roundStart": return `── 라운드 ${ev.round} ──`;
    case "turnStart": return `▶ ${n(ev.uid)}${ev.kind === "interrupt" ? " (끼어들기)" : ""}`;
    case "skillUsed": return `${n(ev.uid)}: ${ev.skillId}${ev.targetUid ? ` → ${n(ev.targetUid)}` : ""}`;
    case "hit": return `  명중 ${n(ev.targetUid)} (${ev.chance}%${ev.crit ? " 치명!" : ""})`;
    case "miss": return `  빗나감 ${n(ev.targetUid)} (${ev.chance}%)`;
    case "damage": return `  💥 ${n(ev.targetUid)} −${ev.final}${ev.toShield ? ` (쉴드 ${ev.toShield})` : ""}`;
    case "death": return `  ☠ ${n(ev.uid)} 사망`;
    case "heal": return ev.amount ? `  💚 ${n(ev.targetUid)} +${ev.amount}` : "";
    case "shieldGain": return `  🛡 ${n(ev.targetUid)} +${ev.amount}`;
    case "statusApplied": return `  ✦ ${n(ev.targetUid)} ${ev.statusId}×${ev.stacks}`;
    case "statusTick": return `  ${ev.statusId} ${n(ev.targetUid)} −${ev.dmg}`;
    case "interrupt": return `  ⚡ 끼어들기: ${n(ev.uid)}`;
    case "dialog": return `  💬 ${ev.speaker ? esc(ev.speaker) + ": " : ""}${esc(ev.text)}`;
    case "skip": return `  ${n(ev.uid)} 대기`;
    case "battleEnd": return `═══ ${ev.phase === "allyWin" ? "아군 승리" : "패배"} ═══`;
    default: return "";
  }
}

export function mountRustBattle(app: HTMLElement, startSeed: number): void {
  const backend: BattleBackend = selectBattleBackend();
  let obs: Observation;
  let log: string[] = [];
  let seed = startSeed;
  let busy = false;

  function appendDelta(delta: GameEvent[]): void {
    const nm = nameMap(obs);
    for (const ev of delta) {
      const line = fmtDelta(ev, nm);
      if (line) log.push(line);
    }
  }

  async function boot(s: number): Promise<void> {
    seed = s;
    log = [];
    const r = await backend.create(s);
    obs = r.observation;
    appendDelta(r.eventDelta);
    render();
  }

  async function doStep(action: Action): Promise<void> {
    if (busy || obs.phase !== "inProgress") return;
    busy = true;
    render();
    const r = await backend.step(action);
    appendDelta(r.eventDelta);
    obs = r.observation;
    busy = false;
    render();
  }

  function firstLegal(): Action | null {
    return obs.legalActions[0]?.action ?? null;
  }

  async function auto(toEnd: boolean): Promise<void> {
    if (busy) return;
    do {
      const a = firstLegal();
      if (!a) break;
      await doStep(a);
      if (toEnd && obs.phase === "inProgress") await new Promise((res) => setTimeout(res, 220));
    } while (toEnd && obs.phase === "inProgress");
  }

  function render(): void {
    const cur = obs.current;
    const phaseTxt = obs.phase === "inProgress" ? `라운드 ${obs.round} · ${cur ? `${cur.name} 차례` : "—"}` : obs.phase === "allyWin" ? "아군 승리 🎉" : "패배";
    const badge = backend.kind === "rust" ? `<span class="rb-badge rust">Rust 코어 · spr-core (IPC)</span>` : `<span class="rb-badge ts">TS 코어 · src/core</span>`;
    const actions = obs.phase === "inProgress"
      ? obs.legalActions.map((la, i) =>
          `<button class="rb-act" data-i="${i}">${esc(la.label)}${la.hitChance != null ? ` <small>${la.hitChance}%</small>` : ""}</button>`).join("")
      : `<button class="rb-act" data-new="1">새 전투 (seed ${seed + 1})</button>`;

    app.innerHTML = `<div class="rb-root">
      <header class="rb-head">
        <h1>🍮 전투 엔진 검증</h1>${badge}
        <span class="rb-phase">${esc(phaseTxt)}</span>
        <span class="rb-seed">seed ${seed}</span>
        <button class="rb-ctl" data-new="1">새 전투</button>
        <button class="rb-ctl" data-auto="1" ${busy || obs.phase !== "inProgress" ? "disabled" : ""}>한 수 자동</button>
        <button class="rb-ctl" data-autoend="1" ${busy || obs.phase !== "inProgress" ? "disabled" : ""}>끝까지 자동</button>
      </header>
      <div class="arena">${grid("아군", obs.allies, "ally", cur?.uid ?? null)}${grid("적", obs.enemies, "enemy", cur?.uid ?? null)}</div>
      <div class="rb-actions">${actions}</div>
      <div class="rb-log"><div class="loginner">${log.slice(-60).map(esc).join("<br>")}</div></div>
    </div>`;

    app.querySelector<HTMLButtonElement>("[data-new]")?.addEventListener("click", () => boot(seed + 1));
    app.querySelector<HTMLButtonElement>("[data-auto]")?.addEventListener("click", () => auto(false));
    app.querySelector<HTMLButtonElement>("[data-autoend]")?.addEventListener("click", () => auto(true));
    app.querySelectorAll<HTMLButtonElement>(".rb-act[data-i]").forEach((b) =>
      b.addEventListener("click", () => doStep(obs.legalActions[Number(b.dataset.i)].action)));
    const lp = app.querySelector<HTMLElement>(".loginner");
    if (lp) lp.scrollTop = lp.scrollHeight;
  }

  boot(seed);
}
