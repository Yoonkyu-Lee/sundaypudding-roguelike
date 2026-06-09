// 캐릭터 도감 (charDex) — 허브 진입점. 우측 캐릭터 목록(해금=밝게 / 미해금=어두운 프로필+🔒),
// 좌측 선택 캐릭 스펙 카드 + 스킬 트리(겸 스킬 도감). 런에서 본 스킬만 스펙 공개(나머지 '?').
// 해금 = 관련 런 클리어(meta.unlocked), 스킬 공개 = 런 보유/획득(meta.seenSkills). 순수 표시 — 메타만 읽음.
import type { Character, Skill, JobDef } from "../contract/types.ts";
import { CHARACTERS } from "../content/characters.ts";
import { SKILLS } from "../content/skills.ts";
import { JOBS } from "../content/jobs.ts";
import { TRAITS } from "../content/traits.ts";
import { skillCardBody, skillType } from "./battle/skillDesc.ts";
import { avatarHtml, esc, r1 } from "./battle/shared.ts";
import { unlockedCharSet, seenSkillSet } from "./meta.ts";

export interface CharDexHandlers {
  onSelect: (charId: string) => void;
  onBack: () => void;
}

const PLAYABLE = (): Character[] => Object.values(CHARACTERS).filter((c) => c.playable);

// 강화 체인: base → nextTierId 따라 펼침(순환 가드).
function chain(baseId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = baseId;
  while (cur && SKILLS[cur] && !seen.has(cur)) { out.push(cur); seen.add(cur); cur = SKILLS[cur].nextTierId; }
  return out;
}

// 특성 카드 — 아이콘·이름·설명. 전직 노드가 부여하는 패시브(분기 차별점) 표시용.
function traitCard(traitId: string): string {
  const t = TRAITS[traitId];
  if (!t) return `<div class="cdx-tcard"><div class="cdx-tcard-h">✦ ${esc(traitId)}</div></div>`;
  return `<div class="cdx-tcard"><div class="cdx-tcard-h">${t.icon ?? "✦"} ${esc(t.name)}</div><div class="cstrait-r">${esc(t.desc ?? "")}</div></div>`;
}

// 직업 트리를 차수별로 — rootJob부터 advancesTo BFS. Map<차수, JobDef[]>(분기=같은 차수 여러 노드).
function jobsByTier(c: Character): Map<number, JobDef[]> {
  const map = new Map<number, JobDef[]>();
  if (!c.rootJobId) return map;
  const queue = [c.rootJobId];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !JOBS[id]) continue;
    seen.add(id);
    const j = JOBS[id];
    const arr = map.get(j.classReq) ?? [];
    arr.push(j);
    map.set(j.classReq, arr);
    for (const n of j.advancesTo ?? []) queue.push(n);
  }
  return map;
}

// 차수 컬럼(가로) — 컬럼당: 상단=그 차수 직업 노드(분기 세로 스택 + 부여 특성 카드), 하단=그 차수 스킬.
// 핵심 모델: 분기는 특성으로 갈리고, 전용기 풀은 같은 차수 분기가 공유(GAME-DESIGN 4.7).
function tierColumnsHtml(c: Character, seen: Set<string>): string {
  const ids = c.skillIds ?? [];
  const sigChains = ids.filter((id) => SKILLS[id]?.exclusiveTo === c.id).map(chain);
  const univChains = ids.filter((id) => SKILLS[id] && !SKILLS[id].exclusiveTo).map(chain);
  const classSkills = Object.values(SKILLS).filter((s) => s.exclusiveTo === c.id && s.classReq != null && !ids.includes(s.id));
  const jobs = jobsByTier(c);
  const maxTier = Math.max(0, ...jobs.keys(), ...classSkills.map((s) => s.classReq!));
  const cols: string[] = [];
  for (let t = 0; t <= maxTier; t++) {
    const jobCards = (jobs.get(t) ?? []).map((j) => {
      const traits = (j.grantsTraitIds ?? []).map(traitCard).join("");
      const branch = t >= 1 ? `<span class="cdx-branch">⑂</span>` : "";
      return `<div class="cdx-jobcard"><div class="cdx-jobcard-h">${branch}<span class="cdx-job-nm">${esc(j.name)}</span></div>${traits}</div>`;
    }).join("") || `<div class="cshint">—</div>`;
    let skillsHtml: string;
    if (t === 0) {
      const sig = sigChains.length ? `<div class="cdx-group"><h5>시작기</h5>${sigChains.map((ch) => skillCardEl(ch, seen)).join("")}</div>` : "";
      const uni = univChains.length ? `<div class="cdx-group"><h5>범용기 <span class="cshint">학습</span></h5>${univChains.map((ch) => skillCardEl(ch, seen)).join("")}</div>` : "";
      skillsHtml = sig + uni;
    } else {
      const bases = classSkills.filter((s) => s.classReq === t).map((s) => s.id).sort();
      skillsHtml = bases.length ? `<div class="cdx-group"><h5>전용기 <span class="cshint">분기 공유</span></h5>${bases.map((id) => skillCardEl(chain(id), seen)).join("")}</div>` : "";
    }
    cols.push(`<div class="cdx-tier"><div class="cdx-tier-h">${t}차</div><div class="cdx-tier-jobs">${jobCards}</div><div class="cdx-tier-skills">${skillsHtml || "<div class='cshint'>—</div>"}</div></div>`);
  }
  return `<div class="cdx-tree">${cols.join('<div class="cdx-tier-link">→</div>')}</div>`;
}

