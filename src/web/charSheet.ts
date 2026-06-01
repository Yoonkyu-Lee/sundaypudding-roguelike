// 캐릭터 시트 (모달 오버레이). 맵·전투 공용 — 스탯·장착칸·보유 스킬을 펼쳐서 조회.
// 호출자가 SheetData를 조립(맵=RunView+CHARACTERS, 전투=battle.units+CHARACTERS) → 렌더만 담당.
// 슬라이스1: 장착칸은 플레이스홀더(빈칸/지닌물건 잠금). 슬라이스2에서 실제 장착 채움.
import { avatarHtml, esc, r1 } from "./battle/shared.ts";

export interface SheetStats {
  hp: number;
  hpMax: number;
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
  stats: SheetStats;
  skills: SheetSkill[];
  activeCount: number;
  editable: boolean; // 활성4 토글 가능(맵에서만)
}
export interface SheetHandlers {
  onToggle: (charId: string, skillId: string) => void;
  onClose: () => void;
}

// 능력치 행 (원본→현재 병기 자리 — 슬라이스1은 보정원 없어 원본=현재)
function statRows(s: SheetStats): string {
  const row = (label: string, val: string, hint = "") =>
    `<div class="csstat"><span class="cslabel">${label}</span><span class="csval">${val}</span>${hint ? `<span class="cshint">${hint}</span>` : ""}</div>`;
  return [
    row("체력", `${s.hp}/${s.hpMax}`),
    row("속도", `${s.speedMin}~${s.speedMax}`, "라운드 주사위 범위"),
    row("회피", `${s.evasion}`, "명중에서 차감"),
    row("명중", `${s.accuracy}`, "기본 0 + 스킬 내장"),
    row("치명%", `${s.critChance}%`),
    row("치명배수", `×${r1(s.critMultiplier)}`),
  ].join("");
}

const SLOTS: { key: string; label: string; locked?: boolean }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "held", label: "지닌 물건", locked: true },
];

function equipSlots(): string {
  // 슬라이스1: 전부 빈칸(지닌물건은 잠금). 슬라이스2에서 장착 아이템으로 채움.
  return SLOTS.map(
    (sl) =>
      `<div class="csslot${sl.locked ? " locked" : ""}"><span class="csslotname">${sl.label}</span><span class="csslotval">${sl.locked ? "🔒 후속" : "(없음)"}</span></div>`,
  ).join("");
}

function skillList(d: SheetData, h: SheetHandlers): string {
  const items = d.skills
    .map((s) => {
      const tag = s.signature ? `<span class="csk-tag sig">전용기</span>` : `<span class="csk-tag univ">범용기</span>`;
      const up = s.canUpgrade ? `<span class="csk-up" title="강화 가능">⬆</span>` : "";
      const btn = d.editable
        ? `<button class="csk-toggle${s.active ? " on" : ""}" data-sheet-skill="${s.id}">${s.active ? "활성" : "대기"}</button>`
        : `<span class="csk-state${s.active ? " on" : ""}">${s.active ? "활성" : "대기"}</span>`;
      return `<div class="csk-row${s.active ? " active" : ""}">
        <span class="csk-name">${esc(s.name)}${s.tier > 1 ? `<sup>T${s.tier}</sup>` : ""}</span>
        ${tag}${up}${btn}
      </div>`;
    })
    .join("");
  const hint = d.editable
    ? `<span class="cshint">전투 전 최대 4개 활성 (현재 ${d.activeCount}/4)</span>`
    : `<span class="cshint">전투 중 — 활성 변경은 맵에서</span>`;
  return `<div class="cssection"><h4>보유 스킬 ${hint}</h4><div class="csk-list">${items}</div></div>`;
}

export function renderCharSheet(app: HTMLElement, d: SheetData, h: SheetHandlers): void {
  app.querySelector(".charsheet-overlay")?.remove(); // 중복 방지
  const ov = document.createElement("div");
  ov.className = "charsheet-overlay";
  ov.innerHTML = `<div class="charsheet" role="dialog">
    <button class="cs-close" title="닫기 (Esc)">✕</button>
    <div class="cshead">${avatarHtml(d.avatar, "avt")}<h3>${esc(d.name)}</h3></div>
    <div class="csbody">
      <div class="cssection"><h4>능력치</h4><div class="csstats">${statRows(d.stats)}</div></div>
      <div class="cssection"><h4>장착</h4><div class="csslots">${equipSlots()}</div></div>
      ${skillList(d, h)}
    </div>
  </div>`;
  app.appendChild(ov);

  ov.addEventListener("click", (e) => { if (e.target === ov) h.onClose(); }); // 백드롭 클릭 닫기
  ov.querySelector(".cs-close")!.addEventListener("click", () => h.onClose());
  if (d.editable)
    ov.querySelectorAll<HTMLButtonElement>("[data-sheet-skill]").forEach((b) =>
      b.addEventListener("click", () => h.onToggle(d.charId, b.dataset.sheetSkill!)),
    );
}
