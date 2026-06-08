// 캐릭터 도감 (CDX-3) — 허브 진입점. 우측 캐릭터 목록(해금=밝게 / 미해금=어두운 프로필+🔒),
// 좌측 선택 캐릭 스펙 카드 + 스킬 트리(겸 스킬 도감). 런에서 본 스킬만 스펙 공개(나머지 '?').
// 해금 = 관련 런 클리어(meta.unlocked), 스킬 공개 = 런 보유/획득(meta.seenSkills). 순수 표시 — 메타만 읽음.
import type { Character, Skill } from "../contract/types.ts";
import { CHARACTERS } from "../content/characters.ts";
import { SKILLS } from "../content/skills.ts";
import { JOBS } from "../content/jobs.ts";
import { TRAITS } from "../content/traits.ts";
import { skillCardBody, skillType } from "./battle/skillDesc.ts";
import { avatarHtml, esc, r1 } from "./battle/shared.ts";
import { unlockedCharSet, seenSkillSet } from "./meta.ts";

export interface CodexHandlers {
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

// 캐릭터 스킬 묶음: 전용 시작기(체인) · 범용기 · 전직기(차수별) · 전직 분기 패시브.
function skillGroups(c: Character): { title: string; sub?: string; chains: string[][] }[] {
  const ids = c.skillIds ?? [];
  const sigBases = ids.filter((id) => SKILLS[id]?.exclusiveTo === c.id);
  const univBases = ids.filter((id) => SKILLS[id] && !SKILLS[id].exclusiveTo);
  // 전직 전용기 = exclusiveTo 본인 + classReq 설정 + 시작 풀 밖. classReq(차수)별 그룹.
  const classSkills = Object.values(SKILLS).filter((s) => s.exclusiveTo === c.id && s.classReq != null && !ids.includes(s.id));
  const tiers = [...new Set(classSkills.map((s) => s.classReq!))].sort((a, b) => a - b);
  const groups: { title: string; sub?: string; chains: string[][] }[] = [];
  if (sigBases.length) groups.push({ title: "전용기", sub: "시작 보유", chains: sigBases.map(chain) });
  if (univBases.length) groups.push({ title: "범용기", sub: "학습 가능", chains: univBases.map(chain) });
  for (const t of tiers) {
    const bases = classSkills.filter((s) => s.classReq === t).map((s) => s.id).sort();
    groups.push({ title: `전직 ${t}차 전용기`, sub: "숙련도 보류 — 전직 차수로 해금", chains: bases.map(chain) });
  }
  return groups;
}

// 전직 분기(직업 트리) 한 줄 요약 — 차수·부여 패시브. rootJob부터 advancesTo BFS.
function jobBranches(c: Character): string {
  if (!c.rootJobId || !JOBS[c.rootJobId]) return "";
  const rows: string[] = [];
  const queue = [c.rootJobId];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !JOBS[id]) continue;
    seen.add(id);
    const j = JOBS[id];
    const pass = (j.grantsTraitIds ?? []).map((tid) => TRAITS[tid]?.name ?? tid).join(" · ");
    rows.push(`<div class="cdx-job"><span class="cdx-job-t">${j.classReq}차</span><span class="cdx-job-nm">${esc(j.name)}</span>${pass ? `<span class="cdx-job-p">✦ ${esc(pass)}</span>` : ""}</div>`);
    for (const n of j.advancesTo ?? []) queue.push(n);
  }
  return rows.length > 1 ? `<div class="cdx-jobs"><h4>전직 트리 <span class="cshint">분기 차이=패시브</span></h4>${rows.join("")}</div>` : "";
}

