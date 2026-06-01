// 게임 흐름 셸 — 타이틀 / 집(허브) / 일시정지. 런(전투·맵)은 main.render가 담당, 셸은 그 바깥.
import { avatarHtml, esc } from "./battle/shared.ts";

export interface ShellHandlers {
  onStart: () => void; // 타이틀 → 집
  onNewRun: () => void; // 집: 새 런 시작
  onResumeRun: () => void; // 집: 이어하기
  onAbandonRun: () => void; // 집: 진행 중 런 포기
  onToHub: () => void; // 일시정지/승패 → 집으로(진행 유지)
  onResume: () => void; // 일시정지: 재개
  onToTitle: () => void; // → 타이틀
}
export interface HubData {
  roster: { charId: string; name: string; avatar?: string }[];
  runActive: boolean;
  act?: number;
  totalActs?: number;
}

/** 타이틀 스플래시. */
export function renderTitle(app: HTMLElement, h: ShellHandlers): void {
  app.innerHTML = `<div class="title-screen"><div class="title-box">
    <div class="title-logo">🍮 Sunday Pudding<br>Roguelike</div>
    <div class="title-sub">야인시대 로스터로 3개 액트를 돌파하라</div>
    <button class="title-start" id="startbtn">▶ 시작</button>
  </div></div>`;
  app.querySelector("#startbtn")!.addEventListener("click", () => h.onStart());
}

/** 집(허브) — 플레이어의 본거지. 로스터·숙련도(준비 중)·런 시작/이어하기. */
export function renderHub(app: HTMLElement, d: HubData, h: ShellHandlers): void {
  const cards = d.roster
    .map((m) => `<div class="hub-mem">${avatarHtml(m.avatar, "avt")}<span class="hub-nm">${esc(m.name)}</span></div>`)
    .join("");
  const controls = d.runActive
    ? `<button class="act" id="resumebtn">▶ 이어하기${d.act ? ` (액트 ${d.act}/${d.totalActs})` : ""}</button><button class="act ghost" id="abandonbtn">런 포기</button>`
    : `<button class="act" id="newrunbtn">⚔ 새 런 시작</button>`;
  app.innerHTML = `<div class="hub">
    <header><h1>🏠 본거지</h1><button class="hub-link" id="totitlebtn">타이틀로</button></header>
    <div class="hub-body">
      <section class="hub-sec"><h2>파티</h2><div class="hub-mems">${cards}</div></section>
      <section class="hub-sec"><h2>숙련도</h2><div class="hint">준비 중 — 영구 성장(숙련도 tier 해금, 4.4)은 다음 업데이트</div></section>
      <div class="hub-controls">${controls}</div>
    </div>
  </div>`;
  app.querySelector("#newrunbtn")?.addEventListener("click", () => h.onNewRun());
  app.querySelector("#resumebtn")?.addEventListener("click", () => h.onResumeRun());
  app.querySelector("#abandonbtn")?.addEventListener("click", () => h.onAbandonRun());
  app.querySelector("#totitlebtn")!.addEventListener("click", () => h.onToTitle());
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
