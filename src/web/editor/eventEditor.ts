// 인카운터 이벤트 에디터 (Phase D) — event 레이어의 인라인 event(title/text/choices) 저작.
// 선택지 = 라벨 + 모드(확정 결과 / 도박 확률 win·lose). 스키마 구동.
import { esc } from "../battle/shared.ts";
import type { EncounterEvent, EncounterOutcome } from "../../core/types.ts";
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

/** outcome 컨트롤(종류 select + 파라미터) — branch(result/win/lose)별 data-attr로 와이어 분기. */
function outcomeBlock(o: EncounterOutcome | undefined, branch: string, ci: number): string {
  const kind = o?.kind ?? "nothing";
  const sel = `<select data-okind="${branch}" data-ci="${ci}">${OUTCOME_KINDS.map((k) => `<option value="${k}"${k === kind ? " selected" : ""}>${esc(OUTCOME_SPECS[k].label)}</option>`).join("")}</select>`;
  const fields = (OUTCOME_SPECS[kind]?.fields ?? []).map((f) => `<input type="number" data-ofield="${branch}" data-ci="${ci}" data-key="${f.key}"${f.step ? ` step="${f.step}"` : ""} value="${(o as Record<string, unknown>)?.[f.key] ?? 0}" title="${esc(f.label)}">`).join("");
  return `${sel} ${fields}`;
}

export function eventEditorHtml(ev: EncounterEvent | null): string {
  if (!ev) return `<div class="ev-edit"><div class="hint">이 노드 전용 이벤트가 없습니다(없으면 전역 풀에서 랜덤).</div><button class="ed-btn" id="ev-create">＋ 이벤트 만들기</button></div>`;
  const choices = ev.choices.map((c, ci) => {
    const isGamble = !!c.gamble;
    const modeSel = `<select data-cmode="${ci}"><option value="fixed"${isGamble ? "" : " selected"}>확정</option><option value="gamble"${isGamble ? " selected" : ""}>🎲 도박</option></select>`;
    const body = c.gamble
      ? `<div class="ev-gamble"><label class="re-f">성공률 <input type="number" data-gchance="${ci}" min="0" max="1" step="0.05" value="${c.gamble.chance}"></label>
          <div class="ev-branch">✅ 성공 ${outcomeBlock(c.gamble.win, "win", ci)}</div>
          <div class="ev-branch">❌ 실패 ${outcomeBlock(c.gamble.lose, "lose", ci)}</div></div>`
      : `<span class="ev-fixed">결과 ${outcomeBlock(c.result, "result", ci)}</span>`;
    return `<li class="re-row"><input type="text" class="ev-clbl" data-clbl="${ci}" value="${esc(c.label)}" placeholder="선택지 라벨">${modeSel} ${body}<button class="ne-x" data-crm="${ci}">✕</button></li>`;
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
  app.querySelectorAll<HTMLSelectElement>("[data-cmode]").forEach((el) => el.addEventListener("change", () => h.onSetChoiceMode(Number(el.dataset.cmode), el.value as "fixed" | "gamble")));
  app.querySelectorAll<HTMLInputElement>("[data-gchance]").forEach((el) => el.addEventListener("change", () => h.onSetGambleChance(Number(el.dataset.gchance), numVal(el))));
  // outcome 종류/필드 — branch(result/win/lose)로 분기
  app.querySelectorAll<HTMLSelectElement>("[data-okind]").forEach((el) => el.addEventListener("change", () => {
    const ci = Number(el.dataset.ci), branch = el.dataset.okind!;
    if (branch === "result") h.onSetChoiceOutcome(ci, el.value); else h.onSetGambleOutcome(ci, branch as "win" | "lose", el.value);
  }));
  app.querySelectorAll<HTMLInputElement>("[data-ofield]").forEach((el) => el.addEventListener("change", () => {
    const ci = Number(el.dataset.ci), branch = el.dataset.ofield!, key = el.dataset.key!;
    if (branch === "result") h.onSetOutcomeField(ci, key, numVal(el)); else h.onSetGambleOutcomeField(ci, branch as "win" | "lose", key, numVal(el));
  }));
}
