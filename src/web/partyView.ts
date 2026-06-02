// 파티 편성 (통합 파티뷰, 모달) — 좌: 진형 보드(드래그 배치 + 카드 3 장착칸) / 우: 캐릭터 상세 / 하: 장착 인벤토리.
// 장착 = 드래그앤드롭(인벤토리/슬롯 ↔ 캐릭터/슬롯) 주, 클릭 폴백. 엔진(equipItem/unequipItem/inventory) 재사용.
import type { Equipped, EquipSlot } from "../core/types.ts";
import { ITEMS } from "../data/items.ts";
import { STANDARD_FORMATION } from "../data/formations.ts";
import { sheetBody, wireSheet, itemDesc, type SheetData, type SheetHandlers } from "./charSheet.ts";
import { avatarHtml, esc } from "./battle/shared.ts";

export interface PartyBoardMember {
  charId: string;
  name: string;
  avatar?: string;
  pos: { row: number; col: number };
  hp: number;
  hpMax: number;
  alive: boolean;
  equipped: Equipped;
}
export interface PartyViewData {
  members: PartyBoardMember[];
  selected: SheetData;
  inventory: string[];
}
export interface PartyViewHandlers extends SheetHandlers {
  onMove: (charId: string, to: { row: number; col: number }) => void;
  onSelect: (charId: string) => void;
}

const COLS = 4, ROWS = 4;
const SLOT_KEYS: EquipSlot[] = ["weapon", "armor", "held"];
const SLOT_LABEL: Record<EquipSlot, string> = { weapon: "무기", armor: "방어구", held: "지닌물건" };

function colBonus(members: PartyBoardMember[], c: number): { icon: string; per: number } | null {
  const col = STANDARD_FORMATION.columns[c];
  if (!col) return null;
  const kind = col.attackPower ? "attackPower" : col.defensePower ? "defensePower" : null;
  if (!kind) return null;
  const count = members.filter((m) => m.alive && m.pos.col === c).length;
  return { icon: kind === "attackPower" ? "⚔" : "🛡", per: count > 0 ? Math.round(col[kind]! / count) : col[kind]! };
}

// 보드 카드의 미니 장착칸 (drop 타깃 + 채워졌으면 draggable). 지닌물건=잠금.
function miniSlot(m: PartyBoardMember, slot: EquipSlot): string {
  const locked = slot === "held";
  const id = m.equipped[slot];
  const it = id ? ITEMS[id] : undefined;
  const inner = locked ? "🔒" : it ? (it.icon ?? "📦") : "·";
  const drag = it && !locked ? ` draggable="true" data-item="${id}"` : "";
  return `<div class="pv-slot${it ? " filled" : ""}${locked ? " locked" : ""}" data-char="${m.charId}" data-slot="${slot}"${drag} aria-label="${SLOT_LABEL[slot]}${it ? `: ${esc(it.name)}` : ""}">${inner}</div>`;
}

