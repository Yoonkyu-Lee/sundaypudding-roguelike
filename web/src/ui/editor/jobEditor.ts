// 전직 트리 에디터 (⑤-a) — jobs.json 저작 GUI. 개발자 도구(런 에디터의 형제, editor/ = 웹-티 면제).
// 모델: jobs = 플랫 Record<id,JobDef>. "트리" = incoming 없는 루트에서 advancesTo BFS. 차수(classReq) 컬럼 = charDex 레이아웃 재사용.
// 캐릭터 rootJobId는 characters.ts(미이주) → 루트↔캐릭 매핑은 읽기전용 라벨. 저장 = /api/save-jobs(dev-write, 통째 기록).
import type { Character, JobDef } from "../../contract/types.ts";
import { CHARACTERS } from "../../content/characters.ts";
import { JOBS } from "../../content/jobs.ts";
import { TRAITS } from "../../content/traits.ts";
import { avatarHtml, esc } from "../battle/shared.ts";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;

export function createJobEditor(deps: { onBack: () => void }): { render: (app: HTMLElement) => void } {
  const jobs: Record<string, JobDef> = JSON.parse(JSON.stringify(JOBS));
  let selRoot: string | null = null;
  let selJob: string | null = null;
  let dirty = false;
  let host: HTMLElement | null = null;
  let idc = 0;

  // ── 트리 위상 ──
  const incoming = (): Set<string> => { const s = new Set<string>(); for (const j of Object.values(jobs)) for (const t of j.advancesTo ?? []) s.add(t); return s; };
  const rootIds = (): string[] => { const inc = incoming(); return Object.keys(jobs).filter((id) => !inc.has(id)).sort(); };
  function reachable(rootId: string): string[] {
    const out: string[] = []; const seen = new Set<string>(); const q = [rootId];
    while (q.length) { const id = q.shift()!; if (seen.has(id) || !jobs[id]) continue; seen.add(id); out.push(id); for (const n of jobs[id].advancesTo ?? []) q.push(n); }
    return out;
  }
  function tiers(rootId: string): Map<number, JobDef[]> {
    const m = new Map<number, JobDef[]>();
    for (const id of reachable(rootId)) { const j = jobs[id]; const a = m.get(j.classReq) ?? []; a.push(j); m.set(j.classReq, a); }
    return m;
  }
  const charsForRoot = (rootId: string): Character[] => Object.values(CHARACTERS).filter((c) => c.rootJobId === rootId);

  function ensureSel(): void {
    const roots = rootIds();
    if (!selRoot || !jobs[selRoot] || !roots.includes(selRoot)) selRoot = roots[0] ?? null;
    if (selJob && !jobs[selJob]) selJob = null;
  }

  // ── 변이 ──
  function addJob(tier: number, parentId: string | null): void {
    const sug = parentId ? `${parentId}_adv` : `job_${(idc++).toString(36)}`;
    const id = prompt("새 직업 id (영숫자·_·- 1~40자):", sug);
    if (!id) return;
    if (!SAFE_ID.test(id)) { alert("id는 영숫자·_·- 1~40자여야 합니다."); return; }
    if (jobs[id]) { alert("이미 존재하는 id입니다."); return; }
    jobs[id] = { id, name: "새 직업", classReq: tier };
    if (parentId && jobs[parentId]) (jobs[parentId].advancesTo ??= []).push(id);
    else selRoot = id;
    selJob = id; dirty = true; paint();
  }
  function delJob(id: string): void {
    if (!confirm(`'${jobs[id]?.name ?? id}' (${id}) 삭제? 다른 직업의 advancesTo 참조도 정리됩니다.`)) return;
    delete jobs[id];
    for (const j of Object.values(jobs)) if (j.advancesTo) { j.advancesTo = j.advancesTo.filter((x) => x !== id); if (!j.advancesTo.length) delete j.advancesTo; }
    if (selJob === id) selJob = null;
    if (selRoot === id) selRoot = null;
    dirty = true; paint();
  }
  function toggleTrait(traitId: string): void {
    const j = selJob && jobs[selJob]; if (!j) return;
    const arr = j.grantsTraitIds ?? [];
    j.grantsTraitIds = arr.includes(traitId) ? arr.filter((x) => x !== traitId) : [...arr, traitId];
    if (!j.grantsTraitIds.length) delete j.grantsTraitIds;
    dirty = true; paint();
  }
  function toggleAdv(toId: string): void {
    const j = selJob && jobs[selJob]; if (!j) return;
    const arr = j.advancesTo ?? [];
    j.advancesTo = arr.includes(toId) ? arr.filter((x) => x !== toId) : [...arr, toId];
    if (!j.advancesTo.length) delete j.advancesTo;
    dirty = true; paint();
  }
  async function save(): Promise<void> {
    try {
      const res = await fetch("/api/save-jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobs }) });
      if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
      dirty = false; paint();
      alert("저장됨 → src/content/jobs.json. 변경 반영은 새로고침, 공유·배포는 git 커밋.");
    } catch { alert("dev 서버가 아닙니다(빌드본) — 저장 불가."); }
  }

  // ── 렌더 ──
  function treeList(): string {
    return rootIds().map((rid) => {
      const chars = charsForRoot(rid);
      const label = chars.length ? chars.map((c) => esc(c.name)).join("·") : esc(jobs[rid].name);
      const av = chars[0]?.avatar;
      const on = rid === selRoot ? " sel" : "";
      return `<button class="jobed-tree-pick${on}" data-root="${rid}">${avatarHtml(av, "avt jobed-av")}<span class="jobed-tree-nm">${label}</span><span class="cshint">${reachable(rid).length}노드</span></button>`;
    }).join("") || `<div class="cshint">루트 직업 없음</div>`;
  }
  function treeCols(): string {
    if (!selRoot) return `<div class="jobed-empty">직업 트리가 없습니다. ＋ 루트 직업으로 시작하세요.</div>`;
    const map = tiers(selRoot);
    const maxT = Math.max(0, ...map.keys());
    const cols: string[] = [];
    for (let t = 0; t <= maxT; t++) {
      const cards = (map.get(t) ?? []).map((j) => {
        const on = j.id === selJob ? " sel" : "";
        const adv = j.advancesTo?.length ? `⑂${j.advancesTo.length}` : "";
        const tr = (j.grantsTraitIds ?? []).length ? ` ✦${(j.grantsTraitIds ?? []).length}` : "";
        return `<button class="jobed-node${on}" data-job="${j.id}"><span class="jobed-node-nm">${esc(j.name)}</span><span class="jobed-node-meta">${adv}${tr}</span><span class="jobed-node-id">${esc(j.id)}</span></button>`;
      }).join("") || `<div class="cshint">—</div>`;
      cols.push(`<div class="jobed-tier"><div class="jobed-tier-h">${t}차</div>${cards}</div>`);
    }
    return `<div class="jobed-tree">${cols.join('<div class="jobed-link">→</div>')}</div>`;
  }
  function inspect(): string {
    if (!selJob || !jobs[selJob]) return `<div class="cshint">직업 노드를 선택하면 편집할 수 있습니다.</div>`;
    const j = jobs[selJob];
    const traitChips = Object.values(TRAITS).map((t) => `<button class="jobed-chip${(j.grantsTraitIds ?? []).includes(t.id) ? " on" : ""}" data-trait="${t.id}">${t.icon ?? "✦"} ${esc(t.name)}</button>`).join("");
    const advChips = Object.values(jobs).filter((o) => o.id !== j.id).sort((a, b) => a.classReq - b.classReq).map((o) => `<button class="jobed-chip${(j.advancesTo ?? []).includes(o.id) ? " on" : ""}" data-adv="${o.id}">${esc(o.name)} <span class="jobed-chip-t">${o.classReq}차</span></button>`).join("");
    return `<h4>${esc(j.name)} <span class="jobed-node-id">${esc(j.id)}</span></h4>
      <div class="jobed-field"><label>이름</label><input id="jf-name" value="${esc(j.name)}"></div>
      <div class="jobed-field"><label>차수 (classReq)</label><input id="jf-tier" type="number" min="0" value="${j.classReq}"></div>
      <div class="jobed-field"><label>부여 특성 <span class="cshint">분기 차별점 (런 전직 시 부여)</span></label><div class="jobed-chips">${traitChips || "<span class='cshint'>특성 없음</span>"}</div></div>
      <div class="jobed-field"><label>다음 차수 (advancesTo)</label><div class="jobed-chips">${advChips || "<span class='cshint'>다른 직업 없음</span>"}</div></div>
      <div class="jobed-inspect-actions"><button class="act" id="jf-branch">＋ 다음 차수 분기</button><button class="act ghost" id="jf-del">🗑 삭제</button></div>`;
  }

  function paint(): void {
    if (!host) return;
    ensureSel();
    host.innerHTML = `<div class="jobed">
      <header><h1>🔀 전직 트리 에디터 <span class="cshint">jobs.json${dirty ? " · 변경됨*" : ""}</span></h1>
        <div class="jobed-head-actions"><button class="hub-link" id="jobed-save"${dirty ? "" : " disabled"}>💾 저장</button><button class="hub-link" id="jobed-back">← 허브</button></div></header>
      <div class="jobed-body">
        <aside class="jobed-trees"><div class="jobed-trees-h">트리</div>${treeList()}<button class="jobed-newroot" id="jobed-newroot">＋ 루트 직업</button></aside>
        <section class="jobed-main">${treeCols()}</section>
        <aside class="jobed-inspect">${inspect()}</aside>
      </div></div>`;
    host.querySelector("#jobed-back")!.addEventListener("click", () => deps.onBack());
    host.querySelector("#jobed-save")?.addEventListener("click", () => void save());
    host.querySelector("#jobed-newroot")!.addEventListener("click", () => addJob(0, null));
    host.querySelectorAll<HTMLElement>(".jobed-tree-pick[data-root]").forEach((el) => el.addEventListener("click", () => { selRoot = el.dataset.root!; selJob = null; paint(); }));
    host.querySelectorAll<HTMLElement>(".jobed-node[data-job]").forEach((el) => el.addEventListener("click", () => { selJob = el.dataset.job!; paint(); }));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-trait]").forEach((el) => el.addEventListener("click", () => toggleTrait(el.dataset.trait!)));
    host.querySelectorAll<HTMLElement>(".jobed-chip[data-adv]").forEach((el) => el.addEventListener("click", () => toggleAdv(el.dataset.adv!)));
    const nm = host.querySelector<HTMLInputElement>("#jf-name");
    nm?.addEventListener("change", () => { const j = selJob && jobs[selJob]; if (j) { j.name = nm.value.trim() || j.name; dirty = true; paint(); } });
    const tr = host.querySelector<HTMLInputElement>("#jf-tier");
    tr?.addEventListener("change", () => { const j = selJob && jobs[selJob]; if (j) { j.classReq = Math.max(0, Math.floor(Number(tr.value) || 0)); dirty = true; paint(); } });
    host.querySelector("#jf-branch")?.addEventListener("click", () => { const j = selJob && jobs[selJob]; if (j) addJob(j.classReq + 1, j.id); });
    host.querySelector("#jf-del")?.addEventListener("click", () => { if (selJob) delJob(selJob); });
  }

  return { render(app) { host = app; paint(); } };
}
