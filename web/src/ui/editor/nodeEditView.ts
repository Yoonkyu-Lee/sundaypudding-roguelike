// 전용 노드 에디터 화면 (Phase E1) — 노드 core[] 레이어를 리스트(추가/삭제/순서) + 스키마 구동 폼으로 편집.
import { esc } from "../battle/shared.ts";
import type { Layer } from "../../contract/types.ts";
import type { NodeEditData, EditorHandlers, RosterEntry, LayerSlot } from "./editorRender.ts";
import { LAYER_SPECS, LAYER_KINDS, DECO_KINDS, layerSummary, type FieldSpec } from "./layerSchema.ts";
import { battlefieldHtml, wireBattlefield } from "./battlefieldEditor.ts";
import { ruleEditorHtml, wireRuleEditor } from "./ruleEditor.ts";
import { eventEditorHtml, wireEventEditor } from "./eventEditor.ts";
import { shopEditorHtml, wireShopEditor } from "./shopEditor.ts";
import { CHARACTERS } from "../../content/characters.ts";
import { STATUS_DEFS } from "../../content/statuses.ts";
import { NODE_ROSTERS } from "../../content/encounters.ts";

/** combat 레이어의 유효 적 구성 — 인라인 roster(노드 소유). 비면 엔진 fallback(battle)을 표시(일관성). */
const effectiveRoster = (sel: { roster?: RosterEntry[] }): RosterEntry[] =>
  sel.roster && sel.roster.length ? sel.roster : (NODE_ROSTERS.battle as RosterEntry[]);

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
    let control: string;
    if (f.type === "bool") control = `<input type="checkbox" id="${id}" data-fkey="${f.key}"${cur ? " checked" : ""}>`;
    else if (f.type === "select") { const empty = f.allowEmpty ? `<option value=""${cur ? "" : " selected"}>(전원)</option>` : ""; control = `<select id="${id}" data-fkey="${f.key}">${empty}${optionList(f).map((o) => `<option value="${o.value}"${cur === o.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`; }
    else if (f.type === "number") control = `<input type="number" id="${id}" data-fkey="${f.key}" value="${cur ?? 0}"${f.step ? ` step="${f.step}"` : ""}>`;
    else if (f.type === "csv") control = `<input type="text" id="${id}" data-fkey="${f.key}" placeholder="charId,charId" value="${esc(Array.isArray(cur) ? cur.join(",") : "")}">`;
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
  const eff = sel?.kind === "combat" ? effectiveRoster(sel as { roster?: RosterEntry[] }) : null;
  const combatExtra = sel?.kind === "combat" && eff ? `${battlefieldHtml(eff, d.allies)}${ruleEditorHtml(d)}` : "";
  const eventExtra = sel?.kind === "event" ? eventEditorHtml(d.eventLayer) : "";
  const shopExtra = sel?.kind === "shop" ? shopEditorHtml(sel as { offers?: import("../../contract/types.ts").ShopOfferDef[]; keepGenerated?: boolean }) : "";
  const form = sel ? `<h3>${esc(LAYER_SPECS[sel.kind].label)} 편집</h3>${fieldInput(sel, d.sel!.idx)}${combatExtra}${eventExtra}${shopExtra}` : `<div class="hint">왼쪽에서 레이어를 선택하세요.</div>`;
  const sections = SLOTS.map((s) => slotSection(s.slot, s.title, s.hint, s.kinds, arr(s.slot), d.sel)).join("");

  app.innerHTML = `<div class="editor node-editor">
    <header><h1>🧩 노드 내용 — <span class="dim">${esc(d.nodeName)}</span></h1>
      <div><button class="ed-btn ghost" id="ne-savetpl" title="이 노드를 템플릿으로 저장해 카탈로그에서 재사용">📋 템플릿으로 저장</button><button class="hub-link" id="ne-back">← 맵으로</button></div></header>
    <div class="ne-body">
      <section class="ne-list">${sections}</section>
      <section class="ne-form">${form}</section>
    </div>
  </div>`;

  app.querySelector("#ne-back")!.addEventListener("click", () => h.onBack());
  app.querySelector("#ne-savetpl")?.addEventListener("click", () => h.onSaveTemplate());
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
    const fspec = sel ? LAYER_SPECS[sel.kind].fields.find((f) => f.key === key) : undefined;
    const val = fspec?.type === "csv"
      ? el.value.split(",").map((s) => s.trim()).filter(Boolean)
      : el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el instanceof HTMLInputElement && el.type === "number" ? Number(el.value) : el.value;
    h.onSetLayerField(d.sel!.slot, d.sel!.idx, key, val);
  }));
  // 전장 그리드: combat 적 배치 — 유효 구성(프리셋 포함) 표시, 편집 시 인라인 roster로 구체화
  if (sel?.kind === "combat" && d.sel && eff) wireBattlefield(app, eff, (next) => h.onSetLayerField(d.sel!.slot, d.sel!.idx, "roster", next));
  wireRuleEditor(app, h); // 트리거 룰 섹션(Phase E4)
  if (sel?.kind === "event") wireEventEditor(app, h); // 인카운터 이벤트 저작(Phase D)
  if (sel?.kind === "shop") wireShopEditor(app, h); // 상점 진열 저작
}