// 스킬 내용물(타입·이름·스펙 또는 '?') — 외곽 카드 없이 내부만. 본 적 없으면 '?'.
function skillSpec(skillId: string, seen: Set<string>): string {
  const sk: Skill | undefined = SKILLS[skillId];
  if (!sk) return "";
  const tNum = sk.tier ?? 1;
  const tsup = tNum > 1 ? `<sup>T${tNum}</sup>` : "";
  if (!seen.has(skillId)) {
    return `<div class="cdx-skill-h"><span class="cdx-q">?</span><span class="cdx-skill-nm dim">미발견${tsup}</span></div><div class="cshint">런에서 보유·획득하면 공개</div>`;
  }
  const tk = skillType(sk);
  return `<div class="cdx-skill-h"><span class="sktype t-${tk.key}">${tk.label}</span><span class="cdx-skill-nm">${esc(sk.name)}${tsup}</span></div>${skillCardBody(sk)}`;
}

// 스킬 카드 — 강화 체인이면 차수 토글(T1/T2…)로 한 카드에서 스펙 전환(공간 절약). 단일이면 토글 없음.
function skillCardEl(chainIds: string[], seen: Set<string>): string {
  if (chainIds.length <= 1) {
    const id = chainIds[0];
    return `<div class="cdx-skill${id && !seen.has(id) ? " locked" : ""}">${skillSpec(id, seen)}</div>`;
  }
  const tabs = chainIds.map((id, i) => `<button class="cdx-tbtn${i === 0 ? " on" : ""}" data-tb="${i}">T${SKILLS[id]?.tier ?? i + 1}</button>`).join("");
  const bodies = chainIds.map((id, i) => `<div class="cdx-tbody${i === 0 ? "" : " hidden"}" data-tbody="${i}">${skillSpec(id, seen)}</div>`).join("");
  return `<div class="cdx-skill cdx-upg" data-upg><div class="cdx-tabs"><span class="cdx-tabs-l">강화</span>${tabs}</div>${bodies}</div>`;
}

// 능력치 블록 — 캐릭터 원본 스펙(장착·런 무관).
function statBlock(c: Character): string {
  const row = (label: string, val: string) => `<div class="csstat"><span class="cslabel">${label}</span><span class="csval">${val}</span></div>`;
  return `<div class="csstats">
    ${row("체력", String(c.hp))}
    ${row("속도", `${c.speedMin}~${c.speedMax}`)}
    ${row("회피", String(c.evasion))}
    ${row("명중", String(c.accuracy))}
    ${row("치명%", `${c.critChance}%`)}
    ${row("치명배수", `×${r1(c.critMultiplier / 100)}`)}
  </div>`;
}

