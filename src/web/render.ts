// 웹 렌더러 (사람용 뷰). 코어 상태를 읽어 DOM으로. 2단계 상호작용: 스킬 선택 → 타겟팅.
// 에셋 없이 텍스트·도형·선으로: 칸 하이라이트(2.4)·머리위 명중%(2.7)·눈금 화살표·HP 미리보기(0.2).
import type { GameEvent, GameState, Observation, Skill, UnitView } from "../core/types.ts";
import { buildObservation } from "../core/observation.ts";
import { previewHpLoss, predictInterruptSubjects } from "../core/engine.ts";
import { SKILLS } from "../data/skills.ts";
import { STATUS_DEFS } from "../data/statuses.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const r1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 스킬 설명 — 데이터에서 사람 가독 텍스트 생성 (정보 비대칭 해소)
function skillDesc(sk: Skill): string {
  const range =
    sk.target !== "enemy" ? (sk.target === "self" ? "자신" : "아군") : sk.targetCells && sk.targetCells.length ? "근접" : "원거리";
  const meta = [range, `쿨${sk.cooldown}`, sk.target === "enemy" ? `명중${sk.accuracy >= 0 ? "+" : ""}${sk.accuracy}` : sk.alwaysHit ? "필중" : ""]
    .filter(Boolean)
    .join(" · ");
  const fx = sk.effects.map((e) => {
    switch (e.kind) {
      case "damage": return `피해 ${e.amount}`;
      case "applyStatus": return `${STATUS_DEFS[e.statusId]?.name ?? e.statusId} ${e.stacks}스택(${e.duration}턴)`;
      case "shield": return `쉴드 +${e.amount}`;
      case "heal": return `회복 ${e.amount}`;
      case "move": return e.deltaCol > 0 ? "뒤로 밀기" : "앞으로 끌기";
      default: return "";
    }
  }).filter(Boolean);
  if (sk.grantsInterrupt) {
    const who = sk.grantsInterruptTo === "target" ? "대상 끼어들기" : "끼어들기";
    fx.push(`${who}${sk.grantsInterrupt > 1 ? ` ×${sk.grantsInterrupt}` : ""}`);
  }
  return `${meta} | ${fx.join(", ")}`;
}

// ── UI 상태 / 핸들러 ──
export interface Ui {
  selectedSkillId: string | null; // null = 스킬 선택 모드 / 값 = 타겟팅 모드
  hoverTargetUid: string | null;
  damaged: Set<string>;
  seed: number;
}
export interface Handlers {
  onSkill: (skillId: string) => void;
  onTarget: (uid: string) => void;
  onHover: (uid: string | null) => void;
  onCancel: () => void;
  onSkip: () => void;
  onNewBattle: (seed: number) => void;
}

// ── 이벤트 → 사람 가독 한 줄 (8.5) ──
export function formatEvent(state: GameState, e: GameEvent): string | null {
  const nm = (uid?: string) => state.units.find((u) => u.uid === uid)?.name ?? uid ?? "?";
  switch (e.t) {
    case "roundStart": return `<b>── ROUND ${e.round} ──</b>`;
    case "turnStart": return `· <i>${nm(e.uid)}의 턴${e.kind === "interrupt" ? " ⚡끼어들기" : ""}</i>`;
    case "skillUsed": return `${nm(e.uid)} → 「${e.skillId}」${e.targetUid ? ` (${nm(e.targetUid)})` : ""}`;
    case "miss": return `&nbsp;&nbsp;✗ 빗나감 (${e.chance}%)`;
    case "hit": return `&nbsp;&nbsp;✓ 명중${e.crit ? " 💥크리!" : ""}`;
    case "damage": return `&nbsp;&nbsp;💢 ${nm(e.targetUid)} 피해 ${e.final} (쉴드 ${e.toShield}/HP ${e.toHp})`;
    case "statusTick": return `&nbsp;&nbsp;${nm(e.targetUid)} ${e.statusId} 지속피해 ${e.dmg}`;
    case "statusApplied": return `&nbsp;&nbsp;☢ ${nm(e.targetUid)} ${e.statusId} ${e.stacks}스택(${e.duration}턴)`;
    case "shieldGain": return `&nbsp;&nbsp;🛡 ${nm(e.targetUid)} 쉴드 +${e.amount}`;
    case "heal": return `&nbsp;&nbsp;➕ ${nm(e.targetUid)} 회복 ${e.amount}`;
    case "move": return `&nbsp;&nbsp;↔ ${nm(e.uid)} 이동 (c${e.from.col}→c${e.to.col})`;
    case "interrupt": return `&nbsp;&nbsp;⚡ ${nm(e.uid)} 끼어들기!`;
    case "skip": return `${nm(e.uid)} 스킵 (${e.reason})`;
    case "death": return `&nbsp;&nbsp;☠ ${nm(e.uid)} 전투불능`;
    case "battleEnd": return `<b>${e.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}</b>`;
    default: return null;
  }
}

