// 전용 노드 에디터 화면 (Phase E1) — 노드 core[] 레이어를 리스트(추가/삭제/순서) + 스키마 구동 폼으로 편집.
import { esc } from "../battle/shared.ts";
import type { Layer } from "../../core/types.ts";
import type { NodeEditData, EditorHandlers, RosterEntry, LayerSlot } from "./editorRender.ts";
import { LAYER_SPECS, LAYER_KINDS, DECO_KINDS, layerSummary, type FieldSpec } from "./layerSchema.ts";
import { rosterWidget, wireRoster } from "./rosterWidget.ts";
import { ruleEditorHtml, wireRuleEditor } from "./ruleEditor.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";

const CHARS = Object.values(CHARACTERS).map((c) => ({ id: c.id, name: c.name }));
const CHAR_OPTS = CHARS.map((c) => ({ value: c.id, label: c.name }));
const STATUS_OPTS = Object.entries(STATUS_DEFS).map(([id, def]) => ({ value: id, label: def.name ?? id }));
const optionList = (f: FieldSpec) => f.optionsFrom === "chars" ? CHAR_OPTS : f.optionsFrom === "statuses" ? STATUS_OPTS : (f.options ?? []).map((o) => ({ value: o, label: o }));

function fieldInput(L: Layer, idx: number): string {
  const spec = LAYER_SPECS[L.kind];
  if (!spec.fields.length) return `<div class="hint">편집 필드 없음 — 이 레이어는 즉시 동작합니다.</div>`;
  const v = L as unknown as Record<string, unknown>;
  return spec.fields.map((f) => {
    const id = `ne-f-${idx}-${f.key}`;
    const cur = v[f.key];
    if (f.type === "roster") return `<div class="ne-field-roster"><div class="ed-meta-row">${esc(f.label)}</div>${rosterWidget((cur as RosterEntry[]) ?? [], CHARS)}</div>`;
    let control: string;
    if (f.type === "bool") control = `<input type="checkbox" id="${id}" data-fkey="${f.key}"${cur ? " checked" : ""}>`;
    else if (f.type === "select") { const empty = f.allowEmpty ? `<option value=""${cur ? "" : " selected"}>(전원)</option>` : ""; control = `<select id="${id}" data-fkey="${f.key}">${empty}${optionList(f).map((o) => `<option value="${o.value}"${cur === o.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`; }
    else if (f.type === "number") control = `<input type="number" id="${id}" data-fkey="${f.key}" value="${cur ?? 0}"${f.step ? ` step="${f.step}"` : ""}>`;
    else control = `<input type="text" id="${id}" data-fkey="${f.key}" value="${esc(String(cur ?? ""))}">`;
    return `<label class="ne-field">${esc(f.label)} ${control}</label>`;
  }).join("");
}

const SLOTS: { slot: LayerSlot; title: string; hint: string; kinds: string[] }[] = [
  { slot: "onEnter", title: "진입(onEnter)", hint: "진입 직후 즉시", kinds: DECO_KINDS },
  { slot: "core", title: "코어(core)", hint: "순서 실행 — 본체", kinds: LAYER_KINDS },
  { slot: "onResolve", title: "완료(onResolve)", hint: "노드 끝날 때", kinds: DECO_KINDS },
];

function slotSection(slot: LayerSlot, title: string, hint: string, kinds: string[], layers: Layer[], sel: NodeEditData["sel"]): string {
  const items = layers.map((L, i) => `<li class="ne-layer${sel && sel.slot === slot && sel.idx === i ? " sel" : ""}" data-slot="${slot}" data-li="${i}">
      <span class="ne-li-name">${i + 1}. ${esc(layerSummary(L))}</span>
      <span class="ne-li-acts"><button data-mv="${i}" data-dir="-1" data-slot="${slot}" aria-label="위로">↑</button><button data-mv="${i}" data-dir="1" data-slot="${slot}" aria-label="아래로">↓</button><button data-rm="${i}" data-slot="${slot}" class="ne-x" aria-label="삭제">✕</button></span>
    </li>`).join("") || `<li class="hint">비어 있음</li>`;
  const addOpts = kinds.map((k) => `<option value="${k}">${esc(LAYER_SPECS[k].label)}</option>`).join("");
  return `<div class="ne-slot"><h3>${esc(title)} <span class="hint">${esc(hint)}</span></h3>
    <ul class="ne-layers">${items}</ul>
    <div class="ne-add"><select data-addslot="${slot}">${addOpts}</select><button class="ed-btn" data-addbtn="${slot}">＋ 추가</button></div></div>`;
}

export function renderNodeEditView(app: HTMLElement, d: NodeEditData, h: EditorHandlers): void {
  const arr = (s: LayerSlot) => (s === "onEnter" ? d.onEnter : s === "core" ? d.core : d.onResolve);
  const sel = d.sel ? arr(d.sel.slot)[d.sel.idx] : null;
  const form = sel ? `<h3>${esc(LAYER_SPECS[sel.kind].label)} 편집</h3>${fieldInput(sel, d.sel!.idx)}${sel.kind === "combat" ? ruleEditorHtml(d) : ""}` : `<div class="hint">왼쪽에서 레이어를 선택하세요.</div>`;
  const sections = SLOTS.map((s) => slotSection(s.slot, s.title, s.hint, s.kinds, arr(s.slot), d.sel)).join("");

  app.innerHTML = `<div class="editor node-editor">
    <header><h1>🧩 노드 내용 — <span class="dim">${esc(d.nodeName)}</span></h1>
      <button class="hub-link" id="ne-back">← 맵으로</button></header>
    <div class="ne-body">
      <section class="ne-list">${sections}</section>
      <section class="ne-form">${form}</section>
    </div>
  </div>`;

  app.querySelector("#ne-back")!.addEventListener("click", () => h.onBack());
  app.querySelectorAll<HTMLElement>("[data-addbtn]").forEach((b) => b.addEventListener("click", () => {
    const slot = b.dataset.addbtn as LayerSlot;
    h.onAddLayer(slot, app.querySelector<HTMLSelectElement>(`[data-addslot="${slot}"]`)!.value);
  }));
  app.querySelectorAll<HTMLElement>(".ne-layer[data-li]").forEach((el) => el.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) return; // 버튼은 자체 핸들러
    h.onSelectLayer(el.dataset.slot as LayerSlot, Number(el.dataset.li));
  }));
  app.querySelectorAll<HTMLElement>("[data-rm]").forEach((b) => b.addEventListener("click", () => h.onRemoveLayer(b.dataset.slot as LayerSlot, Number(b.dataset.rm))));
  app.querySelectorAll<HTMLElement>("[data-mv]").forEach((b) => b.addEventListener("click", () => h.onMoveLayer(b.dataset.slot as LayerSlot, Number(b.dataset.mv), Number(b.dataset.dir))));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>(".ne-field [data-fkey]").forEach((el) => el.addEventListener("change", () => {
    const key = el.dataset.fkey!;
    const val = el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el instanceof HTMLInputElement && el.type === "number" ? Number(el.value) : el.value;
    h.onSetLayerField(d.sel!.slot, d.sel!.idx, key, val);
  }));
  // 리치 위젯: combat roster(있으면 프리셋 무시)
  if (sel?.kind === "combat" && d.sel) wireRoster(app, ((sel as Record<string, unknown>).roster as RosterEntry[]) ?? [], (next) => h.onSetLayerField(d.sel!.slot, d.sel!.idx, "roster", next));
  wireRuleEditor(app, h); // 트리거 룰 섹션(Phase E4)
}
