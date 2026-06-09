// 캐릭터 시트 (모달 오버레이). 맵·전투 공용 — 능력치·장착·보유 스킬을 펼쳐서 조회/관리.
// 호출자가 baseStats·현재 HP·equipped·inventory·skills를 조립 → 시트는 장착 보정(현재값)·델타·픽커 렌더.
// 장착 메커니즘(슬라이스2): 맵 editable이면 슬롯에 장착/교체/해제, 전투는 읽기전용.
import type { EquipSlot, ItemDef, UnitView } from "../contract/types.ts";
import { ITEMS } from "../content/items.ts";
import { SKILLS } from "../content/skills.ts";
import { statusChipsList } from "./battle/status.ts";
import { skillInline, skillType, skillTraits, traitsHtml } from "./battle/skillDesc.ts";
import { avatarHtml, esc, r1 } from "./battle/shared.ts";

export interface SheetBaseStats {
  hp: number; // 원본 maxHp
  speedMin: number;
  speedMax: number;
  evasion: number;
  accuracy: number;
  critChance: number;
  critMultiplier: number;
}
export interface SheetSkill {
  id: string;
  name: string;
  tier: number;
  active: boolean;
  canUpgrade: boolean;
  signature: boolean;
  /** 능동기 여부(스킬창 발동). false=순수 패시브 */
  isActiveSkill?: boolean;
  /** 패시브 파트 설명(있으면 하이브리드/순수 패시브). describeSkillPassives 결과 */
  passives?: string[];
}
/** 캐릭터 특성(상시) — 읽기전용 표시용. */
export interface SheetTrait { name: string; icon?: string; rules: string[] }
export interface SheetData {
  charId: string;
  name: string;
  avatar?: string;
  hp: number; // 현재 HP
  hpMax: number; // 현재 maxHp (장착 반영)
  shield: number; // 현재 쉴드 (전투만, 맵=0)
  base: SheetBaseStats; // 원본(장착 전)
  equipped: { weapon?: string; armor?: string; held?: string };
  inventory: string[]; // 미장착 보유 아이템
  skills: SheetSkill[];
  traits: SheetTrait[]; // 캐릭터 특성(상시 패시브)
  statuses: UnitView["statuses"]; // 활성 상태이상 (전투만, 맵=[])
  activeCount: number;
  editable: boolean; // 맵=장착/활성4 조작, 전투=읽기전용
  detail: boolean; // '자세히 보기' — ON이면 능력치에 원본+변화 병기
  jobName?: string; // 현재 직업(전직 4.7) — 머리 배지
  classTier?: number; // 전직 차수(0=루트)
}
export interface SheetHandlers {
  onToggle: (charId: string, skillId: string) => void;
  onEquip: (charId: string, slot: EquipSlot, itemId: string) => void;
  onUnequip: (charId: string, slot: EquipSlot) => void;
  /** 드래그앤드롭 장착: itemId를 toCharId의 (item.slot)에. from이 있으면 그 슬롯에서 옮겨오는 것(해제 후 장착). */
  onEquipItem: (toCharId: string, itemId: string, from?: { charId: string; slot: EquipSlot }) => void;
  onToggleDetail: () => void; // 자세히 보기 토글
  onClose: () => void;
}

const SLOTS: { key: EquipSlot; label: string; locked?: boolean }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "held", label: "지닌 물건", locked: true },
];

/** 아이템 보정을 한 줄 설명으로 (무기/방어구 효과 투명 표기). 인벤토리 상세에서도 재사용. */
export function itemDesc(it: ItemDef): string {
  const p: string[] = [];
  if (it.dmgFlat) p.push(`공격 +${it.dmgFlat}`);
  const m = it.mods;
  if (m?.hp) p.push(`HP +${m.hp}`);
  if (it.shieldGainAdd) p.push(`쉴드획득 +${it.shieldGainAdd}`);
  if (m?.critChance) p.push(`치명 +${m.critChance}%`);
  if (m?.critMultiplier) p.push(`치명배수 +${r1(m.critMultiplier / 100)}`); // 정수 퍼센트(30=+0.3)
  if (m?.evasion) p.push(`회피 +${m.evasion}`);
  if (m?.accuracy) p.push(`명중 +${m.accuracy}`);
  if (m?.speedMin || m?.speedMax) p.push(`속도 +${m.speedMin ?? 0}~+${m.speedMax ?? 0}`);
  return p.join(" · ");
}

