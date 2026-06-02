// 게임 흐름 셸 — 타이틀 / 집(허브) / 일시정지. 런(전투·맵)은 main.render가 담당, 셸은 그 바깥.
import { avatarHtml, esc } from "./battle/shared.ts";

export interface ShellHandlers {
  onStart: () => void; // 타이틀 → 집
  onEditor: () => void; // 타이틀 → 맵 에디터
  onNewRun: () => void; // 집: 새 런 시작
  onResumeRun: () => void; // 집: 이어하기
  onAbandonRun: () => void; // 집: 진행 중 런 포기
  onToHub: () => void; // 일시정지/승패 → 집으로(진행 유지)
  onResume: () => void; // 일시정지: 재개
  onToTitle: () => void; // → 타이틀
  onToggleChar: (charId: string) => void; // 집: 편성 선택 토글
}
export interface HubMastery { level: number; xpInLevel: number; xpPerLevel: number; tier: number; }
export interface HubChar { charId: string; name: string; avatar?: string; mastery: HubMastery; selected: boolean; }
export interface HubData {
  pool: HubChar[]; // 선택 가능(playable) 캐릭 + 선택 여부
  selectedCount: number;
  maxRoster: number;
  party: { charId: string; name: string; avatar?: string }[]; // runActive 시 현재 파티(읽기전용)
  runActive: boolean;
  floor?: number;
  totalFloors?: number;
}

/** 타이틀 스플래시. */
export function renderTitle(app: HTMLElement, h: ShellHandlers): void {
  app.innerHTML = `<div class="title-screen"><div class="title-box">
    <div class="title-logo">🍮 Sundaypudding<br>Roguelike</div>
    <div class="title-sub">야인시대 로스터로 3개 액트를 돌파하라</div>
    <button class="title-start" id="startbtn">▶ 시작</button>
    <button class="title-editor" id="editorbtn">🗺 맵 에디터</button>
  </div></div>`;
  app.querySelector("#startbtn")!.addEventListener("click", () => h.onStart());
  app.querySelector("#editorbtn")!.addEventListener("click", () => h.onEditor());
}

// 편성 선택 카드 (playable 캐릭) — 클릭=토글. 숙련도 Lv/해금 tier 표시.
function poolCard(m: HubChar): string {
  const pct = Math.round((m.mastery.xpInLevel / m.mastery.xpPerLevel) * 100);
  return `<button class="hub-pick${m.selected ? " on" : ""}" data-pick="${m.charId}" aria-label="${m.selected ? "편성 해제" : "편성에 추가"}">
    <span class="hub-pick-check">${m.selected ? "✓" : ""}</span>
    ${avatarHtml(m.avatar, "avt")}<span class="hub-nm">${esc(m.name)}</span>
    <span class="hub-pick-lv">Lv ${m.mastery.level} · 해금 T${m.mastery.tier}</span>
    <span class="hub-mst-bar"><span class="hub-mst-fill" style="width:${pct}%"></span></span>
  </button>`;
}

/** 집(허브) — 플레이어의 본거지. 편성 중 = 캐릭터 선택(1~max), 런 중 = 현재 파티+이어하기. */
export function renderHub(app: HTMLElement, d: HubData, h: ShellHandlers): void {
  let body: string;
  if (d.runActive) {
    const cards = d.party.map((m) => `<div class="hub-mem">${avatarHtml(m.avatar, "avt")}<span class="hub-nm">${esc(m.name)}</span></div>`).join("");
    body = `<section class="hub-sec"><h2>현재 원정대 <span class="hint">런 진행 중 — 편성 잠금</span></h2><div class="hub-mems">${cards}</div></section>
      <div class="hub-controls"><button class="act" id="resumebtn">▶ 이어하기${d.floor ? ` (층 ${d.floor}/${d.totalFloors})` : ""}</button><button class="act ghost" id="abandonbtn">런 포기</button></div>`;
  } else {
    const grid = d.pool.map(poolCard).join("");
    const ok = d.selectedCount >= 1;
    body = `<section class="hub-sec"><h2>편성 <span class="hint">최소 1 · 최대 ${d.maxRoster}명 선택 — 숙련도는 전투 승리로 영구 성장(4.4)</span></h2>
        <div class="hub-pickgrid">${grid}</div>
        <div class="hub-pickcount">선택 ${d.selectedCount}/${d.maxRoster}</div></section>
      <div class="hub-controls"><button class="act" id="newrunbtn"${ok ? "" : " disabled"}>⚔ 새 런 시작</button></div>`;
  }
  app.innerHTML = `<div class="hub">
    <header><h1>🏠 본거지</h1><button class="hub-link" id="totitlebtn">타이틀로</button></header>
    <div class="hub-body">${body}</div>
  </div>`;
  app.querySelector("#newrunbtn")?.addEventListener("click", () => h.onNewRun());
  app.querySelector("#resumebtn")?.addEventListener("click", () => h.onResumeRun());
  app.querySelector("#abandonbtn")?.addEventListener("click", () => h.onAbandonRun());
  app.querySelector("#totitlebtn")!.addEventListener("click", () => h.onToTitle());
  app.querySelectorAll<HTMLElement>(".hub-pick[data-pick]").forEach((el) => el.addEventListener("click", () => h.onToggleChar(el.dataset.pick!)));
}

/** 일시정지 오버레이 (런 화면 위에 덧댐). */
export function renderPause(app: HTMLElement, h: ShellHandlers): void {
  app.querySelector(".pause-overlay")?.remove();
  const ov = document.createElement("div");
  ov.className = "pause-overlay";
  ov.innerHTML = `<div class="pause-box" role="dialog">
    <h2>일시정지</h2>
    <button class="act" id="presume">▶ 재개</button>
    <button class="act" id="phome">🏠 집으로 (진행 유지)</button>
    <button class="act ghost" id="ptitle">타이틀로 (런 포기)</button>
  </div>`;
  app.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) h.onResume(); }); // 백드롭=재개
  ov.querySelector("#presume")!.addEventListener("click", () => h.onResume());
  ov.querySelector("#phome")!.addEventListener("click", () => h.onToHub());
  ov.querySelector("#ptitle")!.addEventListener("click", () => h.onToTitle());
}
