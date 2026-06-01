// 파티 편성 (통합 파티뷰, 모달 오버레이) — 좌: 4×4 진형 보드(드래그앤드롭 배치), 우: 선택 캐릭터 상세.
// 진형 보너스(6.1)는 열 총량을 그 열 인원으로 분배 → 보드에서 멤버별 현재 분배값 힌트로 표시.
import { STANDARD_FORMATION } from "../data/formations.ts";
import { sheetBody, wireSheet, type SheetData, type SheetHandlers } from "./charSheet.ts";
import { avatarHtml, esc } from "./battle/shared.ts";

export interface PartyBoardMember {
  charId: string;
  name: string;
  avatar?: string;
  pos: { row: number; col: number };
  hp: number;
  hpMax: number;
  alive: boolean;
}
export interface PartyViewData {
  members: PartyBoardMember[];
  selected: SheetData; // 우측 상세(현재 선택 캐릭)
}
export interface PartyViewHandlers extends SheetHandlers {
  onMove: (charId: string, to: { row: number; col: number }) => void;
  onSelect: (charId: string) => void;
}

const COLS = 4, ROWS = 4;

/** 열 c의 진형 보너스 — {kind, total, perMember}. 총량/그 열 살아있는 인원. */
function colBonus(members: PartyBoardMember[], c: number): { icon: string; per: number } | null {
  const col = STANDARD_FORMATION.columns[c];
  if (!col) return null;
  const kind = col.attackPower ? "attackPower" : col.defensePower ? "defensePower" : null;
  if (!kind) return null;
  const total = col[kind]!;
  const count = members.filter((m) => m.alive && m.pos.col === c).length;
  const per = count > 0 ? Math.round(total / count) : total;
  return { icon: kind === "attackPower" ? "⚔" : "🛡", per };
}

function boardHtml(members: PartyBoardMember[], selChar: string): string {
  const colLabels = Array.from({ length: COLS }, (_, c) => {
    const b = colBonus(members, c);
    return `<div class="pv-collabel">${b ? `${b.icon}` : ""}</div>`;
  }).join("");

  let cells = "";
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const m = members.find((x) => x.pos.row === row && x.pos.col === col);
      let inner = `<span class="pv-empty">·</span>`;
      if (m) {
        const pct = Math.max(0, (m.hp / m.hpMax) * 100);
        const b = colBonus(members, col);
        const bonus = b ? `<span class="pv-bonus">${b.icon}+${b.per}</span>` : "";
        inner = `<div class="pv-mem${m.charId === selChar ? " sel" : ""}${m.alive ? "" : " dead"}" draggable="true" data-char="${m.charId}">
          ${avatarHtml(m.avatar, "avt sm")}<span class="pv-nm">${esc(m.name)}</span>${bonus}
          <div class="pv-hp"><div class="pv-hpf" style="width:${pct}%"></div></div>
        </div>`;
      }
      cells += `<div class="pv-cell" data-row="${row}" data-col="${col}">${inner}</div>`;
    }
  }
  return `<div class="pv-board"><div class="pv-cols">${colLabels}</div><div class="pv-cells">${cells}</div>
    <div class="pv-hint">앞 2열 = ⚔ 공격 · 뒤 2열 = 🛡 방어 (열 총량을 인원이 나눠 가짐). 드래그해 배치.</div></div>`;
}

export function renderPartyView(app: HTMLElement, d: PartyViewData, h: PartyViewHandlers): void {
  app.querySelector(".charsheet-overlay")?.remove(); // 단독 시트와 같은 자리(중복 방지)
  app.querySelector(".party-overlay")?.remove();
  const ov = document.createElement("div");
  ov.className = "party-overlay";
  ov.innerHTML = `<div class="party-modal" role="dialog">
    <button class="cs-close" title="닫기 (Esc)">✕</button>
    <h3 class="pv-title">파티 편성</h3>
    <div class="party-grid">
      ${boardHtml(d.members, d.selected.charId)}
      <div class="pv-detail">${sheetBody(d.selected)}</div>
    </div>
  </div>`;
  app.appendChild(ov);

  ov.addEventListener("click", (e) => { if (e.target === ov) h.onClose(); }); // 백드롭
  ov.querySelector(".cs-close")!.addEventListener("click", () => h.onClose());

  // 보드: 드래그앤드롭 배치 + 클릭 선택
  ov.querySelectorAll<HTMLElement>(".pv-mem[data-char]").forEach((el) => {
    el.addEventListener("dragstart", (e) => { (e as DragEvent).dataTransfer?.setData("text/plain", el.dataset.char!); });
    el.addEventListener("click", () => h.onSelect(el.dataset.char!));
  });
  ov.querySelectorAll<HTMLElement>(".pv-cell").forEach((cell) => {
    cell.addEventListener("dragover", (e) => { e.preventDefault(); cell.classList.add("over"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("over"));
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      cell.classList.remove("over");
      const charId = (e as DragEvent).dataTransfer?.getData("text/plain");
      if (charId) h.onMove(charId, { row: Number(cell.dataset.row), col: Number(cell.dataset.col) });
    });
  });

  // 우측 상세: charSheet 와이어링 재사용 (맵이라 editable)
  wireSheet(ov.querySelector(".pv-detail")!, d.selected, h);
}