// 기본 특성(상시·내재) 칩 — 정체성 바. 전직 부여 특성은 트리 노드 카드로 따로 노출.
function baseTraitsBar(c: Character): string {
  const ids = (c.traitIds ?? []).filter((id) => TRAITS[id]);
  if (!ids.length) return "";
  return `<div class="cdx-basetraits"><span class="cdx-bt-label">기본 특성</span>${ids.map((id) => `<span class="cdx-bt-chip">${TRAITS[id].icon ?? "✦"} ${esc(TRAITS[id].name)}</span>`).join("")}</div>`;
}

function detailPane(c: Character, unlocked: boolean, seen: Set<string>): string {
  if (!unlocked) {
    return `<div class="cdx-detail locked">
      <div class="cdx-locked-art">${avatarHtml(undefined, "avt cdx-lockav")}<span class="cdx-lock-ic">🔒</span></div>
      <h3>미해금 캐릭터</h3>
      <p class="cshint">관련 런을 클리어하면 해금됩니다. 해금 후 능력치·전직 트리·스킬을 도감에서 열람할 수 있습니다.</p>
    </div>`;
  }
  return `<div class="cdx-detail">
    <div class="cdx-idbar">
      <div class="cshead">${avatarHtml(c.avatar, "avt")}<h3>${esc(c.name)}</h3></div>
      ${statBlock(c)}
      ${baseTraitsBar(c)}
    </div>
    <div class="cssection cdx-tree-sec">
      <h4>전직 트리 + 스킬 <span class="cshint">분기=특성 · 전용기 풀은 차수 분기 공유 · 런에서 본 스킬만 공개</span></h4>
      ${tierColumnsHtml(c, seen)}
    </div>
  </div>`;
}

/** 캐릭터 도감 화면. selectedCharId 없으면 첫 해금 캐릭(없으면 첫 캐릭) 자동 선택. */
export function renderCharDex(app: HTMLElement, selectedCharId: string | null, h: CharDexHandlers): void {
  const list = PLAYABLE();
  const unlocked = unlockedCharSet();
  const seen = seenSkillSet();
  const sel = list.find((c) => c.id === selectedCharId) ?? list.find((c) => unlocked.has(c.id)) ?? list[0];

  const cards = list.map((c) => {
    const on = unlocked.has(c.id);
    const cls = `cdx-pick${on ? "" : " locked"}${sel && c.id === sel.id ? " sel" : ""}`;
    const name = on ? esc(c.name) : "???";
    const lock = on ? "" : `<span class="cdx-lock-ic">🔒</span>`;
    return `<button class="${cls}" data-cdx="${c.id}">${avatarHtml(on ? c.avatar : undefined, "avt cdx-av")}${lock}<span class="hub-nm">${name}</span></button>`;
  }).join("");

  const unlockedCount = list.filter((c) => unlocked.has(c.id)).length;
  app.innerHTML = `<div class="chardex">
    <header><h1>📖 캐릭터 도감 <span class="cshint">해금 ${unlockedCount}/${list.length}</span></h1><button class="hub-link" id="cdx-back">← 허브</button></header>
    <div class="cdx-body">
      <section class="cdx-pane">${sel ? detailPane(sel, unlocked.has(sel.id), seen) : "<div class='cshint'>캐릭터 없음</div>"}</section>
      <aside class="cdx-list">${cards}</aside>
    </div>
  </div>`;

  app.querySelector("#cdx-back")!.addEventListener("click", () => h.onBack());
  app.querySelectorAll<HTMLElement>(".cdx-pick[data-cdx]").forEach((el) => el.addEventListener("click", () => h.onSelect(el.dataset.cdx!)));
  // 강화 토글 — 카드 안에서 차수별 스펙 전환(로컬 DOM, 재렌더 없음).
  app.querySelectorAll<HTMLElement>("[data-upg]").forEach((card) => {
    card.querySelectorAll<HTMLElement>(".cdx-tbtn").forEach((btn) => btn.addEventListener("click", () => {
      const i = btn.dataset.tb!;
      card.querySelectorAll<HTMLElement>(".cdx-tbtn").forEach((b) => b.classList.toggle("on", b === btn));
      card.querySelectorAll<HTMLElement>(".cdx-tbody").forEach((b) => b.classList.toggle("hidden", b.dataset.tbody !== i));
    }));
  });
}
