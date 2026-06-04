// 상점 진열 에디터 (슬라이스: 상점 진열 노드별 저작) — shop 레이어의 offers[] 저작.
// 품목 = 종류(아이템/회복/스킬학습) + 파라미터 + 비용. keepGenerated=절차생성 진열 병행. 스키마 구동.
import { esc } from "../battle/shared.ts";
import type { ShopOfferDef } from "../../core/types.ts";
import type { EditorHandlers } from "./editorRender.ts";
import { ITEMS } from "../../data/items.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";

const ITEM_OPTS = Object.values(ITEMS).map((i) => ({ value: i.id, label: `${i.icon ?? ""} ${i.name}` }));
const CHAR_OPTS = Object.values(CHARACTERS).map((c) => ({ value: c.id, label: c.name }));
const SKILL_OPTS = Object.values(SKILLS).map((s) => ({ value: s.id, label: s.name }));
const SHOP_KINDS: Record<string, string> = { buyItem: "🛍 아이템", heal: "💗 회복", learn: "📖 스킬학습" };

const sel = (idx: number, key: string, cur: unknown, opts: { value: string; label: string }[]) =>
  `<select data-sfield="${idx}" data-skey="${key}">${opts.map((o) => `<option value="${o.value}"${cur === o.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
const num = (idx: number, key: string, cur: unknown, step?: number) =>
  `<input type="number" data-sfield="${idx}" data-skey="${key}"${step ? ` step="${step}"` : ""} value="${cur ?? 0}">`;

function offerRow(o: ShopOfferDef, i: number): string {
  const kindSel = `<select data-skind="${i}">${Object.entries(SHOP_KINDS).map(([k, lbl]) => `<option value="${k}"${o.kind === k ? " selected" : ""}>${esc(lbl)}</option>`).join("")}</select>`;
  let params = "";
  if (o.kind === "buyItem") params = sel(i, "itemId", o.itemId, ITEM_OPTS);
  else if (o.kind === "heal") params = `<label class="re-f">비율 ${num(i, "pct", o.pct, 0.1)}</label>`;
  else if (o.kind === "learn") params = `${sel(i, "charId", o.charId, CHAR_OPTS)} ${sel(i, "skillId", o.skillId, SKILL_OPTS)}`;
  return `<li class="re-row">${kindSel} ${params}<label class="re-f">${"" /* 비용 */}💰 ${num(i, "cost", (o as { cost: number }).cost)}</label><button class="ne-x" data-srm="${i}">✕</button></li>`;
}

/** 새 품목 기본값(종류별) — 첫 옵션으로 유효 id 채움. */
export function defaultShopOffer(kind: string): ShopOfferDef {
  if (kind === "heal") return { kind: "heal", pct: 0.5, cost: 15 };
  if (kind === "learn") return { kind: "learn", charId: CHAR_OPTS[0]?.value ?? "", skillId: SKILL_OPTS[0]?.value ?? "", cost: 20 };
  return { kind: "buyItem", itemId: ITEM_OPTS[0]?.value ?? "", cost: 30 };
}

export function shopEditorHtml(layer: { offers?: ShopOfferDef[]; keepGenerated?: boolean }): string {
  const offers = layer.offers ?? [];
  const rows = offers.length ? offers.map(offerRow).join("") : `<li class="hint">진열 미지정 — 파티 기반 자동 생성.</li>`;
  return `<div class="shop-edit"><div class="hint">진열을 직접 지정(비우면 파티 기반 자동 생성).</div>
    <ul class="re-list">${rows}</ul>
    <div class="ne-add"><select id="shop-addkind">${Object.entries(SHOP_KINDS).map(([k, lbl]) => `<option value="${k}">${esc(lbl)}</option>`).join("")}</select><button class="ed-btn ghost" id="shop-add">＋ 품목</button></div>
    <label class="re-f"><input type="checkbox" id="shop-keepgen"${layer.keepGenerated ? " checked" : ""}> 자동 생성 진열도 함께 표시</label></div>`;
}

export function wireShopEditor(app: HTMLElement, h: EditorHandlers): void {
  app.querySelector("#shop-add")?.addEventListener("click", () => h.onAddShopOffer(app.querySelector<HTMLSelectElement>("#shop-addkind")!.value));
  app.querySelectorAll<HTMLElement>("[data-srm]").forEach((b) => b.addEventListener("click", () => h.onRemoveShopOffer(Number(b.dataset.srm))));
  app.querySelectorAll<HTMLSelectElement>("[data-skind]").forEach((el) => el.addEventListener("change", () => h.onSetShopOfferKind(Number(el.dataset.skind), el.value)));
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-sfield]").forEach((el) => el.addEventListener("change", () => {
    const idx = Number(el.dataset.sfield!), key = el.dataset.skey!;
    const val = el instanceof HTMLInputElement && el.type === "number" ? Number(el.value) : el.value;
    h.onSetShopOfferField(idx, key, val);
  }));
  app.querySelector<HTMLInputElement>("#shop-keepgen")?.addEventListener("change", (e) => h.onSetKeepGenerated((e.target as HTMLInputElement).checked));
}