function boardHtml(members: PartyBoardMember[], selChar: string): string {
  const colLabels = Array.from({ length: COLS }, (_, c) => `<div class="pv-collabel">${colBonus(members, c)?.icon ?? ""}</div>`).join("");
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
          <div class="pv-slots">${SLOT_KEYS.map((s) => miniSlot(m, s)).join("")}</div>
        </div>`;
      }
      cells += `<div class="pv-cell" data-row="${row}" data-col="${col}">${inner}</div>`;
    }
  }
  return `<div class="pv-board"><div class="pv-cols">${colLabels}</div><div class="pv-cells">${cells}</div>
    <div class="pv-hint">앞 2열=⚔공격 · 뒤 2열=🛡방어. 캐릭터 드래그=배치. 아이템 드래그=장착/해제.</div></div>`;
}

function invPanel(inventory: string[]): string {
  const items = inventory
    .map((id) => { const it = ITEMS[id]; return it ? `<div class="pv-inv-item" draggable="true" data-item="${id}">${it.icon ?? "📦"} <span>${esc(it.name)}</span></div>` : ""; })
    .join("");
  return `<div class="pv-inv">
    <div class="pv-inv-head">🎒 인벤토리<span class="cshint">드래그=장착/해제 · 클릭=선택 캐릭 장착</span></div>
    <div class="pv-inv-items">${items || "<div class='cshint'>비어 있음 — 상점·보상에서 획득</div>"}</div>
    <div class="pv-inv-detail" id="invDetail"><span class="cshint">아이템에 호버하면 상세</span></div>
  </div>`;
}

function detailHtml(itemId: string): string {
  const it = ITEMS[itemId];
  if (!it) return "";
  return `<div class="pv-det-head">${it.icon ?? "📦"} <b>${esc(it.name)}</b><span class="cshint">${SLOT_LABEL[it.slot]}</span></div><div class="pv-det-desc">${esc(itemDesc(it)) || "<span class='cshint'>보정 없음</span>"}</div>`;
}

// payload 파싱: char:<id> | item:<id>:inv | item:<id>:slot:<char>:<slot>
function parse(s: string): { kind: "char"; charId: string } | { kind: "item"; itemId: string; from?: { charId: string; slot: EquipSlot } } | null {
  if (s.startsWith("char:")) return { kind: "char", charId: s.slice(5) };
  if (s.startsWith("item:")) {
    const r = s.slice(5).split(":");
    return { kind: "item", itemId: r[0], from: r[1] === "slot" ? { charId: r[2], slot: r[3] as EquipSlot } : undefined };
  }
  return null;
}

export function renderPartyView(app: HTMLElement, d: PartyViewData, h: PartyViewHandlers): void {
  app.querySelector(".charsheet-overlay")?.remove();
  app.querySelector(".party-overlay")?.remove();
  const ov = document.createElement("div");
  ov.className = "party-overlay";
  ov.innerHTML = `<div class="party-modal" role="dialog">
    <button class="cs-close" aria-label="닫기 (Esc)">✕</button>
    <h3 class="pv-title">파티 편성</h3>
    <div class="party-grid">${boardHtml(d.members, d.selected.charId)}<div class="pv-detail">${sheetBody(d.selected)}</div>${invPanel(d.inventory)}</div>
  </div>`;
  app.appendChild(ov);

  ov.addEventListener("click", (e) => { if (e.target === ov) h.onClose(); });
  ov.querySelector(".cs-close")!.addEventListener("click", () => h.onClose());

  const setDrag = (el: HTMLElement, payload: string) =>
    el.addEventListener("dragstart", (e) => { (e as DragEvent).dataTransfer?.setData("text/plain", payload); });
  const detail = ov.querySelector<HTMLElement>("#invDetail")!;
  const showDetail = (itemId: string) => { detail.innerHTML = detailHtml(itemId); };

  // 캐릭터 카드: 드래그=이동, 클릭=선택
  ov.querySelectorAll<HTMLElement>(".pv-mem[data-char]").forEach((el) => {
    setDrag(el, `char:${el.dataset.char}`);
    el.addEventListener("click", () => h.onSelect(el.dataset.char!));
  });
  // 보드 칸: char→이동 / item→그 칸 멤버 장착
  ov.querySelectorAll<HTMLElement>(".pv-cell").forEach((cell) => {
    cell.addEventListener("dragover", (e) => { e.preventDefault(); cell.classList.add("over"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("over"));
    cell.addEventListener("drop", (e) => {
      e.preventDefault(); cell.classList.remove("over");
      const p = parse((e as DragEvent).dataTransfer?.getData("text/plain") ?? "");
      if (!p) return;
      const to = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
      if (p.kind === "char") { h.onMove(p.charId, to); return; }
      const mem = d.members.find((m) => m.pos.row === to.row && m.pos.col === to.col);
      if (mem) h.onEquipItem(mem.charId, p.itemId, p.from);
    });
  });
  // 미니 슬롯: 채워졌으면 드래그(아이템) + drop 타깃(장착). 카드/칸 이벤트와 분리(stopPropagation)
  ov.querySelectorAll<HTMLElement>(".pv-slot").forEach((slot) => {
    if (slot.dataset.item) {
      slot.addEventListener("dragstart", (e) => { e.stopPropagation(); (e as DragEvent).dataTransfer?.setData("text/plain", `item:${slot.dataset.item}:slot:${slot.dataset.char}:${slot.dataset.slot}`); });
      slot.addEventListener("mouseenter", () => showDetail(slot.dataset.item!));
    }
    slot.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); slot.classList.add("over"); });
    slot.addEventListener("dragleave", () => slot.classList.remove("over"));
    slot.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation(); slot.classList.remove("over");
      const p = parse((e as DragEvent).dataTransfer?.getData("text/plain") ?? "");
      if (p?.kind === "item") h.onEquipItem(slot.dataset.char!, p.itemId, p.from);
    });
  });
  // 인벤토리 아이템: 드래그(장착) / 호버(상세) / 클릭(선택 캐릭 장착 폴백)
  ov.querySelectorAll<HTMLElement>(".pv-inv-item[data-item]").forEach((el) => {
    setDrag(el, `item:${el.dataset.item}:inv`);
    el.addEventListener("mouseenter", () => showDetail(el.dataset.item!));
    el.addEventListener("click", () => h.onEquipItem(d.selected.charId, el.dataset.item!));
  });
  // 인벤토리 패널 = drop 타깃 → 장착 해제(슬롯 출처 아이템)
  const inv = ov.querySelector<HTMLElement>(".pv-inv")!;
  inv.addEventListener("dragover", (e) => { e.preventDefault(); inv.classList.add("over"); });
  inv.addEventListener("dragleave", () => inv.classList.remove("over"));
  inv.addEventListener("drop", (e) => {
    e.preventDefault(); inv.classList.remove("over");
    const p = parse((e as DragEvent).dataTransfer?.getData("text/plain") ?? "");
    if (p?.kind === "item" && p.from) h.onUnequip(p.from.charId, p.from.slot);
  });

  // 우측 상세: charSheet 기본 와이어(스킬 토글·해제 버튼·자세히) + 시트 장착칸 DnD
  wireSheet(ov.querySelector(".pv-detail")!, d.selected, h);
  ov.querySelectorAll<HTMLElement>(".pv-detail .csslot").forEach((slot) => {
    const key = slot.dataset.slot as EquipSlot | undefined;
    if (!key) return;
    const eq = slot.querySelector<HTMLElement>(".csslot-item[data-item]");
    if (eq?.dataset.item) {
      eq.setAttribute("draggable", "true");
      eq.addEventListener("dragstart", (e) => { (e as DragEvent).dataTransfer?.setData("text/plain", `item:${eq.dataset.item}:slot:${d.selected.charId}:${key}`); });
      eq.addEventListener("mouseenter", () => showDetail(eq.dataset.item!));
    }
    slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("over"); });
    slot.addEventListener("dragleave", () => slot.classList.remove("over"));
    slot.addEventListener("drop", (e) => {
      e.preventDefault(); slot.classList.remove("over");
      const p = parse((e as DragEvent).dataTransfer?.getData("text/plain") ?? "");
      if (p?.kind === "item") h.onEquipItem(d.selected.charId, p.itemId, p.from);
    });
  });
}
