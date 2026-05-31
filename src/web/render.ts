// 전투 렌더 오케스트레이터 — 관측을 읽어 3열 레이아웃(타임라인 좌 │ 전장+행동 │ 로그 우)으로.
// 세부 렌더는 battle/* 모듈. 2단계 상호작용(스킬→타겟)·셀 타겟팅 컨텍스트·SVG 화살표 와이어링만 여기.
import type { GameState, Observation } from "../core/types.ts";
import { buildObservation } from "../core/observation.ts";
import { previewHpLoss, predictInterruptSubjects, computeAreaCells } from "../core/engine.ts";
import { SKILLS } from "../data/skills.ts";
import { ck, type Handlers, type TgtCtx, type Ui } from "./battle/shared.ts";
import { unitCard } from "./battle/unitCard.ts";
import { turnBar } from "./battle/timeline.ts";
import { actionPanel } from "./battle/actions.ts";
import { drawArrow } from "./battle/arrow.ts";
import { formatEvent } from "./battle/events.ts";

// 외부(main/runRender) 호환: 공개 표면 재노출
export { avatarHtml } from "./battle/shared.ts";
export type { Ui, Handlers } from "./battle/shared.ts";
export { formatEvent } from "./battle/events.ts";

function grid(title: string, units: Observation["allies"], side: "ally" | "enemy", curUid: string | null, damaged: Set<string>, tgt: TgtCtx): string {
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
      cells += `<div class="${cls}" ${attr}>${u ? unitCard(u, u.uid === curUid, damaged.has(u.uid), tgt) : `<span class="empty">·</span>`}</div>`;
    }
  }
  return `<div class="side ${side}"><h2>${title}</h2><div class="board">${cells}</div></div>`;
}

