// 아이템 에디터 (⑤-b) — items.json 저작 GUI. 개발자 도구(editor/ = 웹-티 면제).
// 모델: items.json = { items: Record<id,ItemDef>, pool: string[] }. pool = 상점/보상 추첨 등장 풀.
// 폼 위주(아이템=플랫 레코드) — 좌측 슬롯별 목록, 우측 인스펙터(스탯 보정·슬롯·강화체인·풀 토글). 저장 = /api/save-items.
import type { ItemDef } from "../../contract/types.ts";
import { ITEMS, ITEM_POOL } from "../../content/items.ts";
import { esc } from "../battle/shared.ts";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const SLOTS: [ItemDef["slot"], string][] = [["weapon", "무기"], ["armor", "방어구"], ["held", "지닌물건"]];
const MOD_FIELDS: [string, string][] = [["hp", "체력"], ["evasion", "회피"], ["accuracy", "명중"], ["critChance", "치명%"], ["critMultiplier", "치명배수"], ["speedMin", "속도min"], ["speedMax", "속도max"]];

export function createItemEditor(deps: { onBack: () => void }): { render: (app: HTMLElement) => void } {
  const items: Record<string, ItemDef> = JSON.parse(JSON.stringify(ITEMS));
  let pool: string[] = [...ITEM_POOL];
  let selId: string | null = null;
  let dirty = false;
  let host: HTMLElement | null = null;
  let idc = 0;

  const sel = (): ItemDef | null => (selId && items[selId]) || null;

  // ── 변이 ──
  function addItem(): void {
    const id = prompt("새 아이템 id (영숫자·_·- 1~40자):", `item_${(idc++).toString(36)}`);
    if (!id) return;
    if (!SAFE_ID.test(id)) { alert("id는 영숫자·_·- 1~40자여야 합니다."); return; }
    if (items[id]) { alert("이미 존재하는 id입니다."); return; }
    items[id] = { id, name: "새 아이템", slot: "weapon" };
    selId = id; dirty = true; paint();
  }
  function delItem(id: string): void {
    if (!confirm(`'${items[id]?.name ?? id}' (${id}) 삭제? pool·nextTierId 참조도 정리됩니다.`)) return;
    delete items[id];
    pool = pool.filter((x) => x !== id);
    for (const it of Object.values(items)) if (it.nextTierId === id) delete it.nextTierId;
    if (selId === id) selId = null;
    dirty = true; paint();
  }
  function setStr(key: "name" | "icon", raw: string): void {
    const it = sel(); if (!it) return;
    const v = raw.trim();
    if (key === "icon") { if (v) it.icon = v; else delete it.icon; }
    else if (v) it.name = v;
    dirty = true; paint();
  }
  function setTop(key: string, raw: string): void {
    const it = sel() as Record<string, unknown> | null; if (!it) return;
    const v = raw.trim();
    if (v === "") delete it[key]; else it[key] = Math.floor(Number(v) || 0);
    dirty = true; paint();
  }
  function setMod(key: string, raw: string): void {
    const it = sel(); if (!it) return;
    const mods = (it.mods ?? {}) as Record<string, number>;
    const v = raw.trim();
    if (v === "") delete mods[key]; else mods[key] = Math.floor(Number(v) || 0);
    if (Object.keys(mods).length) it.mods = mods as ItemDef["mods"]; else delete it.mods;
    dirty = true; paint();
  }
  function setSlot(slot: ItemDef["slot"]): void { const it = sel(); if (!it) return; it.slot = slot; dirty = true; paint(); }
  function toggleNext(id: string): void { const it = sel(); if (!it) return; it.nextTierId = it.nextTierId === id ? undefined : id; if (!it.nextTierId) delete it.nextTierId; dirty = true; paint(); }
  function togglePool(): void { if (!selId) return; pool = pool.includes(selId) ? pool.filter((x) => x !== selId) : [...pool, selId]; dirty = true; paint(); }
  async function save(): Promise<void> {
    try {
      const res = await fetch("/api/save-items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, pool }) });
      if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
      dirty = false; paint();
      alert("저장됨 → src/content/items.json. 변경 반영은 새로고침, 공유·배포는 git 커밋.");
    } catch { alert("dev 서버가 아닙니다(빌드본) — 저장 불가."); }
  }

  // ── 렌더 ──
  function listHtml(): string {
    return SLOTS.map(([slot, label]) => {
      const its = Object.values(items).filter((i) => i.slot === slot);
      if (!its.length) return "";
      const cards = its.map((i) => {
        const on = i.id === selId ? " sel" : "";
        const mk = pool.includes(i.id) ? `<span class="ied-pool-mk">◆</span>` : "";
        return `<button class="jobed-node${on}" data-item="${i.id}"><span class="jobed-node-nm">${i.icon ?? "📦"} ${esc(i.name)} ${mk}</span><span class="jobed-node-id">${esc(i.id)}</span></button>`;
      }).join("");
      return `<div class="ied-group"><div class="jobed-tier-h">${label} <span class="cshint">${its.length}</span></div>${cards}</div>`;
    }).join("") || `<div class="cshint">아이템 없음</div>`;
  }
  function numField(label: string, key: string, val: number | undefined, isMod: boolean, hint = ""): string {
    const attr = isMod ? `data-mod="${key}"` : `data-num="${key}"`;
    return `<div class="ied-num-row"><label>${label}${hint ? ` <span class="cshint">${hint}</span>` : ""}</label><input class="ied-num" ${attr} type="number" value="${val ?? ""}"></div>`;
  }
  function inspect(): string {
    const it = sel();
    if (!it) return `<div class="cshint">아이템을 선택하면 편집할 수 있습니다.</div>`;
    const slotChips = SLOTS.map(([s, l]) => `<button class="jobed-chip${it.slot === s ? " on" : ""}" data-slot="${s}">${l}</button>`).join("");
    const nextChips = Object.values(items).filter((o) => o.id !== it.id).map((o) => `<button class="jobed-chip${it.nextTierId === o.id ? " on" : ""}" data-next="${o.id}">${o.icon ?? "📦"} ${esc(o.name)}</button>`).join("");
    const mods = (it.mods ?? {}) as Record<string, number>;
    return `<h4>${it.icon ?? "📦"} ${esc(it.name)} <span class="jobed-node-id">${esc(it.id)}</span></h4>
      <div class="jobed-field"><label>이름</label><input id="if-name" value="${esc(it.name)}"></div>
      <div class="jobed-field"><label>아이콘 <span class="cshint">이모지</span></label><input id="if-icon" value="${esc(it.icon ?? "")}"></div>
      <div class="jobed-field"><label>슬롯</label><div class="jobed-chips">${slotChips}</div></div>
      <div class="jobed-field"><label>기본 수치</label><div class="ied-nums">
        ${numField("공격상수", "dmgFlat", it.dmgFlat, false, "무기")}
        ${numField("쉴드획득", "shieldGainAdd", it.shieldGainAdd, false, "방어구")}
        ${numField("tier", "tier", it.tier, false)}
      </div></div>
      <div class="jobed-field"><label>능력치 보정 (mods) <span class="cshint">비우면 미적용</span></label><div class="ied-nums">
        ${MOD_FIELDS.map(([k, l]) => numField(l, k, mods[k], true)).join("")}
      </div></div>
      <div class="jobed-field"><label>강화 체인 (nextTierId)</label><div class="jobed-chips">${nextChips || "<span class='cshint'>다른 아이템 없음</span>"}</div></div>
      <div class="jobed-field"><label>등장 풀</label><button class="jobed-chip${pool.includes(it.id) ? " on" : ""}" id="if-pool">◆ 상점·보상 추첨 등장</button></div>
      <div class="jobed-inspect-actions"><button class="act ghost" id="if-del">🗑 삭제</button></div>`;
  }

  function paint(): void {
    if (!host) return;
    if (selId && !items[selId]) selId = null;
    host.innerHTML = `<div class="jobed jobed-itemed">
      <header><h1>🛡 아이템 에디터 <span class="cshint">items.json${dirty ? " · 변경됨*" : ""}</span></h1>
        <div class="jobed-head-actions"><button class="hub-link" id="ied-save"${dirty ? "" : " disabled"}>💾 저장</button><button class="hub-link" id="ied-back">← 허브</button></div></header>
      <div class="jobed-body">
        <section class="jobed-main">${listHtml()}<button class="jobed-newroot" id="ied-new">＋ 아이템</button></section>
        <aside class="jobed-inspect">${inspect()}</aside>
      </div></div>`;
    host.querySelector("#ied-back")!.addEventListener("click", () => deps.onBack());
    host.querySelector("#ied-save")?.addEventListener("click", () => void save());
    host.querySelector("#ied-new")!.addEventListener("click", () => addItem());
    host.querySelectorAll<HTMLElement>(".jobed-node[data-item]").forEach((el) => el.addEventListener("click", () => { selId = el.dataset.item!; paint(); }));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-slot]").forEach((el) => el.addEventListener("click", () => setSlot(el.dataset.slot as ItemDef["slot"])));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-next]").forEach((el) => el.addEventListener("click", () => toggleNext(el.dataset.next!)));
    host.querySelector("#if-pool")?.addEventListener("click", () => togglePool());
    host.querySelector("#if-del")?.addEventListener("click", () => { if (selId) delItem(selId); });
    const nm = host.querySelector<HTMLInputElement>("#if-name"); nm?.addEventListener("change", () => setStr("name", nm.value));
    const ic = host.querySelector<HTMLInputElement>("#if-icon"); ic?.addEventListener("change", () => setStr("icon", ic.value));
    host.querySelectorAll<HTMLInputElement>(".ied-num[data-num]").forEach((inp) => inp.addEventListener("change", () => setTop(inp.dataset.num!, inp.value)));
    host.querySelectorAll<HTMLInputElement>(".ied-num[data-mod]").forEach((inp) => inp.addEventListener("change", () => setMod(inp.dataset.mod!, inp.value)));
  }

  return { render(app) { host = app; paint(); } };
}
