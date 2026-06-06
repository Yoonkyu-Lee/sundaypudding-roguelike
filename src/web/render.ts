// 전투 렌더 — 영속 셸(svg·header·battlelayout)을 1회 만들고, 매 step **배틀 존만** 갱신.
// .battleleft(행동서열 패널)는 TimelinePanel이 소유 → 통짜 재렌더에서 분리(주사위↔타임라인 연속성).
import type { GameEvent, GameState, Observation, Skill } from "../core/types.ts";
import { buildObservation } from "../core/observation.ts";
import { previewHpLoss, predictInterruptSubjects, computeAreaCells, reachableColumns, previewDamage, previewDamageParts } from "../core/engine.ts";
import { SKILLS } from "../data/skills.ts";
import { ck, esc, type Handlers, type SkillBarEntry, type TgtCtx, type Ui } from "./battle/shared.ts";
import { unitCard } from "./battle/unitCard.ts";
import { actionPanel } from "./battle/actions.ts";
import { drawArrow } from "./battle/arrow.ts";
import { formatEvent } from "./battle/events.ts";
import type { TimelinePanel } from "./battle/timelinePanel.ts";

// 외부(main/runRender) 호환: 공개 표면 재노출
export { avatarHtml } from "./battle/shared.ts";
export type { Ui, Handlers } from "./battle/shared.ts";
export { formatEvent } from "./battle/events.ts";

function grid(title: string, units: Observation["allies"], side: "ally" | "enemy", curUid: string | null, damaged: Set<string>, moved: Set<string>, tgt: TgtCtx): string {
  let cells = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const u = units.find((x) => x.alive && x.pos.row === row && x.pos.col === col);
      const key = `${row},${col}`;
      const onSide = tgt.active && tgt.areaSide === side;
      const clickable = onSide && tgt.anchorOk.has(key);
      const inArea = onSide && tgt.footprint.has(key);
      const picked = onSide && tgt.picked.has(key);
      const cls = `cell${clickable ? " cellpick" : ""}${inArea ? " inarea" : ""}${picked ? " picked" : ""}`;
      const attr = clickable ? `data-cell="${row},${col}"` : "";
      cells += `<div class="${cls}" ${attr}>${u ? unitCard(u, u.uid === curUid, damaged.has(u.uid), tgt, moved.has(u.uid)) : `<span class="empty">·</span>`}</div>`;
    }
  }
  return `<div class="side ${side}"><h2>${title}</h2><div class="board">${cells}</div></div>`;
}

/** 전투 셸(svg·header·3존)을 1회 생성하고 패널을 .battleleft에 마운트. 헤더 버튼은 1회 와이어링. */
function ensureShell(app: HTMLElement, ui: Ui, h: Handlers, panel: TimelinePanel): void {
  if (app.querySelector(".battlelayout")) return;
  // 플레이어 전투 헤더 = 타이틀 + ⏸(런 제어는 일시정지 메뉴). seed 입력/'새 전투'는 샌드박스(개발) 잔재 → 제거(웹-티 number 스피너·중복 제어).
  app.innerHTML = `<svg class="arrows"></svg>
    <header><h1>🍮 Sundaypudding Roguelike</h1>
      <div class="meta"><span id="roundmeta"></span> <button class="hdr-menu" id="pausebtn" aria-label="메뉴 (Esc)">⏸</button></div>
    </header>
    <div class="battlelayout"><aside class="battleleft"></aside><div class="battlemain"></div><aside class="battleside"></aside></div>`;
  app.querySelector(".battleleft")!.appendChild(panel.root);
  app.querySelector<HTMLButtonElement>("#pausebtn")!.addEventListener("click", () => h.onPause());
}

// 빈 타겟팅 컨텍스트.
function inertTgt(obs: Observation, ui: Ui): TgtCtx {
  return { active: false, validHit: new Map(), previewLoss: new Map(), casterUid: obs.current?.uid ?? null, areaSide: null, hoverCell: ui.hoverCell ? ck(ui.hoverCell) : null, anchorOk: new Set(), footprint: new Set(), picked: new Set() };
}