// ── 전체 렌더 ──
export function renderApp(app: HTMLElement, state: GameState, ui: Ui, h: Handlers): void {
  const obs = buildObservation(state);

  // 타겟팅 컨텍스트 (셀 기반) — 로직 불변
  const tgt: TgtCtx = {
    active: false, validHit: new Map(), previewLoss: null, casterUid: obs.current?.uid ?? null,
    areaSide: null, hoverCell: ui.hoverCell ? ck(ui.hoverCell) : null,
    anchorOk: new Set(), footprint: new Set(), picked: new Set(),
  };
  let ghostNames: string[] = [];
  if (ui.selectedSkillId && obs.current?.side === "ally") {
    tgt.active = true;
    const skill = SKILLS[ui.selectedSkillId];
    const actor = state.units.find((u) => u.uid === obs.current!.uid)!;
    for (const la of obs.legalActions) {
      if (la.action.type === "skill" && la.action.skillId === ui.selectedSkillId && la.targetUid) tgt.validHit.set(la.targetUid, la.hitChance ?? 100);
    }
    const side = skill.target === "enemy" ? "enemy" : skill.target === "ally" ? "ally" : null;
    tgt.areaSide = side;
    if (side) {
      const sideUnits = side === "enemy" ? obs.enemies : obs.allies;
      let rows = 4; let cols = 4;
      for (const u of sideUnits.filter((x) => x.alive)) { rows = Math.max(rows, u.pos.row + 1); cols = Math.max(cols, u.pos.col + 1); }
      const region = new Set<string>();
      if (skill.targetCells?.length) for (const c of skill.targetCells) region.add(ck(c));
      else for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) region.add(`${r},${c}`);
      const area = skill.area;
      if (area?.kind === "free") {
        tgt.picked = new Set(ui.pickedCells.map(ck));
        if (ui.pickedCells.length === 0) tgt.anchorOk = region;
        else {
          for (const p of ui.pickedCells) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const r = p.row + dr, c = p.col + dc;
            if (r >= 0 && r < rows && c >= 0 && c < cols && !tgt.picked.has(`${r},${c}`)) tgt.anchorOk.add(`${r},${c}`);
          }
        }
        tgt.footprint = new Set(tgt.picked);
        if (ui.hoverCell && tgt.anchorOk.has(ck(ui.hoverCell))) tgt.footprint.add(ck(ui.hoverCell));
      } else {
        tgt.anchorOk = region;
        if (area?.kind === "all") { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tgt.footprint.add(`${r},${c}`); }
        else if (ui.hoverCell) for (const c of computeAreaCells(ui.hoverCell, area, rows, cols)) tgt.footprint.add(ck(c));
      }
      const hu = ui.hoverCell
        ? state.units.find((u) => u.alive && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col && u.side === side)
        : undefined;
      if (hu && tgt.validHit.has(hu.uid)) tgt.previewLoss = previewHpLoss(state, actor, skill, hu);
    }
    // 끼어들기 예고 (앵커 유닛 기준 — 대상 진영 필터)
    const anchorUnit = ui.hoverCell
      ? state.units.find((u) => u.alive && u.side === side && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col)
      : undefined;
    ghostNames = predictInterruptSubjects(state, actor, skill, anchorUnit?.uid).map((uid) => state.units.find((u) => u.uid === uid)?.name ?? uid);
  }

  const logHtml = state.log.slice(-40).map((e) => formatEvent(state, e)).filter(Boolean).join("<br>");
  const curUid = obs.current?.uid ?? null;
  const pTurnbar = turnBar(obs, state, ghostNames);
  const pAlly = grid("아군", obs.allies, "ally", curUid, ui.damaged, tgt);
  const pEnemy = grid("적", obs.enemies, "enemy", curUid, ui.damaged, tgt);
  const pActions = actionPanel(obs, state, ui);
  const pLog = `<div class="logpanel"><h2>전투 로그</h2><div class="loginner">${logHtml}</div></div>`;
  const header = `<header>
      <h1>🍮 Sunday Pudding Roguelike</h1>
      <div class="meta">ROUND ${obs.round} · ${obs.phase} · seed
        <input id="seed" type="number" value="${ui.seed}" /> <button id="newb">새 전투</button>
      </div>
    </header>`;

  app.innerHTML = `<svg class="arrows"></svg>${header}
    <div class="battlelayout">
      <aside class="battleleft">${pTurnbar}</aside>
      <div class="battlemain"><div class="arena">${pAlly}${pEnemy}</div>${pActions}</div>
      <aside class="battleside">${pLog}</aside>
    </div>`;

  // 와이어링
  app.querySelectorAll<HTMLButtonElement>("button.skcard[data-skill]").forEach((b) =>
    b.addEventListener("click", () => h.onSkill(b.dataset.skill!)),
  );
  app.querySelector("#skipbtn")?.addEventListener("click", () => h.onSkip());
  app.querySelector("#cancelbtn")?.addEventListener("click", () => h.onCancel());
  app.querySelectorAll<HTMLElement>("[data-cell]").forEach((el) => {
    const [row, col] = el.dataset.cell!.split(",").map(Number);
    el.addEventListener("click", () => h.onCellClick({ row, col }));
    el.addEventListener("mouseenter", () => h.onCellHover({ row, col }));
    el.addEventListener("mouseleave", () => h.onCellHover(null));
  });
  app.querySelector<HTMLButtonElement>("#newb")?.addEventListener("click", () => {
    const v = app.querySelector<HTMLInputElement>("#seed");
    h.onNewBattle(Number(v?.value ?? ui.seed));
  });

  const lp = app.querySelector<HTMLElement>(".loginner");
  if (lp) lp.scrollTop = lp.scrollHeight;

  // 화살표: 타겟팅 + 호버 칸의 "대상 진영" 유닛으로 (좌표 공유 → side 필터 필수)
  if (tgt.active && tgt.casterUid && ui.hoverCell) {
    const hu = state.units.find(
      (u) => u.alive && u.side === tgt.areaSide && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col,
    );
    if (hu) drawArrow(app, tgt.casterUid, hu.uid);
  }
}
