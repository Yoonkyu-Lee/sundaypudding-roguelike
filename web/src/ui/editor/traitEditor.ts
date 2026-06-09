// 패시브/특성 에디터 (⑤-d) — traits.json 저작 GUI. 개발자 도구(editor/ = 웹-티 면제).
// TraitDef = { id, name, icon?, desc?, rules: PassiveRule[] }. rules는 rulesEditor(owner 없는 공용 룰 에디터) 재사용.
// 좌: 특성 목록. 우: name/icon/desc + 룰 에디터. 저장 = /api/save-traits.
import type { TraitDef } from "../../contract/types.ts";
import { TRAITS } from "../../content/traits.ts";
import { esc } from "../battle/shared.ts";
import { rulesEditorHtml, bindRulesEditor } from "./rulesEditor.ts";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;

export function createTraitEditor(deps: { onBack: () => void }): { render: (app: HTMLElement) => void } {
  const traits: Record<string, TraitDef> = JSON.parse(JSON.stringify(TRAITS));
  let selId: string | null = null;
  let dirty = false;
  let host: HTMLElement | null = null;
  let idc = 0;

  const sel = (): TraitDef | null => (selId && traits[selId]) || null;
  const touch = () => { dirty = true; paint(); };

  function addTrait(): void {
    const id = prompt("새 특성 id (영숫자·_·- 1~40자):", `trait_${(idc++).toString(36)}`);
    if (!id) return;
    if (!SAFE_ID.test(id)) { alert("id는 영숫자·_·- 1~40자여야 합니다."); return; }
    if (traits[id]) { alert("이미 존재하는 id입니다."); return; }
    traits[id] = { id, name: "새 특성", icon: "✦", desc: "", rules: [] };
    selId = id; dirty = true; paint();
  }
  function delTrait(id: string): void {
    if (!confirm(`'${traits[id]?.name ?? id}' (${id}) 삭제? characters.ts·jobs의 참조(traitIds/grantsTraitIds)는 자동 정리되지 않습니다 — 수동 확인 필요.`)) return;
    delete traits[id];
    if (selId === id) selId = null;
    dirty = true; paint();
  }
  function setStr(key: "name" | "icon" | "desc", raw: string): void {
    const t = sel(); if (!t) return;
    const v = raw.trim();
    if (key === "name") { if (v) t.name = v; } else if (v) t[key] = v; else delete t[key];
    touch();
  }
  async function save(): Promise<void> {
    try {
      const res = await fetch("/api/save-traits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ traits }) });
      if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
      dirty = false; paint();
      alert("저장됨 → src/content/traits.json. 변경 반영은 새로고침, 공유·배포는 git 커밋.");
    } catch { alert("dev 서버가 아닙니다(빌드본) — 저장 불가."); }
  }

  function listHtml(): string {
    return Object.values(traits).map((t) => {
      const on = t.id === selId ? " sel" : "";
      return `<button class="jobed-node${on}" data-trait="${t.id}"><span class="jobed-node-nm">${t.icon ?? "✦"} ${esc(t.name)} <span class="cshint">룰 ${t.rules.length}</span></span><span class="jobed-node-id">${esc(t.id)}</span></button>`;
    }).join("") || `<div class="cshint">특성 없음</div>`;
  }
  function inspect(): string {
    const t = sel();
    if (!t) return `<div class="cshint">특성을 선택하면 편집할 수 있습니다.</div>`;
    return `<h4>${t.icon ?? "✦"} ${esc(t.name)} <span class="jobed-node-id">${esc(t.id)}</span></h4>
      <div class="jobed-field"><label>이름</label><input id="tf-name" value="${esc(t.name)}"></div>
      <div class="jobed-field"><label>아이콘 <span class="cshint">이모지</span></label><input id="tf-icon" value="${esc(t.icon ?? "")}"></div>
      <div class="jobed-field"><label>설명(desc)</label><input id="tf-desc" value="${esc(t.desc ?? "")}"></div>
      <div class="jobed-field"><label>룰(rules) <span class="cshint">상시 작동 when/if/then</span></label>${rulesEditorHtml(t.rules)}</div>
      <div class="jobed-inspect-actions"><button class="act ghost" id="tf-del">🗑 삭제</button></div>`;
  }

  function paint(): void {
    if (!host) return;
    if (selId && !traits[selId]) selId = null;
    host.innerHTML = `<div class="jobed jobed-traited">
      <header><h1>✦ 패시브/특성 에디터 <span class="cshint">traits.json${dirty ? " · 변경됨*" : ""}</span></h1>
        <div class="jobed-head-actions"><button class="hub-link" id="tf-save"${dirty ? "" : " disabled"}>💾 저장</button><button class="hub-link" id="tf-back">← 허브</button></div></header>
      <div class="jobed-body">
        <section class="jobed-main">${listHtml()}<button class="jobed-newroot" id="tf-new">＋ 특성</button></section>
        <aside class="jobed-inspect">${inspect()}</aside>
      </div></div>`;
    host.querySelector("#tf-back")!.addEventListener("click", () => deps.onBack());
    host.querySelector("#tf-save")?.addEventListener("click", () => void save());
    host.querySelector("#tf-new")!.addEventListener("click", () => addTrait());
    host.querySelectorAll<HTMLElement>(".jobed-node[data-trait]").forEach((el) => el.addEventListener("click", () => { selId = el.dataset.trait!; paint(); }));
    host.querySelector("#tf-del")?.addEventListener("click", () => { if (selId) delTrait(selId); });
    const nm = host.querySelector<HTMLInputElement>("#tf-name"); nm?.addEventListener("change", () => setStr("name", nm.value));
    const ic = host.querySelector<HTMLInputElement>("#tf-icon"); ic?.addEventListener("change", () => setStr("icon", ic.value));
    const de = host.querySelector<HTMLInputElement>("#tf-desc"); de?.addEventListener("change", () => setStr("desc", de.value));
    const cur = sel(); if (cur) bindRulesEditor(host, cur.rules, touch);
  }

  return { render(app) { host = app; paint(); } };
}
