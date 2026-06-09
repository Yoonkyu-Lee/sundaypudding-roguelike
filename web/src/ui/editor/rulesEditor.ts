// 재사용 PassiveRule[] 에디터 (owner 없음) — 스킬 passives·특성(TraitDef) rules 공용.
// 전투-레이어 룰(owner 있음)은 ruleEditor.ts. 둘 다 ruleSchema(큐레이트 카탈로그) + ruleFields(폼 렌더) 공유.
// 모든 룰을 펼쳐 표시(선택 상태 없음 — 보통 1~2개). 인자 rules[]를 제자리 변이 후 onChange(부모 재렌더).
import { esc } from "../battle/shared.ts";
import type { PassiveRule, Trigger, Condition, Effect } from "../../contract/types.ts";
import { specForm, fieldVal } from "./ruleFields.ts";
import { WHEN_SPECS, WHEN_KINDS, COND_SPECS, COND_KINDS, EFFECT_SPECS, EFFECT_KINDS, whenKindOf, condKindOf, effectKindOf } from "./ruleSchema.ts";

export function rulesEditorHtml(rules: PassiveRule[]): string {
  const blocks = rules.map((r, ri) => {
    const wk = whenKindOf(r.when);
    const whenSel = `<select data-pwhen="${ri}">${WHEN_KINDS.map((k) => `<option value="${k}"${k === wk ? " selected" : ""}>${esc(WHEN_SPECS[k].label)}</option>`).join("")}</select>`;
    const whenFields = specForm(WHEN_SPECS[wk]?.fields ?? [], r.when as unknown as Record<string, unknown>, (k) => `data-pwhenf="${ri}" data-key="${k}"`);
    const conds = (r.if ?? []).map((c, ci) => `<li class="re-row"><span class="re-kind">${esc(COND_SPECS[condKindOf(c)]?.label ?? condKindOf(c))}</span>${specForm(COND_SPECS[condKindOf(c)]?.fields ?? [], c as unknown as Record<string, unknown>, (k) => `data-pcf="${ri}:${ci}" data-key="${k}"`)}<button class="ne-x" data-pcrm="${ri}:${ci}">✕</button></li>`).join("");
    const effs = r.then.map((e, ei) => `<li class="re-row"><span class="re-kind">${esc(EFFECT_SPECS[effectKindOf(e)]?.label ?? effectKindOf(e))}</span>${specForm(EFFECT_SPECS[effectKindOf(e)]?.fields ?? [], e as unknown as Record<string, unknown>, (k) => `data-pef="${ri}:${ei}" data-key="${k}"`)}<button class="ne-x" data-perm="${ri}:${ei}">✕</button></li>`).join("");
    return `<div class="re-rule"><div class="re-rule-h"><b>룰 ${ri + 1}</b><button class="ne-x" data-prm="${ri}">✕ 룰</button></div>
      <div class="re-sec"><b>WHEN</b> ${whenSel} ${whenFields}</div>
      <div class="re-sec"><b>IF</b> <span class="hint">모두 참</span><ul class="re-list">${conds}</ul><select data-paddcond="${ri}">${COND_KINDS.map((k) => `<option value="${k}">${esc(COND_SPECS[k].label)}</option>`).join("")}</select><button class="ed-btn ghost" data-paddcondb="${ri}">＋ 조건</button></div>
      <div class="re-sec"><b>THEN</b><ul class="re-list">${effs}</ul><select data-paddeff="${ri}">${EFFECT_KINDS.map((k) => `<option value="${k}">${esc(EFFECT_SPECS[k].label)}</option>`).join("")}</select><button class="ed-btn ghost" data-paddeffb="${ri}">＋ 효과</button></div>
    </div>`;
  }).join("") || `<div class="hint">패시브 룰 없음</div>`;
  return `<div class="re-rules">${blocks}<button class="ed-btn" data-paddrule>＋ 룰 추가</button></div>`;
}

/** rules[] 제자리 변이 + onChange(부모 재렌더). host 내 data-p* 속성을 와이어링. */
export function bindRulesEditor(host: HTMLElement, rules: PassiveRule[], onChange: () => void): void {
  host.querySelector("[data-paddrule]")?.addEventListener("click", () => { rules.push({ when: WHEN_SPECS.battleStart.make() as Trigger, then: [] }); onChange(); });
  host.querySelectorAll<HTMLElement>("[data-prm]").forEach((b) => b.addEventListener("click", () => { rules.splice(Number(b.dataset.prm), 1); onChange(); }));
  host.querySelectorAll<HTMLSelectElement>("[data-pwhen]").forEach((s) => s.addEventListener("change", () => { rules[Number(s.dataset.pwhen)].when = WHEN_SPECS[s.value].make() as Trigger; onChange(); }));
  host.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-pwhenf]").forEach((el) => el.addEventListener("change", () => { (rules[Number(el.dataset.pwhenf)].when as unknown as Record<string, unknown>)[el.dataset.key!] = fieldVal(el); onChange(); }));
  host.querySelectorAll<HTMLElement>("[data-paddcondb]").forEach((b) => b.addEventListener("click", () => { const ri = Number(b.dataset.paddcondb); const kind = host.querySelector<HTMLSelectElement>(`[data-paddcond="${ri}"]`)!.value; (rules[ri].if ??= []).push(COND_SPECS[kind].make() as Condition); onChange(); }));
  host.querySelectorAll<HTMLElement>("[data-pcrm]").forEach((b) => b.addEventListener("click", () => { const [ri, ci] = b.dataset.pcrm!.split(":").map(Number); rules[ri].if!.splice(ci, 1); if (!rules[ri].if!.length) delete rules[ri].if; onChange(); }));
  host.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-pcf]").forEach((el) => el.addEventListener("change", () => { const [ri, ci] = el.dataset.pcf!.split(":").map(Number); (rules[ri].if![ci] as unknown as Record<string, unknown>)[el.dataset.key!] = fieldVal(el); onChange(); }));
  host.querySelectorAll<HTMLElement>("[data-paddeffb]").forEach((b) => b.addEventListener("click", () => { const ri = Number(b.dataset.paddeffb); const kind = host.querySelector<HTMLSelectElement>(`[data-paddeff="${ri}"]`)!.value; rules[ri].then.push(EFFECT_SPECS[kind].make() as Effect); onChange(); }));
  host.querySelectorAll<HTMLElement>("[data-perm]").forEach((b) => b.addEventListener("click", () => { const [ri, ei] = b.dataset.perm!.split(":").map(Number); rules[ri].then.splice(ei, 1); onChange(); }));
  host.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-pef]").forEach((el) => el.addEventListener("change", () => { const [ri, ei] = el.dataset.pef!.split(":").map(Number); (rules[ri].then[ei] as unknown as Record<string, unknown>)[el.dataset.key!] = fieldVal(el); onChange(); }));
}
