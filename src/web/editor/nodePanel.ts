// 맵 에디터 — 노드 메타데이터 사이드바 패널(F2). 라벨 입력 + 적 구성 override 미니 에디터.
// editView가 사이드바 "선택" 섹션에 끼워 넣는다. 전투 노드(battle/elite/boss)만 적 구성 편집 노출.
import { esc } from "../battle/shared.ts";
import type { EditData, EditNode, EditorHandlers, RosterEntry } from "./editorRender.ts";

const COMBAT = new Set(["battle", "elite", "boss"]);
const isCombat = (n: EditNode): boolean => COMBAT.has(n.type);

/** 노드 1개 선택 시 라벨 입력 + (전투 노드면) 적 구성 편집기 HTML. */
export function nodeMetaPanel(d: EditData, n: EditNode): string {
  const label = `<label class="ed-meta-row">라벨 <input id="ednm-label" type="text" maxlength="24" placeholder="${esc(n.name)}" value="${esc(n.label ?? "")}"></label>`;
  if (!isCombat(n)) return `<div class="ed-meta">${label}</div>`;

  const roster = n.roster ?? [];
  const nameOf = (id: string) => d.chars.find((c) => c.id === id)?.name ?? id;
  const rows = roster.length
    ? roster.map((e, i) => `<li><span>${esc(nameOf(e.charId))} <span class="dim">(${e.pos.row},${e.pos.col})</span></span><button class="ed-meta-x" data-rmidx="${i}" aria-label="제거">✕</button></li>`).join("")
    : `<li class="dim">비움 — 타입 기본 적 사용</li>`;
  const charOpts = d.chars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const cellOpts = Array.from({ length: 4 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
  const adder = `<div class="ed-meta-add">
    <select id="ednm-char">${charOpts}</select>
    <select id="ednm-row" aria-label="행">${cellOpts}</select>
    <select id="ednm-col" aria-label="열">${cellOpts}</select>
    <button id="ednm-add" class="ed-btn ghost">＋ 적</button></div>`;
  return `<div class="ed-meta">${label}
    <div class="ed-meta-row">적 구성 <span class="hint">override (행,열 = 적 진형)</span></div>
    <ul class="ed-roster">${rows}</ul>${adder}</div>`;
}

/** nodeMetaPanel의 입력 와이어링. 단일 선택 노드 id = d.sel[0]. */
export function wireNodeMeta(app: HTMLElement, d: EditData, h: EditorHandlers): void {
  const id = d.sel[0];
  const n = d.sel.length === 1 ? d.nodes.find((x) => x.id === id) : null;
  if (!n) return;

  app.querySelector<HTMLInputElement>("#ednm-label")?.addEventListener("change", (e) => h.onSetNodeLabel(id, (e.target as HTMLInputElement).value));
  if (!isCombat(n)) return;

  const roster = n.roster ?? [];
  app.querySelectorAll<HTMLElement>("[data-rmidx]").forEach((b) =>
    b.addEventListener("click", () => h.onSetNodeRoster(id, roster.filter((_, j) => j !== Number(b.dataset.rmidx)))));
  app.querySelector("#ednm-add")?.addEventListener("click", () => {
    const charId = app.querySelector<HTMLSelectElement>("#ednm-char")!.value;
    const row = Number(app.querySelector<HTMLSelectElement>("#ednm-row")!.value);
    const col = Number(app.querySelector<HTMLSelectElement>("#ednm-col")!.value);
    const next: RosterEntry[] = [...roster, { charId, pos: { row, col } }];
    h.onSetNodeRoster(id, next);
  });
}