/** TS 경로: GameState로 타겟팅 컨텍스트(미리보기 포함) 계산. */
function computeTgtFromState(state: GameState, obs: Observation, ui: Ui): { tgt: TgtCtx; ghostNames: string[] } {
  const tgt = inertTgt(obs, ui);
  let ghostNames: string[] = [];
  if (ui.selectedSkillId && obs.current?.side === "ally") {
    tgt.active = true;
    const skill = SKILLS[ui.selectedSkillId];
    const actor = state.units.find((u) => u.uid === obs.current!.uid)!;
    for (const la of obs.legalActions) if (la.action.type === "skill" && la.action.skillId === ui.selectedSkillId && la.targetUid) tgt.validHit.set(la.targetUid, la.hitChance ?? 100);
    const side = skill.target === "enemy" ? "enemy" : skill.target === "ally" ? "ally" : null;
    tgt.areaSide = side;
    if (side) {
      const sideUnits = side === "enemy" ? obs.enemies : obs.allies;
      let rows = 4; let cols = 4;
      for (const u of sideUnits.filter((x) => x.alive)) { rows = Math.max(rows, u.pos.row + 1); cols = Math.max(cols, u.pos.col + 1); }
      const region = new Set<string>();
      if (skill.reach !== undefined) { const cols2 = new Set(reachableColumns(state, side, skill.reach)); for (const u of sideUnits) if (u.alive && cols2.has(u.pos.col)) region.add(ck(u.pos)); }
      else if (skill.targetCells?.length) for (const c of skill.targetCells) region.add(ck(c));
      else for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) region.add(`${r},${c}`);
      fillFootprint(tgt, skill.area, region, rows, cols, ui);
      for (const key of tgt.footprint) {
        const [r, c] = key.split(",").map(Number);
        const tu = state.units.find((u) => u.alive && u.side === side && u.pos.row === r && u.pos.col === c);
        if (tu) tgt.previewLoss.set(tu.uid, previewHpLoss(state, actor, skill, tu));
      }
    }
    const anchorUnit = ui.hoverCell ? state.units.find((u) => u.alive && u.side === side && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col) : undefined;
    ghostNames = predictInterruptSubjects(state, actor, skill, anchorUnit?.uid).map((uid) => state.units.find((u) => u.uid === uid)?.name ?? uid);
  }
  return { tgt, ghostNames };
}

/** Rust 타겟팅 미리보기(IPC battle_targeting 결과) — 유닛별 HP손실 + 끼어들기 고스트. */
export interface ObsTargeting { previewLoss: Record<string, { hpLoss: number; shieldConsumed: number }>; ghosts: string[] }

/** Rust 경로: 관측만으로 타겟팅(유효칸·명중%=legalActions, 면적=순수 computeAreaCells). 미리보기/고스트는 IPC(prev)로 주입. */
function computeTgtFromObs(obs: Observation, ui: Ui, prev?: ObsTargeting): { tgt: TgtCtx; ghostNames: string[] } {
  const tgt = inertTgt(obs, ui);
  if (ui.selectedSkillId && obs.current?.side === "ally") {
    tgt.active = true;
    const skill = SKILLS[ui.selectedSkillId];
    for (const la of obs.legalActions) if (la.action.type === "skill" && la.action.skillId === ui.selectedSkillId && la.targetUid) tgt.validHit.set(la.targetUid, la.hitChance ?? 100);
    const side = skill.target === "enemy" ? "enemy" : skill.target === "ally" ? "ally" : null;
    tgt.areaSide = side;
    if (side) {
      const sideUnits = side === "enemy" ? obs.enemies : obs.allies;
      let rows = 4; let cols = 4;
      for (const u of sideUnits.filter((x) => x.alive)) { rows = Math.max(rows, u.pos.row + 1); cols = Math.max(cols, u.pos.col + 1); }
      // 유효 앵커칸 = legalActions 대상 위치(reach/마스크는 legalActions가 이미 반영)
      const region = new Set<string>();
      for (const la of obs.legalActions) if (la.action.type === "skill" && la.action.skillId === ui.selectedSkillId && la.targetUid) { const tu = sideUnits.find((u) => u.uid === la.targetUid); if (tu) region.add(ck(tu.pos)); }
      fillFootprint(tgt, skill.area, region, rows, cols, ui);
      if (prev) for (const [uid, hl] of Object.entries(prev.previewLoss)) tgt.previewLoss.set(uid, hl);
    }
  }
  return { tgt, ghostNames: prev?.ghosts ?? [] };
}