// ── 타겟팅 컨텍스트 ──
interface TgtCtx {
  active: boolean;
  validHit: Map<string, number>; // uid → 명중%
  hoverUid: string | null;
  previewLoss: { hpLoss: number; shieldConsumed: number } | null; // 호버 대상 예상
  casterUid: string | null;
}

function statusChips(u: UnitView): string {
  return u.statuses
    .map((s) => {
      const buff = STATUS_DEFS[s.id]?.buff ? " buff" : " debuff";
      return `<span class="chip${buff}" title="${s.id}">${s.icon}<sup>${s.stacks}</sup><sub>${s.duration}</sub></span>`;
    })
    .join("");
}
function formationBadge(u: UnitView): string {
  const a = u.formation.attackPower > 0 ? `<span class="fb atk">⚔+${r1(u.formation.attackPower)}</span>` : "";
  const d = u.formation.defensePower > 0 ? `<span class="fb def">🛡+${r1(u.formation.defensePower)}</span>` : "";
  return a + d;
}

function unitCard(u: UnitView, isCurrent: boolean, damaged: boolean, tgt: TgtCtx): string {
  const targetable = tgt.active && tgt.validHit.has(u.uid);
  const hovering = targetable && tgt.hoverUid === u.uid;
  const hpPct = Math.max(0, (u.hp / u.hpMax) * 100);

  // 호버 시 HP 깎일 양 미리보기 (쉴드/관통/공포 반영, 0.2 투명성)
  let preview = "";
  let lossText = "";
  if (hovering && tgt.previewLoss) {
    const { hpLoss, shieldConsumed } = tgt.previewLoss;
    const leftPct = ((u.hp - hpLoss) / u.hpMax) * 100;
    const widthPct = (hpLoss / u.hpMax) * 100;
    preview = `<div class="ploss" style="left:${leftPct}%;width:${widthPct}%"></div>`;
    lossText = ` <span class="lossnum">−${hpLoss}</span>${shieldConsumed > 0 ? `<span class="absnum">(🛡−${shieldConsumed})</span>` : ""}`;
  }

  const cls = ["card", u.side, isCurrent ? "current" : "", damaged ? "flash" : "", targetable ? "tgt" : "", hovering ? "hovering" : ""].join(" ").replace(/\s+/g, " ").trim();
  const dataTgt = targetable ? `data-target="${u.uid}"` : "";
  const hitBadge = targetable ? `<div class="hitbadge">${tgt.validHit.get(u.uid)}%</div>` : "";

  return `<div class="${cls}" data-uid="${u.uid}" ${dataTgt}>
    ${hitBadge}
    <div class="cardtop"><span class="nm">${esc(u.name)}</span>${formationBadge(u)}</div>
    <div class="hpbar"><div class="hp" style="width:${hpPct}%"></div>${preview}${u.shield > 0 ? `<div class="sh">🛡${u.shield}</div>` : ""}</div>
    <div class="hptext">HP ${u.hp}/${u.hpMax}${lossText}</div>
    <div class="chips">${statusChips(u)}</div>
  </div>`;
}

function grid(title: string, units: UnitView[], side: "ally" | "enemy", curUid: string | null, damaged: Set<string>, tgt: TgtCtx): string {
  let cells = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const u = units.find((x) => x.alive && x.pos.row === row && x.pos.col === col);
      const cellTargetable = u && tgt.active && tgt.validHit.has(u.uid);
      const cls = `cell${cellTargetable ? " targetable" : ""}`;
      cells += `<div class="${cls}">${u ? unitCard(u, u.uid === curUid, damaged.has(u.uid), tgt) : `<span class="empty">c${col}r${row}</span>`}</div>`;
    }
  }
  return `<div class="side"><h2>${title}</h2><div class="board">${cells}</div></div>`;
}

