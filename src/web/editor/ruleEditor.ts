// 트리거 룰 에디터 (Phase E4) — 노드 rules[]를 when/if/then으로 조립. 특성/패시브와 같은 언어.
import { esc } from "../battle/shared.ts";
import { describeRule } from "../battle/passiveDesc.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { CHARACTERS } from "../../data/characters.ts";
import type { NodeEditData, EditorHandlers } from "./editorRender.ts";
import type { FieldSpec } from "./layerSchema.ts";
import { WHEN_SPECS, WHEN_KINDS, COND_SPECS, COND_KINDS, EFFECT_SPECS, EFFECT_KINDS, whenKindOf, condKindOf, effectKindOf } from "./ruleSchema.ts";

const STATUS_OPTS = Object.entries(STATUS_DEFS).map(([id, def]) => ({ value: id, label: def.name ?? id }));
const opts = (f: FieldSpec) => f.optionsFrom === "statuses" ? STATUS_OPTS : (f.options ?? []).map((o) => ({ value: o, label: o }));

/** FieldSpec 하나를 입력 컨트롤로(데이터 속성 attrs 주입). 룰 파트(when/cond/effect) 공통. */
function ctrl(f: FieldSpec, cur: unknown, attrs: string): string {
  if (f.type === "bool") return `<input type="checkbox" ${attrs}${cur ? " checked" : ""}>`;
  if (f.type === "select") return `<select ${attrs}>${opts(f).map((o) => `<option value="${o.value}"${cur === o.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  if (f.type === "number") return `<input type="number" ${attrs} value="${cur ?? 0}">`;
  return `<input type="text" ${attrs} value="${esc(String(cur ?? ""))}">`;
}
const specForm = (fields: FieldSpec[], obj: Record<string, unknown>, attrFor: (k: string) => string) =>
  fields.map((f) => `<label class="re-f">${esc(f.label)} ${ctrl(f, obj[f.key], attrFor(f.key))}</label>`).join("");

export function ruleEditorHtml(d: NodeEditData): string {
  const list = d.rules.map((r, i) => `<li class="ne-layer${i === d.selRule ? " sel" : ""}" data-rule="${i}">
      <span class="ne-li-name">${esc(describeRule(r))}</span>
      <span class="ne-li-acts"><button data-rrm="${i}" class="ne-x" aria-label="삭제">✕</button></span></li>`).join("") || `<li class="hint">룰 없음 — 전투 중 대사·개입을 추가하세요.</li>`;
  const r = d.selRule !== null ? d.rules[d.selRule] : null;
  let edit = `<div class="hint">왼쪽에서 룰을 선택하세요.</div>`;
  if (r) {
    const nameOf = (id: string) => CHARACTERS[id]?.name ?? id;
    const ownerVal = r.owner ? `${r.owner.side}:${r.owner.charId}` : "";
    const uniq = (a: string[]) => [...new Set(a)];
    const ownerOpts = uniq(d.combatRoster.map((e) => e.charId)).map((id) => `<option value="enemy:${id}"${ownerVal === `enemy:${id}` ? " selected" : ""}>적 ${esc(nameOf(id))}</option>`).join("")
      + uniq(d.allies.map((e) => e.charId)).map((id) => `<option value="ally:${id}"${ownerVal === `ally:${id}` ? " selected" : ""}>아군 ${esc(nameOf(id))}</option>`).join("");
    const ownerSel = `<div class="re-sec"><b>화자/기준</b> <select id="re-owner"><option value=""${ownerVal ? "" : " selected"}>앰비언트(첫 적)</option>${ownerOpts}</select> <span class="hint">self = 이 개체</span></div>`;
    const wkind = whenKindOf(r.when);
    const whenSel = `<select id="re-when">${WHEN_KINDS.map((k) => `<option value="${k}"${k === wkind ? " selected" : ""}>${esc(WHEN_SPECS[k].label)}</option>`).join("")}</select>`;
    const whenFields = specForm(WHEN_SPECS[wkind]?.fields ?? [], r.when as unknown as Record<string, unknown>, (k) => `data-whenf="${k}"`);
    const conds = (r.if ?? []).map((c, ci) => `<li class="re-row"><span class="re-kind">${esc(COND_SPECS[condKindOf(c)]?.label ?? condKindOf(c))}</span>${specForm(COND_SPECS[condKindOf(c)]?.fields ?? [], c as unknown as Record<string, unknown>, (k) => `data-cf="${ci}" data-key="${k}"`)}<button class="ne-x" data-crm="${ci}">✕</button></li>`).join("");
    const effs = r.then.map((e, ei) => `<li class="re-row"><span class="re-kind">${esc(EFFECT_SPECS[effectKindOf(e)]?.label ?? effectKindOf(e))}</span>${specForm(EFFECT_SPECS[effectKindOf(e)]?.fields ?? [], e as unknown as Record<string, unknown>, (k) => `data-ef="${ei}" data-key="${k}"`)}<button class="ne-x" data-erm="${ei}">✕</button></li>`).join("");
    edit = `<div class="re-edit">
      ${ownerSel}
      <div class="re-sec"><b>WHEN</b> ${whenSel} ${whenFields}</div>
      <div class="re-sec"><b>IF</b> (모두 참) <ul class="re-list">${conds}</ul>
        <select id="re-addcond">${COND_KINDS.map((k) => `<option value="${k}">${esc(COND_SPECS[k].label)}</option>`).join("")}</select><button class="ed-btn ghost" id="re-addcond-b">＋ 조건</button></div>
      <div class="re-sec"><b>THEN</b> <ul class="re-list">${effs}</ul>
        <select id="re-addeff">${EFFECT_KINDS.map((k) => `<option value="${k}">${esc(EFFECT_SPECS[k].label)}</option>`).join("")}</select><button class="ed-btn ghost" id="re-addeff-b">＋ 효과</button></div>
    </div>`;
  }
  return `<div class="ne-slot ne-rules"><h3>트리거 룰 <span class="hint">전투 중 when/if/then (대사·개입)</span></h3>
    <ul class="ne-layers">${list}</ul>
    <button class="ed-btn" id="re-addrule">＋ 룰 추가</button>
    ${edit}</div>`;
}

const val = (el: HTMLInputElement | HTMLSelectElement) => el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el instanceof HTMLInputElement && el.type === "number" ? Number(el.value) : el.value;

export function wireRuleEditor(app: HTMLElement, h: EditorHandlers): void {
  app.querySelector("#re-addrule")?.addEventListener("click", () => h.onAddRule());
  app.querySelectorAll<HTMLElement>(".ne-layer[data-rule]").forEach((el) => el.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("button")) return; h.onSelectRule(Number(el.dataset.rule)); }));
  app.querySelectorAll<HTMLElement>("[data-rrm]").forEach((b) => b.addEventListener("click", () => h.onRemoveRule(Number(b.dataset.rrm))));
  app.querySelector<HTMLSelectElement>("#re-owner")?.addEventListener("change", (e) => { const v = (e.target as HTMLSelectElement).value; if (!v) { h.onSetRuleOwner(null); return; } const [side, charId] = v.split(":"); h.onSetRuleOwner({ side: side as "ally" | "enemy", charId }); });
  app.querySelector<HTMLSelectElement>("#re-when")?.addEventListener("change", (e) => h.onSetWhen((e.target as HTMLSelectElement).value));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-whenf]").forEach((el) => el.addEventListener("change", () => h.onSetWhenField(el.dataset.whenf!, val(el))));
  app.querySelector("#re-addcond-b")?.addEventListener("click", () => h.onAddCond(app.querySelector<HTMLSelectElement>("#re-addcond")!.value));
  app.querySelectorAll<HTMLElement>("[data-crm]").forEach((b) => b.addEventListener("click", () => h.onRemoveCond(Number(b.dataset.crm))));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-cf]").forEach((el) => el.addEventListener("change", () => h.onSetCondField(Number(el.dataset.cf), el.dataset.key!, val(el))));
  app.querySelector("#re-addeff-b")?.addEventListener("click", () => h.onAddEffect(app.querySelector<HTMLSelectElement>("#re-addeff")!.value));
  app.querySelectorAll<HTMLElement>("[data-erm]").forEach((b) => b.addEventListener("click", () => h.onRemoveEffect(Number(b.dataset.erm))));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-ef]").forEach((el) => el.addEventListener("change", () => h.onSetEffectField(Number(el.dataset.ef), el.dataset.key!, val(el))));
}