function fillFootprint(tgt: TgtCtx, area: Skill["area"], region: Set<string>, rows: number, cols: number, ui: Ui): void {
  if (area?.kind === "free") {
    tgt.picked = new Set(ui.pickedCells.map(ck));
    if (ui.pickedCells.length === 0) tgt.anchorOk = region;
    else for (const p of ui.pickedCells) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const r = p.row + dr, c = p.col + dc; if (r >= 0 && r < rows && c >= 0 && c < cols && !tgt.picked.has(`${r},${c}`)) tgt.anchorOk.add(`${r},${c}`); }
    tgt.footprint = new Set(tgt.picked);
    if (ui.hoverCell && tgt.anchorOk.has(ck(ui.hoverCell))) tgt.footprint.add(ck(ui.hoverCell));
  } else {
    tgt.anchorOk = region;
    if (area?.kind === "all") { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tgt.footprint.add(`${r},${c}`); }
    else if (ui.hoverCell) for (const c of computeAreaCells(ui.hoverCell, area, rows, cols)) tgt.footprint.add(ck(c));
  }
}

/** 현재 행동자 활성 스킬 바(TS — state 미리보기). */
function buildSkillBar(state: GameState, actorUid: string | null): SkillBarEntry[] {
  const actor = actorUid ? state.units.find((u) => u.uid === actorUid) : null;
  if (!actor) return [];
  return actor.activeSkillIds.map((id) => {
    const sk = SKILLS[id];
    const isDmg = !!sk?.effects.some((e) => e.kind === "damage");
    return { skillId: id, cooldown: actor.cooldowns[id] ?? 0, effDmg: isDmg && sk ? previewDamage(state, actor, sk) : undefined, parts: sk ? (previewDamageParts(state, actor, sk) ?? undefined) : undefined };
  });
}

// ── 전투 렌더 (존 갱신) — TS 경로 ──
export function renderApp(app: HTMLElement, state: GameState, ui: Ui, h: Handlers, panel: TimelinePanel): void {
  ensureShell(app, ui, h, panel);
  const obs = buildObservation(state);
  const { tgt, ghostNames } = computeTgtFromState(state, obs, ui);
  const bar = buildSkillBar(state, obs.current?.uid ?? null);
  const logHtml = state.log.slice(-40).map((e) => formatEvent(state.units, e)).filter(Boolean).join("<br>");
  renderBattleZones(app, obs, tgt, ghostNames, bar, logHtml, ui, h, panel);
}

/** Rust 경로 — 관측 + 스킬바 + 로그(이벤트) 직접. 타겟팅 미리보기/고스트는 prev(IPC)로 주입. */
export function renderAppObs(app: HTMLElement, obs: Observation, bar: SkillBarEntry[], logEvents: GameEvent[], ui: Ui, h: Handlers, panel: TimelinePanel, prev?: ObsTargeting): void {
  ensureShell(app, ui, h, panel);
  const { tgt, ghostNames } = computeTgtFromObs(obs, ui, prev);
  const units = [...obs.allies, ...obs.enemies].map((u) => ({ uid: u.uid, name: u.name }));
  const logHtml = logEvents.slice(-40).map((e) => formatEvent(units, e)).filter(Boolean).join("<br>");
  renderBattleZones(app, obs, tgt, ghostNames, bar, logHtml, ui, h, panel);
}