// 동적 삽입형 타임라인: 완료(✓ 흐림) / 현재(▶ 포인터) / 예정 / 끼어들기(초록 삽입) / 사망(회색 취소선)
// previewInterrupts > 0 이면 현재 칸 뒤에 "끼어들기 예고" 유령 칸(밖→안 슬라이드+깜빡)을 삽입.
// ghostNames: 현재 칸 뒤에 삽입될 끼어들기 주체 이름들(예고). 초록 모션만으로 예고를 전달, 텍스트 불필요.
function turnBar(obs: Observation, state: GameState, ghostNames: string[]): string {
  const parts: string[] = [];
  obs.order.forEach((e, i) => {
    const u = state.units.find((x) => x.uid === e.uid);
    const nm = u?.name ?? e.uid;
    const dead = u ? !u.alive : false;
    const done = i < obs.cursorIndex;
    const cur = i === obs.cursorIndex;
    const cls = ["tchip", e.kind === "interrupt" ? "interrupt" : "", cur ? "cur" : "", done ? "done" : "", dead ? "dead" : ""]
      .join(" ").replace(/\s+/g, " ").trim();
    const ptr = cur ? `<span class="turnptr">▶</span>` : "";
    const label = e.kind === "interrupt" ? `⚡${esc(nm)}` : `${esc(nm)} <em>${e.spd}</em>`;
    parts.push(`${ptr}<span class="${cls}">${done && !dead ? "✓" : ""}${label}</span>`);
    // 끼어들기 예고: 현재 칸 바로 뒤. 주체 이름 표시(서포트면 다른 캐릭일 수 있음).
    if (cur) {
      for (const name of ghostNames) {
        parts.push(`<span class="tchip interrupt ghost" title="확정 시 삽입">⚡${esc(name)}</span>`);
      }
    }
  });
  return `<div class="turnbar">${parts.join("") || "<span class='tchip'>—</span>"}</div>`;
}

// 행동 패널: 스킬 선택 모드 vs 타겟팅 모드
function actionPanel(obs: Observation, state: GameState, ui: Ui): string {
  if (obs.phase !== "inProgress") {
    return `<div class="actions"><div class="result">${obs.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}</div></div>`;
  }
  if (obs.current?.side !== "ally") {
    return `<div class="actions"><div class="enemyturn">적(${esc(obs.current?.name ?? "")}) 행동 중…</div></div>`;
  }
  // 스킵만 가능(빙결/쓸 기술 없음)
  const onlySkip = obs.legalActions.length === 1 && obs.legalActions[0].action.type === "skip";
  if (onlySkip) {
    return `<div class="actions"><div class="prompt">▶ ${esc(obs.current.name)}</div><button class="act skip" id="skipbtn">${esc(obs.legalActions[0].label)}</button></div>`;
  }

  const actor = state.units.find((u) => u.uid === obs.current!.uid)!;
  // 스킬별 합법 타겟 그룹
  const group = new Map<string, boolean>();
  for (const la of obs.legalActions) {
    if (la.action.type === "skill") group.set(la.action.skillId, true);
  }

  if (ui.selectedSkillId) {
    const sk = SKILLS[ui.selectedSkillId];
    return `<div class="actions targeting">
      <div class="prompt">🎯 「${esc(sk.name)}」 대상 선택 — 칸을 클릭 <span class="skdesc inline">${esc(skillDesc(sk))}</span></div>
      <button class="act cancel" id="cancelbtn">취소 (Esc)</button>
    </div>`;
  }

  // 스킬 선택 모드: 활성 스킬 4개를 설명과 함께 (쿨/사정권 상태 반영)
  const btns = actor.activeSkillIds
    .map((id) => {
      const sk = SKILLS[id];
      if (!sk) return "";
      const cd = actor.cooldowns[id] ?? 0;
      const usable = group.has(id);
      const disabled = cd > 0 || !usable;
      const reason = cd > 0 ? `쿨 ${cd}` : !usable ? "사정권 없음" : "";
      const attrs = disabled ? "disabled" : `data-skill="${id}"`;
      return `<button class="act sk ${disabled ? "disabled" : ""}" ${attrs} title="${esc(sk.name)} — ${esc(skillDesc(sk))}">
        <span class="skname">${esc(sk.name)}${reason ? ` <em>${reason}</em>` : ""}</span>
        <span class="skdesc">${esc(skillDesc(sk))}</span>
      </button>`;
    })
    .join("");
  return `<div class="actions skillsel"><div class="prompt">▶ ${esc(obs.current.name)}의 턴 — 스킬 선택</div>${btns}</div>`;
}