// 스킬 노드 — 본 적 있으면 스펙 카드, 아니면 '?'(트리 형태만 노출, 상세 가림).
function skillNode(skillId: string, seen: Set<string>): string {
  const sk: Skill | undefined = SKILLS[skillId];
  if (!sk) return "";
  const tNum = sk.tier ?? 1;
  const tsup = tNum > 1 ? `<sup>T${tNum}</sup>` : "";
  if (!seen.has(skillId)) {
    return `<div class="cdx-skill locked"><div class="cdx-skill-h"><span class="cdx-q">?</span><span class="cdx-skill-nm dim">미발견 스킬${tsup}</span></div><div class="cshint">런에서 보유·획득하면 도감에 공개됩니다.</div></div>`;
  }
  const tk = skillType(sk);
  return `<div class="cdx-skill"><div class="cdx-skill-h"><span class="sktype t-${tk.key}">${tk.label}</span><span class="cdx-skill-nm">${esc(sk.name)}${tsup}</span></div>${skillCardBody(sk)}</div>`;
}

// 강화 체인 한 줄(베이스 → 강화…) — 노드 사이 화살표.
function chainHtml( chainIds: string[], seen: Set<string>): string {
  return `<div class="cdx-chain">${chainIds.map((id) => skillNode(id, seen)).join('<span class="cdx-arrow">→</span>')}</div>`;
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

// 캐릭터 특성(상시 패시브) 요약.
function traitBlock(c: Character): string {
  const ts = (c.traitIds ?? []).map((id) => TRAITS[id]).filter(Boolean);
  if (!ts.length) return "";
  return `<div class="cdx-traits">${ts.map((t) => `<div class="cstrait"><div class="cstrait-h">${t.icon ?? "✦"} ${esc(t.name)}</div><div class="cstrait-r">${esc(t.desc ?? "")}</div></div>`).join("")}</div>`;
}

function detailPane(c: Character, unlocked: boolean, seen: Set<string>): string {
  if (!unlocked) {
    return `<div class="cdx-detail locked">
      <div class="cdx-locked-art">${avatarHtml(undefined, "avt cdx-lockav")}<span class="cdx-lock-ic">🔒</span></div>
      <h3>미해금 캐릭터</h3>
      <p class="cshint">관련 런을 클리어하면 해금됩니다. 해금 후 능력치·스킬 트리·전직을 도감에서 열람할 수 있습니다.</p>
    </div>`;
  }
  const groups = skillGroups(c)
    .map((g) => `<div class="cdx-group"><h4>${esc(g.title)} ${g.sub ? `<span class="cshint">${esc(g.sub)}</span>` : ""}</h4>${g.chains.map((ch) => chainHtml(ch, seen)).join("")}</div>`)
    .join("");
  return `<div class="cdx-detail">
    <div class="cshead">${avatarHtml(c.avatar, "avt")}<h3>${esc(c.name)}</h3></div>
    <div class="cssection"><h4>능력치</h4>${statBlock(c)}</div>
    ${traitBlock(c)}
    ${jobBranches(c)}
    <div class="cssection"><h4>스킬 트리 <span class="cshint">런에서 본 스킬만 공개</span></h4>${groups || "<div class='cshint'>스킬 없음</div>"}</div>
  </div>`;
}

/** 캐릭터 도감 화면. selectedCharId 없으면 첫 해금 캐릭(없으면 첫 캐릭) 자동 선택. */
export function renderCodex(app: HTMLElement, selectedCharId: string | null, h: CodexHandlers): void {
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
  app.innerHTML = `<div class="codex">
    <header><h1>📖 캐릭터 도감 <span class="cshint">해금 ${unlockedCount}/${list.length}</span></h1><button class="hub-link" id="cdx-back">← 허브</button></header>
    <div class="cdx-body">
      <section class="cdx-pane">${sel ? detailPane(sel, unlocked.has(sel.id), seen) : "<div class='cshint'>캐릭터 없음</div>"}</section>
      <aside class="cdx-list">${cards}</aside>
    </div>
  </div>`;

  app.querySelector("#cdx-back")!.addEventListener("click", () => h.onBack());
  app.querySelectorAll<HTMLElement>(".cdx-pick[data-cdx]").forEach((el) => el.addEventListener("click", () => h.onSelect(el.dataset.cdx!)));
}