/** 공유 존 렌더 — obs/tgt/bar/로그만 의존(GameState 비의존). */
function renderBattleZones(app: HTMLElement, obs: Observation, tgt: TgtCtx, ghostNames: string[], bar: SkillBarEntry[], logHtml: string, ui: Ui, h: Handlers, panel: TimelinePanel): void {
  const curUid = obs.current?.uid ?? null;
  const meta = app.querySelector("#roundmeta");
  if (meta) meta.textContent = `ROUND ${obs.round} · ${obs.phase} ·`;

  const mainEl = app.querySelector<HTMLElement>(".battlemain")!;
  const dlg = ui.dialog ? `<div class="battle-dialog">${ui.dialog.speaker ? `<span class="bd-speaker">${esc(ui.dialog.speaker)}</span>` : ""}<span class="bd-text">${esc(ui.dialog.text)}</span></div>` : "";
  mainEl.innerHTML = `${dlg}<div class="arena">${grid("아군", obs.allies, "ally", curUid, ui.damaged, ui.moved, tgt)}${grid("적", obs.enemies, "enemy", curUid, ui.damaged, ui.moved, tgt)}</div>${actionPanel(obs, bar, ui)}`;

  const sideEl = app.querySelector<HTMLElement>(".battleside")!;
  sideEl.innerHTML = `<div class="logpanel"><h2>전투 로그</h2><div class="loginner">${logHtml}</div></div>`;

  panel.update(obs, ghostNames);

  // 와이어링 (배틀 존 한정)
  mainEl.querySelectorAll<HTMLButtonElement>("button.skcard[data-skill]").forEach((b) =>
    b.addEventListener("click", () => h.onSkill(b.dataset.skill!)),
  );
  mainEl.querySelector("#skipbtn")?.addEventListener("click", () => h.onSkip());
  mainEl.querySelector("#detailbtn")?.addEventListener("click", () => h.onToggleDetail());
  mainEl.querySelector("#cancelbtn")?.addEventListener("click", () => h.onCancel());
  mainEl.querySelectorAll<HTMLElement>("[data-cell]").forEach((el) => {
    const [row, col] = el.dataset.cell!.split(",").map(Number);
    el.addEventListener("click", () => h.onCellClick({ row, col }));
    el.addEventListener("mouseenter", () => h.onCellHover({ row, col }));
    el.addEventListener("mouseleave", () => h.onCellHover(null));
  });
  // 프로필 버튼: 셀 클릭(타겟팅)으로 전파되지 않게 차단 후 시트 오픈 (uid — 아군/적)
  mainEl.querySelectorAll<HTMLButtonElement>("[data-sheet-uid]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      h.onOpenSheet(b.dataset.sheetUid!);
    }),
  );

  const lp = sideEl.querySelector<HTMLElement>(".loginner");
  if (lp) lp.scrollTop = lp.scrollHeight;

  // 화살표: 타겟팅 + 호버 칸의 "대상 진영" 유닛으로 (좌표 공유 → side 필터 필수)
  // 매 렌더 먼저 비운다 — 시전/취소로 타겟팅이 끝나면 직전 화살표가 잔류하지 않게.
  const svg = app.querySelector(".arrows");
  if (svg) svg.innerHTML = "";
  if (tgt.active && tgt.casterUid && ui.hoverCell && tgt.areaSide) {
    const sideUnits = tgt.areaSide === "enemy" ? obs.enemies : obs.allies;
    const hu = sideUnits.find((u) => u.alive && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col);
    // 유닛이 있으면 그 카드로, 빈 칸이면 호버 중인 앵커 칸으로 (빈 칸 타겟팅도 화살표 표시)
    const targetEl = hu
      ? app.querySelector<HTMLElement>(`.card[data-uid="${hu.uid}"]`)
      : app.querySelector<HTMLElement>(`.side.${tgt.areaSide} [data-cell="${ui.hoverCell.row},${ui.hoverCell.col}"]`);
    if (targetEl) drawArrow(app, tgt.casterUid, targetEl);
  }
}
