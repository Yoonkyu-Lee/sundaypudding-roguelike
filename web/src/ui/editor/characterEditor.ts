// 캐릭터 에디터 (⑤-e) — characters.json 저작 GUI. 개발자 도구(editor/ = 웹-티 면제).
// 가장 연결 많은 도메인: skillIds(SKILLS·순서=앞4 활성)·traitIds(TRAITS)·aiProfileId(AI_PROFILES)·rootJobId(JOBS) 참조.
// 좌: 필터 + playable 그룹 목록. 우: 프로필·스탯·스킬풀(순서)·특성·AI·전직루트. 저장 = /api/save-characters.
import type { Character } from "../../contract/types.ts";
import { CHARACTERS } from "../../content/characters.ts";
import { SKILLS } from "../../content/skills.ts";
import { TRAITS } from "../../content/traits.ts";
import { JOBS } from "../../content/jobs.ts";
import { AI_PROFILES } from "../../content/ai.ts";
import { avatarHtml, esc } from "../battle/shared.ts";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const STAT_FIELDS: [string, string][] = [["hp", "체력"], ["speedMin", "속도min"], ["speedMax", "속도max"], ["evasion", "회피"], ["accuracy", "명중"], ["critChance", "치명%"], ["critMultiplier", "치명배수"]];

