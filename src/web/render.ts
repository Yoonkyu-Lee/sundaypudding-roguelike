// 웹 렌더러 (사람용 뷰). 코어 상태를 읽어 DOM으로. AI 플레이엔 불필요(8.1).
// 같은 코어 상태를 ASCII(터미널) 대신 HTML로 그릴 뿐 — 진실은 동일.
import type { GameEvent, GameState, Observation, UnitView } from "../core/types.ts";
import { buildObservation } from "../core/observation.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const r1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ── 이벤트 → 사람 가독 한 줄 (8.5: 이벤트 로그 재생) ──
export function formatEvent(state: GameState, e: GameEvent): string | null {
  const nm = (uid?: string) => state.units.find((u) => u.uid === uid)?.name ?? uid ?? "?";
  switch (e.t) {
    case "roundStart":
      return `<b>── ROUND ${e.round} ──</b>`;
    case "turnStart":
      return `· <i>${nm(e.uid)}의 턴${e.kind === "interrupt" ? " ⚡끼어들기" : ""}</i>`;
    case "skillUsed":
      return `${nm(e.uid)} → 「${e.skillId}」${e.targetUid ? ` (${nm(e.targetUid)})` : ""}`;
    case "miss":
      return `&nbsp;&nbsp;✗ 빗나감 (${e.chance}%)`;
    case "hit":
      return `&nbsp;&nbsp;✓ 명중${e.crit ? " 💥크리!" : ""}`;
    case "damage":
      return `&nbsp;&nbsp;💢 ${nm(e.targetUid)} 피해 ${e.final} (쉴드 ${e.toShield}/HP ${e.toHp})`;
    case "statusTick":
      return `&nbsp;&nbsp;${nm(e.targetUid)} ${e.statusId} 지속피해 ${e.dmg}`;
    case "statusApplied":
      return `&nbsp;&nbsp;☢ ${nm(e.targetUid)} ${e.statusId} ${e.stacks}스택(${e.duration}턴)`;
    case "shieldGain":
      return `&nbsp;&nbsp;🛡 ${nm(e.targetUid)} 쉴드 +${e.amount}`;
    case "heal":
      return `&nbsp;&nbsp;➕ ${nm(e.targetUid)} 회복 ${e.amount}`;
    case "move":
      return `&nbsp;&nbsp;↔ ${nm(e.uid)} 이동 (c${e.from.col}→c${e.to.col})`;
    case "interrupt":
      return `&nbsp;&nbsp;⚡ ${nm(e.uid)} 끼어들기!`;
    case "skip":
      return `${nm(e.uid)} 스킵 (${e.reason})`;
    case "death":
      return `&nbsp;&nbsp;☠ ${nm(e.uid)} 전투불능`;
    case "battleEnd":
      return `<b>${e.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}</b>`;
    default:
      return null;
  }
}

// ── 유닛 카드 ──
function statusChips(u: UnitView): string {
  return u.statuses
    .map((s) => `<span class="chip" title="${s.id}">${s.icon}<sup>${s.stacks}</sup><sub>${s.duration}</sub></span>`)
    .join("");
}

function formationBadge(u: UnitView): string {
  const a = u.formation.attackPower > 0 ? `<span class="fb atk">⚔+${r1(u.formation.attackPower)}</span>` : "";
  const d = u.formation.defensePower > 0 ? `<span class="fb def">🛡+${r1(u.formation.defensePower)}</span>` : "";
  return a + d;
}

function unitCard(u: UnitView, isCurrent: boolean, damaged: boolean): string {
  const hpPct = Math.max(0, (u.hp / u.hpMax) * 100);
  const cls = ["card", u.side, isCurrent ? "current" : "", damaged ? "flash" : ""].join(" ").trim();
  return `<div class="${cls}">
    <div class="cardtop"><span class="nm">${esc(u.name)}</span>${formationBadge(u)}</div>
    <div class="hpbar"><div class="hp" style="width:${hpPct}%"></div>${u.shield > 0 ? `<div class="sh">🛡${u.shield}</div>` : ""}</div>
    <div class="hptext">HP ${u.hp}/${u.hpMax}</div>
    <div class="chips">${statusChips(u)}</div>
  </div>`;
}