/** 장착 보정을 더한 현재 스탯 (원본 + Σ장착 mods). HP는 hpMax로 별도 전달됨. */
function effective(base: SheetBaseStats, eq: SheetData["equipped"]) {
  const s = { ...base };
  for (const id of [eq.weapon, eq.armor, eq.held]) {
    const m = id ? ITEMS[id]?.mods : undefined;
    if (!m) continue;
    s.evasion += m.evasion ?? 0; s.accuracy += m.accuracy ?? 0;
    s.critChance += m.critChance ?? 0; s.critMultiplier += m.critMultiplier ?? 0;
    s.speedMin += m.speedMin ?? 0; s.speedMax += m.speedMax ?? 0;
  }
  return s;
}

// 체력바 + 쉴드바 (머리 아래). 쉴드 0이면 쉴드바 숨김. 자세히 ON이면 HP 원본+변화 병기.
function barsBlock(d: SheetData): string {
  const hpPct = Math.max(0, (d.hp / d.hpMax) * 100);
  const shPct = d.shield > 0 ? Math.min(100, (d.shield / d.hpMax) * 100) : 0;
  const hpDelta = d.hpMax - d.base.hp; // 방어구 HP 보정
  const hpBreak = d.detail && hpDelta !== 0 ? `<span class="csbreak">${d.base.hp} ${hpDelta >= 0 ? "+" : ""}${hpDelta}</span>` : "";
  const shTxt = d.shield > 0 ? `<span class="csbar-sh">🛡 ${d.shield}</span>` : "";
  return `<div class="cssbars">
    <div class="bars">
      <div class="shbar">${shPct > 0 ? `<div class="shfill" style="width:${shPct}%"></div>` : ""}</div>
      <div class="hpbar"><div class="hp" style="width:${hpPct}%"></div></div>
    </div>
    <div class="csbar-text"><span>❤ ${d.hp}/${d.hpMax}</span>${hpBreak}${shTxt}</div>
  </div>`;
}

// 능력치 행 — 기본=현재(effective)만. 자세히 ON이면 오른쪽에 [원본] [+변화] 병기(0.2).
function statRows(d: SheetData): string {
  const b = d.base, e = effective(b, d.equipped);
  const row = (label: string, cur: string, base: string, hint = "", delta?: number) => {
    let val = `<span class="csval">${cur}</span>`;
    if (d.detail && cur !== base) {
      const dstr = delta !== undefined && delta !== 0 ? ` <span class="csdelta">${delta >= 0 ? "+" : ""}${r1(delta)}</span>` : "";
      val += `<span class="csbreak">${base}${dstr}</span>`;
    }
    return `<div class="csstat"><span class="cslabel">${label}</span>${val}${hint ? `<span class="cshint">${hint}</span>` : ""}</div>`;
  };
  return [
    row("속도", `${e.speedMin}~${e.speedMax}`, `${b.speedMin}~${b.speedMax}`, "라운드 주사위"),
    row("회피", `${e.evasion}`, `${b.evasion}`, "명중에서 차감", e.evasion - b.evasion),
    row("명중", `${e.accuracy}`, `${b.accuracy}`, "기본 0 + 스킬", e.accuracy - b.accuracy),
    row("치명%", `${e.critChance}%`, `${b.critChance}%`, "", e.critChance - b.critChance),
    row("치명배수", `×${r1(e.critMultiplier / 100)}`, `×${r1(b.critMultiplier / 100)}`, "", (e.critMultiplier - b.critMultiplier) / 100), // 정수 퍼센트(160=×1.6)
  ].join("");
}

