// 전투 렌더 — 영속 셸(svg·header·battlelayout)을 1회 만들고, 매 step **배틀 존만** 갱신.
// .battleleft(행동서열 패널)는 TimelinePanel이 소유 → 통짜 재렌더에서 분리(주사위↔타임라인 연속성).
import type { GameState, Observation } from "../core/types.ts";
import { buildObservation } from "../core/observation.ts";
import { previewHpLoss, predictInterruptSubjects, computeAreaCells, reachableColumns } from "../core/engine.ts";
import { SKILLS } from "../data/skills.ts";
import { ck, type Handlers, type TgtCtx, type Ui } from "./battle/shared.ts";
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
  app.innerHTML = `<svg class="arrows"></svg>
    <header><h1>🍮 Sunday Pudding Roguelike</h1>
      <div class="meta"><span id="roundmeta"></span> seed <input id="seed" type="number" value="${ui.seed}" /> <button id="newb">새 전투</button></div>
    </header>
    <div class="battlelayout"><aside class="battleleft"></aside><div class="battlemain"></div><aside class="battleside"></aside></div>`;
  app.querySelector(".battleleft")!.appendChild(panel.root);
  app.querySelector<HTMLButtonElement>("#newb")!.addEventListener("click", () => {
    const v = app.querySelector<HTMLInputElement>("#seed");
    h.onNewBattle(Number(v?.value ?? ui.seed));
  });
}

// ── 전투 렌더 (존 갱신) ──
export function renderApp(app: HTMLElement, state: GameState, ui: Ui, h: Handlers, panel: TimelinePanel): void {
  ensureShell(app, ui, h, panel);
  const obs = buildObservation(state);

  // 타겟팅 컨텍스트 (셀 기반) — 로직 불변
  const tgt: TgtCtx = {
    active: false, validHit: new Map(), previewLoss: new Map(), casterUid: obs.current?.uid ?? null,
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
      if (skill.reach !== undefined) {
        // 동적 근접: 전방 reach 열의 **적 점유 칸만** 타겟 가능(빈 땅 제외, 코어 validTargets와 동일)
        const cols2 = new Set(reachableColumns(state, side, skill.reach));
        for (const u of sideUnits) if (u.alive && cols2.has(u.pos.col)) region.add(ck(u.pos));
      } else if (skill.targetCells?.length) for (const c of skill.targetCells) region.add(ck(c));
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
      // 영향 칸(footprint) 안의 대상 진영 유닛 전부에 HP 미리보기 (AoE면 일괄, 0.2)
      for (const key of tgt.footprint) {
        const [r, c] = key.split(",").map(Number);
        const tu = state.units.find((u) => u.alive && u.side === side && u.pos.row === r && u.pos.col === c);
        if (tu) tgt.previewLoss.set(tu.uid, previewHpLoss(state, actor, skill, tu));
      }
    }
    const anchorUnit = ui.hoverCell
      ? state.units.find((u) => u.alive && u.side === side && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col)
      : undefined;
    ghostNames = predictInterruptSubjects(state, actor, skill, anchorUnit?.uid).map((uid) => state.units.find((u) => u.uid === uid)?.name ?? uid);
  }

  const curUid = obs.current?.uid ?? null;
  // 헤더 텍스트 (입력/버튼은 셸에 1회 와이어링됨)
  const meta = app.querySelector("#roundmeta");
  if (meta) meta.textContent = `ROUND ${obs.round} · ${obs.phase} ·`;

  // 배틀 존: 전장 + 행동
  const mainEl = app.querySelector<HTMLElement>(".battlemain")!;
  mainEl.innerHTML = `<div class="arena">${grid("아군", obs.allies, "ally", curUid, ui.damaged, ui.moved, tgt)}${grid("적", obs.enemies, "enemy", curUid, ui.damaged, ui.moved, tgt)}</div>${actionPanel(obs, state, ui)}`;

  // 로그 존
  const logHtml = state.log.slice(-40).map((e) => formatEvent(state, e)).filter(Boolean).join("<br>");
  const sideEl = app.querySelector<HTMLElement>(".battleside")!;
  sideEl.innerHTML = `<div class="logpanel"><h2>전투 로그</h2><div class="loginner">${logHtml}</div></div>`;

  // 행동서열 패널 (live — 굴림 중이면 패널이 보류)
  panel.update(obs, state, ghostNames);

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
    const hu = state.units.find(
      (u) => u.alive && u.side === tgt.areaSide && u.pos.row === ui.hoverCell!.row && u.pos.col === ui.hoverCell!.col,
    );
    // 유닛이 있으면 그 카드로, 빈 칸이면 호버 중인 앵커 칸으로 (빈 칸 타겟팅도 화살표 표시)
    const targetEl = hu
      ? app.querySelector<HTMLElement>(`.card[data-uid="${hu.uid}"]`)
      : app.querySelector<HTMLElement>(`.side.${tgt.areaSide} [data-cell="${ui.hoverCell.row},${ui.hoverCell.col}"]`);
    if (targetEl) drawArrow(app, tgt.casterUid, targetEl);
  }
}
