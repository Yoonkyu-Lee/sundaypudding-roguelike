// 룰 폼 렌더 프리미티브 — ruleEditor(런 에디터)·rulesEditor(스킬/특성) 공유. FieldSpec → 입력 컨트롤.
import { esc } from "../battle/shared.ts";
import { STATUS_DEFS } from "../../content/statuses.ts";
import type { FieldSpec } from "./layerSchema.ts";

export const STATUS_OPTS = Object.entries(STATUS_DEFS).map(([id, def]) => ({ value: id, label: def.name ?? id }));
export const opts = (f: FieldSpec) => f.optionsFrom === "statuses" ? STATUS_OPTS : (f.options ?? []).map((o) => ({ value: o, label: o }));

/** FieldSpec 하나를 입력 컨트롤로(데이터 속성 attrs 주입). when/cond/effect 공통. */
export function ctrl(f: FieldSpec, cur: unknown, attrs: string): string {
  if (f.type === "bool") return `<input type="checkbox" ${attrs}${cur ? " checked" : ""}>`;
  if (f.type === "select") return `<select ${attrs}>${opts(f).map((o) => `<option value="${o.value}"${cur === o.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  if (f.type === "number") return `<input type="number" ${attrs} value="${cur ?? 0}">`;
  return `<input type="text" ${attrs} value="${esc(String(cur ?? ""))}">`;
}

export const specForm = (fields: FieldSpec[], obj: Record<string, unknown>, attrFor: (k: string) => string) =>
  fields.map((f) => `<label class="re-f">${esc(f.label)} ${ctrl(f, obj[f.key], attrFor(f.key))}</label>`).join("");

/** 입력 엘리먼트의 현재값(체크박스=불리언, number=숫자, 그외=문자열). */
export const fieldVal = (el: HTMLInputElement | HTMLSelectElement): boolean | number | string =>
  el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el instanceof HTMLInputElement && el.type === "number" ? Number(el.value) : el.value;