export function createCharacterEditor(deps: { onBack: () => void }): { render: (app: HTMLElement) => void } {
  const chars: Record<string, Character> = JSON.parse(JSON.stringify(CHARACTERS));
  const skillIds = Object.keys(SKILLS);
  let selId: string | null = null;
  let filter = "";
  let dirty = false;
  let refocus = false;
  let host: HTMLElement | null = null;
  let idc = 0;

  const sel = (): Character | null => (selId && chars[selId]) || null;
  const touch = () => { dirty = true; paint(); };

  function addChar(): void {
    const id = prompt("새 캐릭 id (영숫자·_·- 1~40자):", `char_${(idc++).toString(36)}`);
    if (!id) return;
    if (!SAFE_ID.test(id)) { alert("id는 영숫자·_·- 1~40자여야 합니다."); return; }
    if (chars[id]) { alert("이미 존재하는 id입니다."); return; }
    chars[id] = { id, name: "새 캐릭터", hp: 30, speedMin: 4, speedMax: 7, evasion: 8, accuracy: 0, critChance: 10, critMultiplier: 150, skillIds: [] };
    selId = id; dirty = true; paint();
  }
  function delChar(id: string): void {
    if (!confirm(`'${chars[id]?.name ?? id}' (${id}) 삭제? 런 로스터·노드 배치의 참조는 자동 정리되지 않습니다 — 수동 확인 필요.`)) return;
    delete chars[id];
    if (selId === id) selId = null;
    dirty = true; paint();
  }
  function setStat(key: string, raw: string): void { const c = sel() as unknown as Record<string, unknown> | null; if (!c) return; c[key] = Math.floor(Number(raw) || 0); touch(); }
  function setStr(key: "name" | "avatar", raw: string): void { const c = sel(); if (!c) return; const v = raw.trim(); if (key === "name") { if (v) c.name = v; } else if (v) c.avatar = v; else delete c.avatar; touch(); }
  function togglePlayable(): void { const c = sel(); if (!c) return; if (c.playable) delete c.playable; else c.playable = true; touch(); }
  function setSel(key: "aiProfileId" | "rootJobId", val: string): void { const c = sel() as unknown as Record<string, unknown> | null; if (!c) return; if (val) c[key] = val; else delete c[key]; touch(); }
  function addSkill(sid: string): void { const c = sel(); if (!c || !sid) return; (c.skillIds ??= []).push(sid); touch(); }
  function rmSkill(i: number): void { const c = sel(); if (!c) return; c.skillIds.splice(i, 1); touch(); }
  function moveSkill(i: number, dir: number): void { const c = sel(); const a = c?.skillIds; if (!a) return; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; touch(); }
  function toggleTrait(tid: string): void { const c = sel(); if (!c) return; const arr = c.traitIds ?? []; c.traitIds = arr.includes(tid) ? arr.filter((x) => x !== tid) : [...arr, tid]; if (!c.traitIds.length) delete c.traitIds; touch(); }
  async function save(): Promise<void> {
    try {
      const res = await fetch("/api/save-characters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ characters: chars }) });
      if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
      dirty = false; paint();
      alert("저장됨 → src/content/characters.json. 변경 반영은 새로고침, 공유·배포는 git 커밋.");
    } catch { alert("dev 서버가 아닙니다(빌드본) — 저장 불가."); }
  }

  function listHtml(): string {
    const f = filter.trim().toLowerCase();
    const groups: [string, Character[]][] = [["플레이어", []], ["적·NPC", []]];
    for (const c of Object.values(chars)) {
      if (f && !c.id.toLowerCase().includes(f) && !c.name.toLowerCase().includes(f)) continue;
      groups[c.playable ? 0 : 1][1].push(c);
    }
    return groups.filter(([, arr]) => arr.length).map(([label, arr]) => {
      const cards = arr.map((c) => `<button class="jobed-node${c.id === selId ? " sel" : ""}" data-char="${c.id}"><span class="jobed-node-nm">${avatarHtml(c.avatar, "avt cce-av")} ${esc(c.name)}</span><span class="jobed-node-id">${esc(c.id)}</span></button>`).join("");
      return `<div class="ied-group"><div class="jobed-tier-h">${label} <span class="cshint">${arr.length}</span></div>${cards}</div>`;
    }).join("") || `<div class="cshint">결과 없음</div>`;
  }
  function inspect(): string {
    const c = sel();
    if (!c) return `<div class="cshint">캐릭터를 선택하면 편집할 수 있습니다.</div>`;
    const skillRows = (c.skillIds ?? []).map((sid, i) => `<div class="cce-skill"><span class="cce-skill-nm">${i < 4 ? "★" : ""}${esc(SKILLS[sid]?.name ?? sid)}</span><span class="cce-skill-id">${esc(sid)}</span><span class="cce-skill-btns"><button data-skmv="${i}:-1">↑</button><button data-skmv="${i}:1">↓</button><button data-skrm="${i}">✕</button></span></div>`).join("") || `<div class="cshint">스킬 없음</div>`;
    const traitChips = Object.values(TRAITS).map((t) => `<button class="jobed-chip${(c.traitIds ?? []).includes(t.id) ? " on" : ""}" data-trait="${t.id}">${t.icon ?? "✦"} ${esc(t.name)}</button>`).join("");
    const aiOpts = `<option value="">— 없음(그리디)</option>` + Object.keys(AI_PROFILES).map((k) => `<option value="${k}"${c.aiProfileId === k ? " selected" : ""}>${esc(k)}</option>`).join("");
    const jobOpts = `<option value="">— 전직 없음</option>` + Object.keys(JOBS).map((k) => `<option value="${k}"${c.rootJobId === k ? " selected" : ""}>${esc(JOBS[k].name)} (${esc(k)})</option>`).join("");
    return `<h4>${avatarHtml(c.avatar, "avt cce-av")} ${esc(c.name)} <span class="jobed-node-id">${esc(c.id)}</span></h4>
      <div class="jobed-field"><label>이름</label><input id="cc-name" value="${esc(c.name)}"></div>
      <div class="jobed-field"><label>아바타 <span class="cshint">이모지 또는 /avatars/*.webp</span></label><input id="cc-avatar" value="${esc(c.avatar ?? "")}"></div>
      <div class="jobed-field"><div class="jobed-chips"><button class="jobed-chip${c.playable ? " on" : ""}" id="cc-playable">플레이어 편성 가능(playable)</button></div></div>
      <div class="jobed-field"><label>능력치</label><div class="ied-nums">${STAT_FIELDS.map(([k, l]) => `<div class="ied-num-row"><label>${l}</label><input class="ied-num" data-cf="${k}" type="number" value="${(c as unknown as Record<string, number>)[k] ?? 0}"></div>`).join("")}</div></div>
      <div class="jobed-field"><label>스킬 풀 (skillIds) <span class="cshint">★=앞 4개 활성 · 순서 중요</span></label><div class="cce-skills">${skillRows}</div>
        <div class="ske-add"><select id="cc-addskill"><option value="">＋ 스킬 추가…</option>${skillIds.map((s) => `<option value="${s}">${esc(SKILLS[s].name)} (${esc(s)})</option>`).join("")}</select></div></div>
      <div class="jobed-field"><label>특성 (traitIds) <span class="cshint">상시</span></label><div class="jobed-chips">${traitChips}</div></div>
      <div class="jobed-field"><label>AI 프로파일 (aiProfileId)</label><select id="cc-ai">${aiOpts}</select></div>
      <div class="jobed-field"><label>전직 루트 (rootJobId)</label><select id="cc-job">${jobOpts}</select></div>
      <div class="jobed-inspect-actions"><button class="act ghost" id="cc-del">🗑 삭제</button></div>`;
  }

  function paint(): void {
    if (!host) return;
    if (selId && !chars[selId]) selId = null;
    host.innerHTML = `<div class="jobed jobed-traited">
      <header><h1>👤 캐릭터 에디터 <span class="cshint">characters.json${dirty ? " · 변경됨*" : ""}</span></h1>
        <div class="jobed-head-actions"><button class="hub-link" id="cc-save"${dirty ? "" : " disabled"}>💾 저장</button><button class="hub-link" id="cc-back">← 허브</button></div></header>
      <div class="jobed-body">
        <section class="jobed-main"><input id="cc-filter" class="ske-filter" placeholder="🔎 이름·id 필터" value="${esc(filter)}">${listHtml()}<button class="jobed-newroot" id="cc-new">＋ 캐릭터</button></section>
        <aside class="jobed-inspect">${inspect()}</aside>
      </div></div>`;
    host.querySelector("#cc-back")!.addEventListener("click", () => deps.onBack());
    host.querySelector("#cc-save")?.addEventListener("click", () => void save());
    host.querySelector("#cc-new")!.addEventListener("click", () => addChar());
    const fi = host.querySelector<HTMLInputElement>("#cc-filter");
    fi?.addEventListener("input", () => { filter = fi.value; refocus = true; paint(); });
    host.querySelectorAll<HTMLElement>(".jobed-node[data-char]").forEach((el) => el.addEventListener("click", () => { selId = el.dataset.char!; paint(); }));
    host.querySelector("#cc-del")?.addEventListener("click", () => { if (selId) delChar(selId); });
    host.querySelector("#cc-playable")?.addEventListener("click", () => togglePlayable());
    const nm = host.querySelector<HTMLInputElement>("#cc-name"); nm?.addEventListener("change", () => setStr("name", nm.value));
    const av = host.querySelector<HTMLInputElement>("#cc-avatar"); av?.addEventListener("change", () => setStr("avatar", av.value));
    host.querySelectorAll<HTMLInputElement>(".ied-num[data-cf]").forEach((inp) => inp.addEventListener("change", () => setStat(inp.dataset.cf!, inp.value)));
    host.querySelector<HTMLSelectElement>("#cc-addskill")?.addEventListener("change", (e) => addSkill((e.target as HTMLSelectElement).value));
    host.querySelectorAll<HTMLElement>("[data-skrm]").forEach((b) => b.addEventListener("click", () => rmSkill(Number(b.dataset.skrm))));
    host.querySelectorAll<HTMLElement>("[data-skmv]").forEach((b) => b.addEventListener("click", () => { const [i, d] = b.dataset.skmv!.split(":"); moveSkill(Number(i), Number(d)); }));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-trait]").forEach((el) => el.addEventListener("click", () => toggleTrait(el.dataset.trait!)));
    const ai = host.querySelector<HTMLSelectElement>("#cc-ai"); ai?.addEventListener("change", () => setSel("aiProfileId", ai.value));
    const jb = host.querySelector<HTMLSelectElement>("#cc-job"); jb?.addEventListener("change", () => setSel("rootJobId", jb.value));
    if (refocus && fi) { fi.focus(); fi.setSelectionRange(fi.value.length, fi.value.length); refocus = false; }
  }

  return { render(app) { host = app; paint(); } };
}