// 캐스터→타겟 눈금 화살표 (SVG, 측정 기반)
function drawArrow(app: HTMLElement, casterUid: string, targetUid: string): void {
  const svg = app.querySelector<SVGSVGElement>(".arrows");
  const cEl = app.querySelector<HTMLElement>(`.card[data-uid="${casterUid}"]`);
  const tEl = app.querySelector<HTMLElement>(`.card[data-uid="${targetUid}"]`);
  if (!svg || !cEl || !tEl) return;
  const c = cEl.getBoundingClientRect();
  const t = tEl.getBoundingClientRect();
  const x1 = c.left + c.width / 2, y1 = c.top + c.height / 2;
  const x2 = t.left + t.width / 2, y2 = t.top + t.height / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len; // 단위벡터
  const px = -uy, py = ux; // 수직(눈금용)

  // 눈금: 시작~끝 사이 일정 간격으로 짧은 수직 segment
  let ticks = "";
  const step = 22;
  for (let d = step; d < len - 18; d += step) {
    const bx = x1 + ux * d, by = y1 + uy * d;
    ticks += `<line x1="${bx - px * 4}" y1="${by - py * 4}" x2="${bx + px * 4}" y2="${by + py * 4}" class="tick"/>`;
  }
  // 화살촉
  const hx = x2 - ux * 12, hy = y2 - uy * 12;
  const head = `<polygon points="${x2},${y2} ${hx + px * 6},${hy + py * 6} ${hx - px * 6},${hy - py * 6}" class="head"/>`;
  const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="shaft"/>`;
  svg.innerHTML = line + ticks + head;
}

// ── 전체 렌더 ──
export function renderApp(app: HTMLElement, state: GameState, ui: Ui, h: Handlers): void {
  const obs = buildObservation(state);

  // 타겟팅 컨텍스트
  const tgt: TgtCtx = { active: false, validHit: new Map(), hoverUid: ui.hoverTargetUid, previewLoss: null, casterUid: obs.current?.uid ?? null };
  if (ui.selectedSkillId && obs.current?.side === "ally") {
    tgt.active = true;
    for (const la of obs.legalActions) {
      if (la.action.type === "skill" && la.action.skillId === ui.selectedSkillId && la.targetUid) {
        tgt.validHit.set(la.targetUid, la.hitChance ?? 100);
      }
    }
    const actor = state.units.find((u) => u.uid === obs.current!.uid)!;
    const hover = ui.hoverTargetUid ? state.units.find((u) => u.uid === ui.hoverTargetUid) : null;
    if (hover && tgt.validHit.has(hover.uid)) {
      tgt.previewLoss = previewHpLoss(state, actor, SKILLS[ui.selectedSkillId], hover);
    }
  }

  // 끼어들기 예고: 타겟팅 중인 행동이 발생시킬 끼어들기의 주체 이름들 (스킬+버프 등 모든 출처)
  let ghostNames: string[] = [];
  if (ui.selectedSkillId && obs.current?.side === "ally") {
    const actor = state.units.find((u) => u.uid === obs.current!.uid)!;
    const subjects = predictInterruptSubjects(state, actor, SKILLS[ui.selectedSkillId], ui.hoverTargetUid ?? undefined);
    ghostNames = subjects.map((uid) => state.units.find((u) => u.uid === uid)?.name ?? uid);
  }

  const logHtml = state.log.slice(-40).map((e) => formatEvent(state, e)).filter(Boolean).join("<br>");

  app.innerHTML = `
    <svg class="arrows"></svg>
    <header>
      <h1>🍮 Sunday Pudding Roguelike</h1>
      <div class="meta">ROUND ${obs.round} · ${obs.phase} · seed
        <input id="seed" type="number" value="${ui.seed}" /> <button id="newb">새 전투</button>
      </div>
    </header>
    ${turnBar(obs, state, ghostNames)}
    <div class="arena">
      ${grid("아군", obs.allies, "ally", obs.current?.uid ?? null, ui.damaged, tgt)}
      ${grid("적", obs.enemies, "enemy", obs.current?.uid ?? null, ui.damaged, tgt)}
    </div>
    ${actionPanel(obs, state, ui)}
    <div class="logpanel"><div class="loginner">${logHtml}</div></div>
  `;

  // 와이어링
  app.querySelectorAll<HTMLButtonElement>("button.sk[data-skill]").forEach((b) =>
    b.addEventListener("click", () => h.onSkill(b.dataset.skill!)),
  );
  app.querySelector("#skipbtn")?.addEventListener("click", () => h.onSkip());
  app.querySelector("#cancelbtn")?.addEventListener("click", () => h.onCancel());
  app.querySelectorAll<HTMLElement>("[data-target]").forEach((el) => {
    el.addEventListener("click", () => h.onTarget(el.dataset.target!));
    el.addEventListener("mouseenter", () => h.onHover(el.dataset.target!));
    el.addEventListener("mouseleave", () => h.onHover(null));
  });
  app.querySelector<HTMLButtonElement>("#newb")?.addEventListener("click", () => {
    const v = app.querySelector<HTMLInputElement>("#seed");
    h.onNewBattle(Number(v?.value ?? ui.seed));
  });

  const lp = app.querySelector<HTMLElement>(".loginner");
  if (lp) lp.scrollTop = lp.scrollHeight;

  // 화살표: 타겟팅 + 호버 시
  if (tgt.active && tgt.casterUid && ui.hoverTargetUid) {
    drawArrow(app, tgt.casterUid, ui.hoverTargetUid);
  }
}
