// 스킬 에디터 (⑤-c) — skills.json 저작 GUI. 개발자 도구(editor/ = 웹-티 면제).
// 좌: 필터 + exclusiveTo 그룹 목록. 우: 스칼라·target·area·effects[]. passives(PassiveRule DSL)는 읽기전용(편집=S-S3).
import type { Skill, SkillEffect, AreaShape } from "../../contract/types.ts";
import { SKILLS } from "../../content/skills.ts";
import { CHARACTERS } from "../../content/characters.ts";
import { STATUS_DEFS } from "../../content/statuses.ts";
import { esc } from "../battle/shared.ts";
import { SKILL_EFFECT_SPECS, EFFECT_KINDS, AREA_KINDS, type EffField } from "./skillEffectSchema.ts";
import { rulesEditorHtml, bindRulesEditor } from "./rulesEditor.ts";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const OPTIONAL_NUM = new Set(["reach", "tier", "masteryReq", "classReq", "grantsInterrupt"]);
const NUM_FIELDS: [string, string][] = [["cooldown", "쿨타임"], ["accuracy", "명중"], ["reach", "도달열"], ["grantsInterrupt", "끼어들기"], ["tier", "tier"], ["masteryReq", "숙련요구"], ["classReq", "차수요구"]];

export function createSkillEditor(deps: { onBack: () => void }): { render: (app: HTMLElement) => void } {
  const skills: Record<string, Skill> = JSON.parse(JSON.stringify(SKILLS));
  const statusIds = Object.keys(STATUS_DEFS);
  const charIds = Object.keys(CHARACTERS);
  let selId: string | null = null;
  let filter = "";
  let dirty = false;
  let refocus = false;
  let host: HTMLElement | null = null;
  let idc = 0;

  const sel = (): Skill | null => (selId && skills[selId]) || null;

  // ── 변이 ──
  function addSkill(): void {
    const id = prompt("새 스킬 id (영숫자·_·- 1~40자):", `skill_${(idc++).toString(36)}`);
    if (!id) return;
    if (!SAFE_ID.test(id)) { alert("id는 영숫자·_·- 1~40자여야 합니다."); return; }
    if (skills[id]) { alert("이미 존재하는 id입니다."); return; }
    skills[id] = { id, name: "새 스킬", target: "enemy", cooldown: 0, accuracy: 90, effects: [] };
    selId = id; dirty = true; paint();
  }
  function delSkill(id: string): void {
    if (!confirm(`'${skills[id]?.name ?? id}' (${id}) 삭제? nextTierId 참조도 정리됩니다.`)) return;
    delete skills[id];
    for (const s of Object.values(skills)) if (s.nextTierId === id) delete s.nextTierId;
    if (selId === id) selId = null;
    dirty = true; paint();
  }
  const touch = () => { dirty = true; paint(); };
  function setNum(key: string, raw: string): void {
    const s = sel() as unknown as Record<string, unknown> | null; if (!s) return;
    const v = raw.trim();
    if (v === "" && OPTIONAL_NUM.has(key)) delete s[key]; else s[key] = Math.floor(Number(v) || 0);
    touch();
  }
  function setStr(key: "name", raw: string): void { const s = sel(); if (!s) return; if (raw.trim()) s.name = raw.trim(); touch(); }
  function setSel(key: "exclusiveTo" | "nextTierId" | "grantsInterruptTo", val: string): void {
    const s = sel() as unknown as Record<string, unknown> | null; if (!s) return;
    if (val) s[key] = val; else delete s[key];
    touch();
  }
  function setTarget(t: Skill["target"]): void { const s = sel(); if (!s) return; s.target = t; touch(); }
  function toggleBool(key: "alwaysHit" | "active"): void {
    const s = sel(); if (!s) return;
    if (key === "active") { if (s.active === false) delete s.active; else s.active = false; } // 기본 true
    else { if (s.alwaysHit) delete s.alwaysHit; else s.alwaysHit = true; }
    touch();
  }
  function setArea(kind: string): void {
    const s = sel(); if (!s) return;
    if (kind === "single") delete s.area;
    else if (kind === "free") s.area = { kind: "free", count: 1 };
    else if (kind === "square" || kind === "cross") s.area = { kind, radius: 1 };
    else s.area = { kind: kind as "row" | "col" | "all" };
    touch();
  }
  function setAreaNum(key: "radius" | "count", raw: string): void { const a = sel()?.area as Record<string, number> | undefined; if (!a) return; a[key] = Math.max(0, Math.floor(Number(raw) || 0)); touch(); }
  function addEffect(kind: string): void { const s = sel(); const spec = SKILL_EFFECT_SPECS[kind]; if (!s || !spec) return; (s.effects ??= []).push(spec.make() as unknown as SkillEffect); touch(); }
  function delEffect(i: number): void { const s = sel(); if (!s?.effects) return; s.effects.splice(i, 1); touch(); }
  function moveEffect(i: number, dir: number): void { const s = sel(); const a = s?.effects; if (!a) return; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; touch(); }
  function setEffField(i: number, key: string, raw: string, type: string): void {
    const e = sel()?.effects?.[i] as unknown as Record<string, unknown> | undefined; if (!e) return;
    e[key] = (type === "number") ? Math.floor(Number(raw) || 0) : raw;
    touch();
  }
  async function save(): Promise<void> {
    try {
      for (const sk of Object.values(skills)) if (sk.passives && !sk.passives.length) delete sk.passives; // 빈 passives는 직렬화 생략
      const res = await fetch("/api/save-skills", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skills }) });
      if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
      dirty = false; paint();
      alert("저장됨 → src/content/skills.json. 변경 반영은 새로고침, 공유·배포는 git 커밋.");
    } catch { alert("dev 서버가 아닙니다(빌드본) — 저장 불가."); }
  }

  // ── 렌더 ──
  function listHtml(): string {
    const f = filter.trim().toLowerCase();
    const groups = new Map<string, Skill[]>();
    for (const s of Object.values(skills)) {
      if (f && !s.id.toLowerCase().includes(f) && !s.name.toLowerCase().includes(f)) continue;
      const k = s.exclusiveTo ?? "";
      const arr = groups.get(k) ?? []; arr.push(s); groups.set(k, arr);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    return keys.map((k) => {
      const label = k ? (CHARACTERS[k]?.name ?? k) : "범용기";
      const cards = groups.get(k)!.map((s) => {
        const on = s.id === selId ? " sel" : "";
        const t = (s.tier ?? 1) > 1 ? `<sup>T${s.tier}</sup>` : "";
        const p = (s.passives?.length ?? 0) ? `<span class="ske-pmk">⚡</span>` : "";
        return `<button class="jobed-node${on}" data-skill="${s.id}"><span class="jobed-node-nm">${esc(s.name)}${t} ${p}</span><span class="jobed-node-id">${esc(s.id)}</span></button>`;
      }).join("");
      return `<div class="ied-group"><div class="jobed-tier-h">${esc(label)} <span class="cshint">${groups.get(k)!.length}</span></div>${cards}</div>`;
    }).join("") || `<div class="cshint">결과 없음</div>`;
  }
  function effFieldHtml(i: number, fld: EffField, val: unknown): string {
    const base = `data-eff="${i}" data-effk="${fld.key}" data-efft="${fld.type}"`;
    if (fld.type === "number") return `<label class="ied-num-row"><span>${fld.label}</span><input class="ied-num" ${base} type="number" value="${val ?? ""}"></label>`;
    if (fld.type === "text") return `<label class="ied-num-row"><span>${fld.label}</span><input ${base} value="${esc(String(val ?? ""))}"></label>`;
    const opts = fld.type === "status" ? statusIds : fld.type === "char" ? charIds : (fld.options ?? []);
    const blank = (fld.type === "status" || fld.type === "char") ? `<option value="">—</option>` : "";
    return `<label class="ied-num-row"><span>${fld.label}</span><select ${base}>${blank}${opts.map((o) => `<option value="${esc(o)}"${val === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  }
  function effectsHtml(s: Skill): string {
    const rows = (s.effects ?? []).map((e, i) => {
      const spec = SKILL_EFFECT_SPECS[e.kind];
      const fields = spec ? spec.fields.map((fl) => effFieldHtml(i, fl, (e as unknown as Record<string, unknown>)[fl.key])).join("") : "";
      return `<div class="ske-eff"><div class="ske-eff-h"><span class="ske-eff-kind">${spec?.label ?? e.kind}</span><span class="ske-eff-btns"><button data-effmv="${i}:-1">↑</button><button data-effmv="${i}:1">↓</button><button data-effdel="${i}">✕</button></span></div><div class="ske-eff-fields">${fields}</div></div>`;
    }).join("") || `<div class="cshint">효과 없음</div>`;
    return `${rows}<div class="ske-add"><select id="ske-addkind">${EFFECT_KINDS.map((k) => `<option value="${k}">${SKILL_EFFECT_SPECS[k].label}</option>`).join("")}</select><button class="jobed-chip" id="ske-addbtn">＋ 효과</button></div>`;
  }
  function inspect(): string {
    const s = sel();
    if (!s) return `<div class="cshint">스킬을 선택하면 편집할 수 있습니다.</div>`;
    const targetChips = (["enemy", "ally", "self"] as const).map((t) => `<button class="jobed-chip${s.target === t ? " on" : ""}" data-tg="${t}">${t}</button>`).join("");
    const giToChips = (["self", "target"] as const).map((t) => `<button class="jobed-chip${s.grantsInterruptTo === t ? " on" : ""}" data-gito="${t}">${t}</button>`).join("");
    const a = s.area ?? { kind: "single" };
    const areaChips = AREA_KINDS.map((k) => `<button class="jobed-chip${a.kind === k ? " on" : ""}" data-area="${k}">${k}</button>`).join("");
    let areaExtra = "";
    if (a.kind === "square" || a.kind === "cross") areaExtra = `<div class="ied-num-row"><label>radius</label><input class="ied-num" data-areanum="radius" type="number" value="${(a as { radius?: number }).radius ?? 1}"></div>`;
    else if (a.kind === "free") areaExtra = `<div class="ied-num-row"><label>count</label><input class="ied-num" data-areanum="count" type="number" value="${(a as { count?: number }).count ?? 1}"></div>`;
    const charOpts = `<option value="">— 범용</option>` + charIds.map((c) => `<option value="${c}"${s.exclusiveTo === c ? " selected" : ""}>${esc(CHARACTERS[c]?.name ?? c)}</option>`).join("");
    const nextOpts = `<option value="">— 없음</option>` + Object.keys(skills).filter((k) => k !== s.id).map((k) => `<option value="${k}"${s.nextTierId === k ? " selected" : ""}>${esc(skills[k].name)}</option>`).join("");
    return `<h4>${esc(s.name)} <span class="jobed-node-id">${esc(s.id)}</span></h4>
      <div class="jobed-field"><label>이름</label><input id="sk-name" value="${esc(s.name)}"></div>
      <div class="jobed-field"><label>대상(target)</label><div class="jobed-chips">${targetChips}</div></div>
      <div class="jobed-field"><label>수치 <span class="cshint">선택값은 비우면 미설정</span></label><div class="ied-nums">${NUM_FIELDS.map(([k, l]) => `<div class="ied-num-row"><label>${l}${OPTIONAL_NUM.has(k) ? " <span class='cshint'>opt</span>" : ""}</label><input class="ied-num" data-skf="${k}" type="number" value="${(s as unknown as Record<string, unknown>)[k] ?? ""}"></div>`).join("")}</div></div>
      <div class="jobed-field"><div class="jobed-chips"><button class="jobed-chip${s.alwaysHit ? " on" : ""}" data-bool="alwaysHit">필중(alwaysHit)</button><button class="jobed-chip${s.active !== false ? " on" : ""}" data-bool="active">능동기(active)</button></div></div>
      <div class="jobed-field"><label>끼어들기 주체(grantsInterruptTo)</label><div class="jobed-chips">${giToChips}</div></div>
      <div class="jobed-field"><label>전용 캐릭(exclusiveTo)</label><select id="sk-excl">${charOpts}</select></div>
      <div class="jobed-field"><label>강화 다음(nextTierId)</label><select id="sk-next">${nextOpts}</select></div>
      <div class="jobed-field"><label>면적(area)</label><div class="jobed-chips">${areaChips}</div>${areaExtra}</div>
      <div class="jobed-field"><label>효과(effects)</label><div class="ske-effs">${effectsHtml(s)}</div></div>
      <div class="jobed-field"><label>패시브(passives) <span class="cshint">출전 시 작동하는 when/if/then 룰</span></label>${rulesEditorHtml(s.passives ?? [])}</div>
      <div class="jobed-inspect-actions"><button class="act ghost" id="sk-del">🗑 삭제</button></div>`;
  }

  function paint(): void {
    if (!host) return;
    if (selId && !skills[selId]) selId = null;
    host.innerHTML = `<div class="jobed jobed-skilled">
      <header><h1>⚔ 스킬 에디터 <span class="cshint">skills.json${dirty ? " · 변경됨*" : ""}</span></h1>
        <div class="jobed-head-actions"><button class="hub-link" id="sk-save"${dirty ? "" : " disabled"}>💾 저장</button><button class="hub-link" id="sk-back">← 허브</button></div></header>
      <div class="jobed-body">
        <section class="jobed-main"><input id="ske-filter" class="ske-filter" placeholder="🔎 이름·id 필터" value="${esc(filter)}">${listHtml()}<button class="jobed-newroot" id="sk-new">＋ 스킬</button></section>
        <aside class="jobed-inspect">${inspect()}</aside>
      </div></div>`;
    host.querySelector("#sk-back")!.addEventListener("click", () => deps.onBack());
    host.querySelector("#sk-save")?.addEventListener("click", () => void save());
    host.querySelector("#sk-new")!.addEventListener("click", () => addSkill());
    const fi = host.querySelector<HTMLInputElement>("#ske-filter");
    fi?.addEventListener("input", () => { filter = fi.value; refocus = true; paint(); });
    host.querySelectorAll<HTMLElement>(".jobed-node[data-skill]").forEach((el) => el.addEventListener("click", () => { selId = el.dataset.skill!; paint(); }));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-tg]").forEach((el) => el.addEventListener("click", () => setTarget(el.dataset.tg as Skill["target"])));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-gito]").forEach((el) => el.addEventListener("click", () => setSel("grantsInterruptTo", s2(sel()?.grantsInterruptTo) === el.dataset.gito ? "" : el.dataset.gito!)));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-area]").forEach((el) => el.addEventListener("click", () => setArea(el.dataset.area!)));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-bool]").forEach((el) => el.addEventListener("click", () => toggleBool(el.dataset.bool as "alwaysHit" | "active")));
    const nm = host.querySelector<HTMLInputElement>("#sk-name"); nm?.addEventListener("change", () => setStr("name", nm.value));
    const ex = host.querySelector<HTMLSelectElement>("#sk-excl"); ex?.addEventListener("change", () => setSel("exclusiveTo", ex.value));
    const nx = host.querySelector<HTMLSelectElement>("#sk-next"); nx?.addEventListener("change", () => setSel("nextTierId", nx.value));
    host.querySelector("#sk-del")?.addEventListener("click", () => { if (selId) delSkill(selId); });
    host.querySelectorAll<HTMLInputElement>(".ied-num[data-skf]").forEach((inp) => inp.addEventListener("change", () => setNum(inp.dataset.skf!, inp.value)));
    host.querySelectorAll<HTMLInputElement>(".ied-num[data-areanum]").forEach((inp) => inp.addEventListener("change", () => setAreaNum(inp.dataset.areanum as "radius" | "count", inp.value)));
    host.querySelector("#ske-addbtn")?.addEventListener("click", () => addEffect((host!.querySelector<HTMLSelectElement>("#ske-addkind"))!.value));
    host.querySelectorAll<HTMLElement>("[data-effdel]").forEach((el) => el.addEventListener("click", () => delEffect(Number(el.dataset.effdel))));
    host.querySelectorAll<HTMLElement>("[data-effmv]").forEach((el) => el.addEventListener("click", () => { const [i, d] = el.dataset.effmv!.split(":"); moveEffect(Number(i), Number(d)); }));
    host.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-eff]").forEach((el) => el.addEventListener("change", () => setEffField(Number(el.dataset.eff), el.dataset.effk!, el.value, el.dataset.efft!)));
    const cur = sel(); if (cur) { cur.passives ??= []; bindRulesEditor(host, cur.passives, touch); } // 패시브 룰 에디터(owner 없음)
    if (refocus && fi) { fi.focus(); fi.setSelectionRange(fi.value.length, fi.value.length); refocus = false; }
  }

  const s2 = (v: unknown): string => (typeof v === "string" ? v : "");
  return { render(app) { host = app; paint(); } };
}