function grid(title: string, units: UnitView[], curUid: string | null, damaged: Set<string>): string {
  let cells = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const u = units.find((x) => x.alive && x.pos.row === row && x.pos.col === col);
      cells += `<div class="cell">${u ? unitCard(u, u.uid === curUid, damaged.has(u.uid)) : `<span class="empty">c${col}r${row}</span>`}</div>`;
    }
  }
  return `<div class="side"><h2>${title}</h2><div class="board">${cells}</div></div>`;
}

function turnBar(obs: Observation, state: GameState): string {
  const chips = obs.order
    .map((e) => {
      const nm = state.units.find((u) => u.uid === e.uid)?.name ?? e.uid;
      const cur = obs.current && e.uid === obs.current.uid ? " cur" : "";
      return e.kind === "interrupt"
        ? `<span class="tchip interrupt${cur}">⚡${esc(nm)}</span>`
        : `<span class="tchip${cur}">${esc(nm)} <em>${e.spd}</em></span>`;
    })
    .join("");
  return `<div class="turnbar">${chips || "<span class='tchip'>—</span>"}</div>`;
}

function actionPanel(obs: Observation): string {
  if (obs.phase !== "inProgress") {
    return `<div class="actions"><div class="result">${obs.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}</div></div>`;
  }
  const isAlly = obs.current?.side === "ally";
  if (!isAlly) {
    return `<div class="actions"><div class="enemyturn">적(${esc(obs.current?.name ?? "")}) 행동 중…</div></div>`;
  }
  const btns = obs.legalActions
    .map((a, i) => {
      const hit = a.hitChance !== undefined ? `<em>${a.hitChance}%</em>` : "";
      return `<button class="act" data-idx="${i}">${esc(a.label)} ${hit}</button>`;
    })
    .join("");
  return `<div class="actions"><div class="prompt">▶ ${esc(obs.current?.name ?? "")}의 턴 — 행동 선택</div>${btns}</div>`;
}

// ── 전체 렌더 ──
export function renderApp(
  app: HTMLElement,
  state: GameState,
  onAction: (idx: number) => void,
  onNewBattle: (seed: number) => void,
  damaged: Set<string>,
  seed: number,
): void {
  const obs = buildObservation(state);
  const logHtml = state.log
    .slice(-40)
    .map((e) => formatEvent(state, e))
    .filter(Boolean)
    .join("<br>");

  app.innerHTML = `
    <header>
      <h1>🍮 Sunday Pudding Roguelike</h1>
      <div class="meta">ROUND ${obs.round} · ${obs.phase} · seed
        <input id="seed" type="number" value="${seed}" /> <button id="newb">새 전투</button>
      </div>
    </header>
    ${turnBar(obs, state)}
    <div class="arena">
      ${grid("아군", obs.allies, obs.current?.uid ?? null, damaged)}
      ${grid("적", obs.enemies, obs.current?.uid ?? null, damaged)}
    </div>
    ${actionPanel(obs)}
    <div class="logpanel"><div class="loginner">${logHtml}</div></div>
  `;

  app.querySelectorAll<HTMLButtonElement>("button.act").forEach((b) => {
    b.addEventListener("click", () => onAction(Number(b.dataset.idx)));
  });
  const newb = app.querySelector<HTMLButtonElement>("#newb");
  const seedInput = app.querySelector<HTMLInputElement>("#seed");
  newb?.addEventListener("click", () => onNewBattle(Number(seedInput?.value ?? seed)));
  const lp = app.querySelector<HTMLElement>(".loginner");
  if (lp) lp.scrollTop = lp.scrollHeight;
}
