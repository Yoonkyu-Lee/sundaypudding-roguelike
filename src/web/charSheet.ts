// 캐릭터 시트 (모달 오버레이). 맵·전투 공용 — 능력치·장착·보유 스킬을 펼쳐서 조회/관리.
// 호출자가 baseStats·현재 HP·equipped·inventory·skills를 조립 → 시트는 장착 보정(현재값)·델타·픽커 렌더.
// 장착 메커니즘(슬라이스2): 맵 editable이면 슬롯에 장착/교체/해제, 전투는 읽기전용.
import type { EquipSlot, ItemDef } from "../core/types.ts";
import { ITEMS } from "../data/items.ts";
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
}
export interface SheetData {
  charId: string;
  name: string;
  avatar?: string;
  hp: number; // 현재 HP
  hpMax: number; // 현재 maxHp (장착 반영)
  base: SheetBaseStats; // 원본(장착 전)
  equipped: { weapon?: string; armor?: string; held?: string };
  inventory: string[]; // 미장착 보유 아이템
  skills: SheetSkill[];
  activeCount: number;
  editable: boolean; // 맵=장착/활성4 조작, 전투=읽기전용
}
export interface SheetHandlers {
  onToggle: (charId: string, skillId: string) => void;
  onEquip: (charId: string, slot: EquipSlot, itemId: string) => void;
  onUnequip: (charId: string, slot: EquipSlot) => void;
  onClose: () => void;
}

const SLOTS: { key: EquipSlot; label: string; locked?: boolean }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "held", label: "지닌 물건", locked: true },
];

/** 아이템 보정을 한 줄 설명으로 (무기/방어구 효과 투명 표기). */
function itemDesc(it: ItemDef): string {
  const p: string[] = [];
  if (it.dmgFlat) p.push(`공격 +${it.dmgFlat}`);
  const m = it.mods;
  if (m?.hp) p.push(`HP +${m.hp}`);
  if (it.shieldGainAdd) p.push(`쉴드획득 +${it.shieldGainAdd}`);
  if (m?.critChance) p.push(`치명 +${m.critChance}%`);
  if (m?.critMultiplier) p.push(`치명배수 +${r1(m.critMultiplier)}`);
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

// 능력치 행 — 원본→현재 병기(0.2). 보정 있으면 강조.
function statRows(d: SheetData): string {
  const b = d.base, e = effective(b, d.equipped);
  const row = (label: string, baseV: string, curV: string, hint = "") => {
    const changed = baseV !== curV;
    const val = changed ? `<span class="csbase">${baseV}</span><span class="csarrow">→</span><span class="csval up">${curV}</span>` : `<span class="csval">${curV}</span>`;
    return `<div class="csstat"><span class="cslabel">${label}</span>${val}${hint ? `<span class="cshint">${hint}</span>` : ""}</div>`;
  };
  return [
    row("체력", `${b.hp}`, `${d.hp}/${d.hpMax}`),
    row("속도", `${b.speedMin}~${b.speedMax}`, `${e.speedMin}~${e.speedMax}`, "라운드 주사위"),
    row("회피", `${b.evasion}`, `${e.evasion}`, "명중에서 차감"),
    row("명중", `${b.accuracy}`, `${e.accuracy}`, "기본 0 + 스킬"),
    row("치명%", `${b.critChance}%`, `${e.critChance}%`),
    row("치명배수", `×${r1(b.critMultiplier)}`, `×${r1(e.critMultiplier)}`),
  ].join("");
}

function slotBlock(d: SheetData, sl: { key: EquipSlot; label: string; locked?: boolean }): string {
  if (sl.locked) return `<div class="csslot locked"><span class="csslotname">${sl.label}</span><span class="csslotval">🔒 후속</span></div>`;
  const curId = d.equipped[sl.key];
  const cur = curId ? ITEMS[curId] : undefined;
  const equippedHtml = cur
    ? `<div class="csslot-eq"><span class="csslot-item">${cur.icon ?? "📦"} ${esc(cur.name)}</span>${d.editable ? `<button class="csslot-off" data-unequip="${sl.key}">해제</button>` : ""}</div><div class="csslot-desc">${itemDesc(cur)}</div>`
    : `<span class="csslotval">(없음)</span>`;
  // 인벤토리에서 이 슬롯 장착 가능 후보 (editable일 때만)
  const cands = d.editable
    ? d.inventory.map((id) => ITEMS[id]).filter((it): it is ItemDef => !!it && it.slot === sl.key)
    : [];
  const pick = cands.length
    ? `<div class="csslot-pick">${cands.map((it) => `<button class="csslot-cand" data-equip-slot="${sl.key}" data-equip-item="${it.id}" title="${itemDesc(it)}">${it.icon ?? "📦"} ${esc(it.name)}</button>`).join("")}</div>`
    : "";
  return `<div class="csslot${cur ? " filled" : ""}"><span class="csslotname">${sl.label}</span>${equippedHtml}${pick}</div>`;
}

function skillList(d: SheetData): string {
  const items = d.skills
    .map((s) => {
      const tag = s.signature ? `<span class="csk-tag sig">전용기</span>` : `<span class="csk-tag univ">범용기</span>`;
      const up = s.canUpgrade ? `<span class="csk-up" title="강화 가능">⬆</span>` : "";
      const btn = d.editable
        ? `<button class="csk-toggle${s.active ? " on" : ""}" data-sheet-skill="${s.id}">${s.active ? "활성" : "대기"}</button>`
        : `<span class="csk-state${s.active ? " on" : ""}">${s.active ? "활성" : "대기"}</span>`;
      return `<div class="csk-row${s.active ? " active" : ""}"><span class="csk-name">${esc(s.name)}${s.tier > 1 ? `<sup>T${s.tier}</sup>` : ""}</span>${tag}${up}${btn}</div>`;
    })
    .join("");
  const hint = d.editable ? `<span class="cshint">최대 4개 활성 (현재 ${d.activeCount}/4)</span>` : `<span class="cshint">전투 중 — 변경은 맵에서</span>`;
  return `<div class="cssection"><h4>보유 스킬 ${hint}</h4><div class="csk-list">${items}</div></div>`;
}

/** 시트 본문(머리+능력치/장착/스킬) — 단독 모달·파티뷰 상세 pane 공용. 닫기/오버레이 크롬 제외. */
export function sheetBody(d: SheetData): string {
  return `<div class="cshead">${avatarHtml(d.avatar, "avt")}<h3>${esc(d.name)}</h3></div>
    <div class="csbody">
      <div class="cssection"><h4>능력치</h4><div class="csstats">${statRows(d)}</div></div>
      <div class="cssection"><h4>장착</h4><div class="csslots">${SLOTS.map((sl) => slotBlock(d, sl)).join("")}</div></div>
      ${skillList(d)}
    </div>`;
}

/** 시트 조작 와이어링 — scope 내 스킬 토글/장착/해제 (editable일 때만). */
export function wireSheet(scope: HTMLElement, d: SheetData, h: SheetHandlers): void {
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
  ov.innerHTML = `<div class="charsheet" role="dialog"><button class="cs-close" title="닫기 (Esc)">✕</button>${sheetBody(d)}</div>`;
  app.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) h.onClose(); }); // 백드롭
  ov.querySelector(".cs-close")!.addEventListener("click", () => h.onClose());
  wireSheet(ov, d, h);
}