// 장착칸 — 채워지면 아이템(드래그 가능 표식 data-item) + 해제 버튼. 슬롯=drop 타깃(data-slot). 장착은 인벤토리 DnD/클릭.
function slotBlock(d: SheetData, sl: { key: EquipSlot; label: string; locked?: boolean }): string {
  if (sl.locked) return `<div class="csslot locked" data-slot="${sl.key}"><span class="csslotname">${sl.label}</span><span class="csslotval">🔒 후속</span></div>`;
  const curId = d.equipped[sl.key];
  const cur = curId ? ITEMS[curId] : undefined;
  const equippedHtml = cur
    ? `<div class="csslot-eq"><span class="csslot-item" data-item="${curId}">${cur.icon ?? "📦"} ${esc(cur.name)}</span>${d.editable ? `<button class="csslot-off" data-unequip="${sl.key}">해제</button>` : ""}</div><div class="csslot-desc">${itemDesc(cur)}</div>`
    : `<span class="csslotval">(없음)</span>`;
  return `<div class="csslot${cur ? " filled" : ""}" data-slot="${sl.key}"><span class="csslotname">${sl.label}</span>${equippedHtml}</div>`;
}

// 스킬 한 행 — 타입칩·이름·티어·전용/범용·강화가능 + 스펙 한 줄(쿨·명중·피해·사정권·특징) + 출전 토글.
function skillRow(s: SheetSkill, d: SheetData): string {
  const sk = SKILLS[s.id];
  const tk = sk ? skillType(sk).key : "attack";
  const tag = s.signature ? `<span class="csk-tag sig">전용기</span>` : `<span class="csk-tag univ">범용기</span>`;
  const up = s.canUpgrade ? `<span class="csk-up" aria-label="강화 가능">⬆</span>` : "";
  const spec = sk && s.isActiveSkill !== false ? `<span class="csk-spec">${esc(skillInline(sk))}</span>` : "";
  const traits = sk && s.isActiveSkill !== false && skillTraits(sk).length ? `<div class="csk-traits">${traitsHtml(sk)}</div>` : ""; // 능동 효과 칩(호버=설명)
  const passive = s.passives && s.passives.length ? `<div class="csk-passive">${s.passives.map((p) => `<span class="csk-pchip">🔄 ${esc(p)}</span>`).join("")}</div>` : "";
  // 출전 토글: 활성=빼기(최소 1), 비활성=넣기(최대 4). setActiveSkill이 한도 처리.
  const canAdd = !s.active && d.activeCount < 4;
  const btn = d.editable
    ? `<button class="csk-toggle${s.active ? " on" : ""}" data-sheet-skill="${s.id}"${!s.active && !canAdd ? " disabled" : ""}>${s.active ? "출전 ✓" : "출전"}</button>`
    : "";
  const ptag = s.isActiveSkill === false ? `<span class="csk-tag pas">패시브</span>` : (s.passives && s.passives.length ? `<span class="csk-tag pas">하이브리드</span>` : "");
  return `<div class="csk-row${s.active ? " active" : ""}">
    <div class="csk-line"><span class="sktype t-${tk}">${sk ? skillType(sk).label : ""}</span><span class="csk-name">${esc(s.name)}${s.tier > 1 ? `<sup>T${s.tier}</sup>` : ""}</span>${tag}${ptag}${up}${btn}</div>
    ${spec}${traits}${passive}
  </div>`;
}

// 특성 섹션 (읽기전용) — 캐릭터 상시 패시브.
function traitSection(d: SheetData): string {
  if (!d.traits.length) return "";
  const cards = d.traits
    .map((t) => `<div class="cstrait"><div class="cstrait-h">${t.icon ?? "✦"} ${esc(t.name)}</div>${t.rules.map((r) => `<div class="cstrait-r">${esc(r)}</div>`).join("")}</div>`)
    .join("");
  return `<div class="cssection"><h4>특성 <span class="cshint">캐릭터 상시 효과</span></h4><div class="cstrait-list">${cards}</div></div>`;
}

