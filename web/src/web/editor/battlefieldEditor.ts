// 전장 그리드 에디터 (Phase E3 개편) — combat 레이어의 적 배치를 시각 4×4 그리드 + 카탈로그로.
// 아군 보드는 읽기전용(RunDef.roster, 런 시작 시 정해짐). 인게임 arena와 동형 → 디자이너=플레이어 시점.
import { esc } from "../battle/shared.ts";
import { beginPointerDrag } from "../drag.ts";
import { CHARACTERS } from "../../data/characters.ts";
import type { RosterEntry } from "./editorRender.ts";

const nameOf = (id: string) => CHARACTERS[id]?.name ?? id;
const at = (list: RosterEntry[], r: number, c: number) => list.findIndex((e) => e.pos.row === r && e.pos.col === c);

function board(list: RosterEntry[], side: "ally" | "enemy"): string {
  let cells = "";
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const i = at(list, r, c);
    const inner = i >= 0
      ? `<div class="bf-unit ${side}" data-ri="${i}"><span class="bf-nm">${esc(nameOf(list[i].charId))}</span>${side === "enemy" ? `<button class="bf-x" data-rmi="${i}" aria-label="제거">✕</button>` : ""}</div>`
      : `<span class="empty">·</span>`;
    cells += `<div class="bf-cell"${side === "enemy" ? ` data-er="${r}" data-ec="${c}"` : ""}>${inner}</div>`;
  }
  return `<div class="bf-side ${side}"><h4>${side === "ally" ? "아군 (읽기전용)" : "적 (드래그 배치)"}</h4><div class="bf-board">${cells}</div></div>`;
}

export function battlefieldHtml(roster: RosterEntry[], allies: RosterEntry[]): string {
  const catalog = Object.values(CHARACTERS).map((ch) => `<div class="bf-cat" data-char="${ch.id}">${esc(ch.name)}</div>`).join("");
  return `<div class="bf">
    ${board(allies, "ally")}
    ${board(roster, "enemy")}
    <div class="bf-catalog"><div class="hint">적 카탈로그 — 칸으로 드래그</div>${catalog}</div>
  </div>`;
}

/** 와이어 — 카탈로그→칸 배치, 배치 적 이동(드래그)/제거(✕). set으로 새 roster 통지. */
export function wireBattlefield(app: HTMLElement, roster: RosterEntry[], set: (next: RosterEntry[]) => void): void {
  const cellOf = (t: Element | null) => { const el = t?.closest<HTMLElement>(".bf-cell[data-er]"); return el ? { row: Number(el.dataset.er), col: Number(el.dataset.ec) } : null; };
  const place = (charId: string, row: number, col: number) => {
    const next = roster.filter((e) => !(e.pos.row === row && e.pos.col === col)); // 점유 칸 교체
    next.push({ charId, pos: { row, col } });
    set(next);
  };
  const moveTo = (ri: number, row: number, col: number) => {
    const next = roster.map((e) => ({ ...e, pos: { ...e.pos } }));
    const occ = next.findIndex((e, j) => j !== ri && e.pos.row === row && e.pos.col === col);
    if (occ >= 0) next[occ].pos = { ...next[ri].pos }; // 스왑
    next[ri].pos = { row, col };
    set(next);
  };
  // 카탈로그 칩 → 배치
  app.querySelectorAll<HTMLElement>(".bf-cat[data-char]").forEach((el) =>
    el.addEventListener("pointerdown", (e) => beginPointerDrag(el, e, { payload: el.dataset.char!, avatar: `<span class="bf-nm">${esc(nameOf(el.dataset.char!))}</span>`, onDrop: (charId, t) => { const cell = cellOf(t); if (cell) place(charId, cell.row, cell.col); } })));
  // 배치된 적 → 이동(드래그)
  app.querySelectorAll<HTMLElement>(".bf-side.enemy .bf-unit[data-ri]").forEach((el) =>
    el.addEventListener("pointerdown", (e) => { if ((e.target as HTMLElement).closest(".bf-x")) return; beginPointerDrag(el, e, { payload: el.dataset.ri!, avatar: `<span class="bf-nm">${esc(nameOf(roster[Number(el.dataset.ri)]?.charId ?? ""))}</span>`, onDrop: (ri, t) => { const cell = cellOf(t); if (cell) moveTo(Number(ri), cell.row, cell.col); } }); }));
  // ✕ 제거
  app.querySelectorAll<HTMLElement>(".bf-x[data-rmi]").forEach((b) => b.addEventListener("click", () => set(roster.filter((_, j) => j !== Number(b.dataset.rmi)))));
}
