// 적 구성 미니 에디터(공용 위젯) — 노드 메타(nodePanel)·combat 레이어(nodeEditView) 공유.
// 화면에 한 번에 하나만 존재(사이드바 ↔ 노드 에디터는 상호 배타) → 고정 id 안전.
import { esc } from "../battle/shared.ts";
import type { RosterEntry } from "./editorRender.ts";

export function rosterWidget(roster: RosterEntry[], chars: { id: string; name: string }[]): string {
  const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id;
  const rows = roster.length
    ? roster.map((e, i) => `<li><span>${esc(nameOf(e.charId))} <span class="dim">(${e.pos.row},${e.pos.col})</span></span><button class="ed-meta-x" data-rwrm="${i}" aria-label="제거">✕</button></li>`).join("")
    : `<li class="dim">비움 — 프리셋/타입 기본 적 사용</li>`;
  const charOpts = chars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const cellOpts = Array.from({ length: 4 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
  return `<ul class="ed-roster">${rows}</ul>
    <div class="ed-meta-add">
      <select id="rw-char">${charOpts}</select>
      <select id="rw-row" aria-label="행">${cellOpts}</select>
      <select id="rw-col" aria-label="열">${cellOpts}</select>
      <button id="rw-add" class="ed-btn ghost">＋ 적</button></div>`;
}

/** 제거/추가 와이어링 — 현재 roster + 변경 콜백. (제거=인덱스 필터, 추가=선택 charId/행/열 push) */
export function wireRoster(app: HTMLElement, roster: RosterEntry[], set: (next: RosterEntry[]) => void): void {
  app.querySelectorAll<HTMLElement>("[data-rwrm]").forEach((b) =>
    b.addEventListener("click", () => set(roster.filter((_, j) => j !== Number(b.dataset.rwrm)))));
  app.querySelector("#rw-add")?.addEventListener("click", () => {
    const charId = app.querySelector<HTMLSelectElement>("#rw-char")!.value;
    const row = Number(app.querySelector<HTMLSelectElement>("#rw-row")!.value);
    const col = Number(app.querySelector<HTMLSelectElement>("#rw-col")!.value);
    set([...roster, { charId, pos: { row, col } }]);
  });
}