function skillList(d: SheetData): string {
  const active = d.skills.filter((s) => s.active);
  const owned = d.skills.filter((s) => !s.active);
  const sec = (title: string, sub: string, list: SheetSkill[]) =>
    `<div class="cssection"><h4>${title} ${sub}</h4><div class="csk-list">${list.map((s) => skillRow(s, d)).join("") || "<div class='cshint'>없음</div>"}</div></div>`;
  const ownedSub = d.editable ? `<span class="cshint">탭해 출전에 추가</span>` : (owned.length ? `<span class="cshint">전투 중 — 편성은 비전투에서</span>` : "");
  return sec("⚔ 출전", `<span class="cshint">${d.activeCount}/4</span>`, active) + sec("보유", ownedSub, owned);
}

/** 시트 본문(머리+바+능력치/상태/장착/스킬) — 단독 모달·파티뷰 상세 pane 공용. 닫기/오버레이 크롬 제외. */
export function sheetBody(d: SheetData): string {
  const statusSec = d.statuses.length
    ? `<div class="cssection"><h4>상태</h4><div class="chips csheet-chips">${statusChipsList(d.statuses)}</div></div>`
    : "";
  const toggle = `<button class="csdetail-toggle${d.detail ? " on" : ""}" data-toggle-detail>${d.detail ? "자세히 ✓" : "자세히 보기"}</button>`;
  const jobBadge = d.jobName ? `<span class="cs-job">🔀 ${esc(d.jobName)}${(d.classTier ?? 0) > 0 ? ` · ${d.classTier}차` : ""}</span>` : "";
  return `<div class="cshead">${avatarHtml(d.avatar, "avt")}<div class="cshead-id"><h3>${esc(d.name)}</h3>${jobBadge}</div></div>
    ${barsBlock(d)}
    <div class="csbody">
      <div class="cssection"><h4>능력치 ${toggle}</h4><div class="csstats">${statRows(d)}</div></div>
      ${statusSec}
      <div class="cssection"><h4>장착</h4><div class="csslots">${SLOTS.map((sl) => slotBlock(d, sl)).join("")}</div></div>
      ${traitSection(d)}
      ${skillList(d)}
    </div>`;
}

/** 시트 조작 와이어링 — 자세히 토글은 항상, 스킬/장착은 editable일 때만. */
export function wireSheet(scope: HTMLElement, d: SheetData, h: SheetHandlers): void {
  scope.querySelector<HTMLButtonElement>("[data-toggle-detail]")?.addEventListener("click", () => h.onToggleDetail());
  if (!d.editable) return;
  scope.querySelectorAll<HTMLButtonElement>("[data-sheet-skill]").forEach((b) =>
    b.addEventListener("click", () => h.onToggle(d.charId, b.dataset.sheetSkill!)));
  scope.querySelectorAll<HTMLButtonElement>("[data-equip-item]").forEach((b) =>
    b.addEventListener("click", () => h.onEquip(d.charId, b.dataset.equipSlot as EquipSlot, b.dataset.equipItem!)));
  scope.querySelectorAll<HTMLButtonElement>("[data-unequip]").forEach((b) =>
    b.addEventListener("click", () => h.onUnequip(d.charId, b.dataset.unequip as EquipSlot)));
}

/** 단독 캐릭터 시트 모달 (전투 아군 ℹ 프로필 조회용). */
export function renderCharSheet(app: HTMLElement, d: SheetData, h: SheetHandlers): void {
  app.querySelector(".charsheet-overlay")?.remove(); // 중복 방지
  const ov = document.createElement("div");
  ov.className = "charsheet-overlay";
  ov.innerHTML = `<div class="charsheet" role="dialog"><button class="cs-close" aria-label="닫기 (Esc)">✕</button>${sheetBody(d)}</div>`;
  app.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) h.onClose(); }); // 백드롭
  ov.querySelector(".cs-close")!.addEventListener("click", () => h.onClose());
  wireSheet(ov, d, h);
}
