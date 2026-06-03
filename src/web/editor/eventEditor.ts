// 인카운터 이벤트 에디터 (Phase D 슬라이스2) — event 레이어의 인라인 event(title/text/choices) 저작.
// 선택지 = 라벨 + 결과(outcome). 도박(gamble)은 후속(현재 JSON). 스키마 구동.
import { esc } from "../battle/shared.ts";
import type { EncounterEvent } from "../../core/types.ts";
import type { EditorHandlers } from "./editorRender.ts";

export interface OutcomeField { key: string; label: string; step?: number; }
export const OUTCOME_SPECS: Record<string, { label: string; fields: OutcomeField[] }> = {
  nothing: { label: "없음", fields: [] },
  heal: { label: "회복", fields: [{ key: "pct", label: "비율(0~1)", step: 0.1 }] },
  hurt: { label: "피해", fields: [{ key: "pct", label: "비율(0~1)", step: 0.1 }] },
  gold: { label: "골드±", fields: [{ key: "amount", label: "양" }] },
  upgradeRandom: { label: "랜덤 강화", fields: [] },
  learnUniversal: { label: "범용기 학습", fields: [] },
};
const OUTCOME_KINDS = Object.keys(OUTCOME_SPECS);

export function eventEditorHtml(ev: EncounterEvent | null): string {
  if (!ev) return `<div class="ev-edit"><div class="hint">이 노드 전용 이벤트가 없습니다(없으면 전역 풀에서 랜덤).</div><button class="ed-btn" id="ev-create">＋ 이벤트 만들기</button></div>`;
  const choices = ev.choices.map((c, ci) => {
    const kind = c.result?.kind ?? "nothing";
    const ofields = (OUTCOME_SPECS[kind]?.fields ?? []).map((f) => `<label class="re-f">${esc(f.label)} <input type="number" data-of="${ci}" data-key="${f.key}"${f.step ? ` step="${f.step}"` : ""} value="${(c.result as Record<string, unknown>)?.[f.key] ?? 0}"></label>`).join("");
    const kindSel = `<select data-ock="${ci}">${OUTCOME_KINDS.map((k) => `<option value="${k}"${k === kind ? " selected" : ""}>${esc(OUTCOME_SPECS[k].label)}</option>`).join("")}</select>`;
    return `<li class="re-row"><input type="text" class="ev-clbl" data-clbl="${ci}" value="${esc(c.label)}" placeholder="선택지 라벨">결과 ${kindSel} ${ofields}<button class="ne-x" data-crm="${ci}">✕</button>${c.gamble ? `<span class="hint">+도박(JSON)</span>` : ""}</li>`;
  }).join("");
  return `<div class="ev-edit">
    <label class="ne-field">제목 <input type="text" id="ev-title" value="${esc(ev.title)}"></label>
    <label class="ne-field">본문 <input type="text" id="ev-text" value="${esc(ev.text)}"></label>
    <div class="re-sec"><b>선택지</b><ul class="re-list">${choices}</ul><button class="ed-btn ghost" id="ev-addchoice">＋ 선택지</button></div>
  </div>`;
}

const numVal = (el: HTMLInputElement) => Number(el.value);

export function wireEventEditor(app: HTMLElement, h: EditorHandlers): void {
  app.querySelector("#ev-create")?.addEventListener("click", () => h.onCreateEvent());
  app.querySelector<HTMLInputElement>("#ev-title")?.addEventListener("change", (e) => h.onSetEventField("title", (e.target as HTMLInputElement).value));
  app.querySelector<HTMLInputElement>("#ev-text")?.addEventListener("change", (e) => h.onSetEventField("text", (e.target as HTMLInputElement).value));
  app.querySelector("#ev-addchoice")?.addEventListener("click", () => h.onAddChoice());
  app.querySelectorAll<HTMLElement>("[data-crm]").forEach((b) => b.addEventListener("click", () => h.onRemoveChoice(Number(b.dataset.crm))));
  app.querySelectorAll<HTMLInputElement>(".ev-clbl[data-clbl]").forEach((el) => el.addEventListener("change", () => h.onSetChoiceLabel(Number(el.dataset.clbl), el.value)));
  app.querySelectorAll<HTMLSelectElement>("[data-ock]").forEach((el) => el.addEventListener("change", () => h.onSetChoiceOutcome(Number(el.dataset.ock), el.value)));
  app.querySelectorAll<HTMLInputElement>("[data-of]").forEach((el) => el.addEventListener("change", () => h.onSetOutcomeField(Number(el.dataset.of), el.dataset.key!, numVal(el))));
}
