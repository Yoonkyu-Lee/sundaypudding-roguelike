// 게임 흐름 셸 — 타이틀 / 집(허브) / 일시정지. 런(전투·맵)은 main.render가 담당, 셸은 그 바깥.
import { avatarHtml, esc } from "./battle/shared.ts";

export interface ShellHandlers {
  onStart: () => void; // 타이틀 → 허브(진입점 메뉴)
  onEditor: () => void; // 타이틀/허브 → 런 에디터
  onJobEditor: () => void; // 허브 메뉴 → 전직 트리 에디터 (개발자 도구)
  onEnterCampaign: () => void; // 허브 메뉴 → 캠페인 런 목록
  onCharDex: () => void; // 허브 메뉴 → 캐릭터 도감
  onHubBack: () => void; // 캠페인 목록 → 허브 메뉴
  onSelectRun: (id: string) => void; // 캠페인: 플레이할 런 선택
  onNewRun: () => void; // 캠페인: 선택 런을 고정 로스터로 시작
  onResumeRun: () => void; // 허브: 이어하기
  onAbandonRun: () => void; // 허브: 진행 중 런 포기
  onToHub: () => void; // 일시정지/승패 → 허브로(진행 유지)
  onResume: () => void; // 일시정지: 재개
  onToTitle: () => void; // → 타이틀
  onToggleChar: (charId: string) => void; // (비캠페인 모드용 — 자유 편성 토글, 현재 휴면)
}
/** 허브 하위 뷰: menu=진입점 모드 선택, campaign=캠페인 런 목록(고정 로스터). */
export type HubMode = "menu" | "campaign";
export interface HubMastery { level: number; xpInLevel: number; xpPerLevel: number; tier: number; }
export interface HubChar { charId: string; name: string; avatar?: string; mastery: HubMastery; selected: boolean; }
export interface HubRun { id: string; name: string; source: "repo" | "draft"; selected: boolean; }
export interface HubData {
  hubMode: HubMode; // menu=모드 선택 / campaign=런 목록
  pool: HubChar[]; // 선택 가능(playable) 캐릭 + 선택 여부 (비캠페인 모드용, 현재 휴면)
  selectedCount: number;
  maxRoster: number;
  runs: HubRun[]; // 캠페인 런 목록(mode==="campaign", repo + 드래프트)
  runName: string; // 현재 선택 런 이름
  forcedParty: { charId: string; name: string; avatar?: string }[]; // 선택 런의 고정 로스터(캠페인 = 주인공 강제)
  party: { charId: string; name: string; avatar?: string }[]; // runActive 시 현재 파티(읽기전용)
  runActive: boolean;
  floor?: number;
  totalFloors?: number;
}

/** 타이틀 스플래시. */
export function renderTitle(app: HTMLElement, h: ShellHandlers): void {
  app.innerHTML = `<div class="title-screen"><div class="title-box">
    <div class="title-logo">🍮 Sundaypudding<br>Roguelike</div>
    <button class="title-start" id="startbtn">▶ 시작</button>
    <button class="title-editor" id="editorbtn">🗺 런 에디터</button>
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

/** 허브 — 진입점 메뉴(모드 선택). 캠페인 입장 후에만 런 목록·고정 로스터 노출. 런 중 = 현재 파티+이어하기. */
export function renderHub(app: HTMLElement, d: HubData, h: ShellHandlers): void {
  let body: string;
  let header = "🏠 허브";
  if (d.runActive) {
    const cards = d.party.map((m) => `<div class="hub-mem">${avatarHtml(m.avatar, "avt")}<span class="hub-nm">${esc(m.name)}</span></div>`).join("");
    body = `<section class="hub-sec"><h2>현재 원정대 <span class="hint">런 진행 중 — 편성 잠금</span></h2><div class="hub-mems">${cards}</div></section>
      <div class="hub-controls"><button class="act" id="resumebtn">▶ 이어하기${d.floor ? ` (층 ${d.floor}/${d.totalFloors})` : ""}</button><button class="act ghost" id="abandonbtn">런 포기</button></div>`;
  } else if (d.hubMode === "menu") {
    // 진입점 메뉴 — 모드 선택. 캠페인만 활성, 나머지는 준비 중(회색).
    body = `<section class="hub-sec"><h2>모드 선택</h2>
        <div class="hub-modes">
          <button class="hub-mode" id="campaignbtn"><span class="hub-mode-ic">📜</span><span class="hub-mode-nm">캠페인</span><span class="hub-mode-dsc">야인시대 스토리 — 주인공이 정해진 런</span></button>
          <button class="hub-mode" id="hubchardexbtn"><span class="hub-mode-ic">📖</span><span class="hub-mode-nm">캐릭터 도감</span><span class="hub-mode-dsc">해금 캐릭터·스킬 트리 열람</span></button>
          <button class="hub-mode" disabled><span class="hub-mode-ic">⚔</span><span class="hub-mode-nm">일반 <span class="hub-soon">준비 중</span></span><span class="hub-mode-dsc">자유 편성으로 즐기는 런</span></button>
          <button class="hub-mode" disabled><span class="hub-mode-ic">🔥</span><span class="hub-mode-nm">챌린지 <span class="hub-soon">준비 중</span></span><span class="hub-mode-dsc">제약 조건 도전</span></button>
          <button class="hub-mode" id="hubeditorbtn"><span class="hub-mode-ic">🗺</span><span class="hub-mode-nm">런 에디터</span><span class="hub-mode-dsc">나만의 런 저작·테스트</span></button>
          <button class="hub-mode" id="hubjobedbtn"><span class="hub-mode-ic">🔀</span><span class="hub-mode-nm">전직 트리 에디터</span><span class="hub-mode-dsc">캐릭터 직업 트리 저작 (jobs.json)</span></button>
        </div></section>`;
  } else {
    // 캠페인 — 런 목록 + 선택 런의 고정 로스터 미리보기. 자유 편성 없음(주인공 강제).
    header = "📜 캠페인";
    const runBtns = d.runs.map((r) => `<button class="hub-run${r.selected ? " on" : ""}" data-run="${r.id}">${esc(r.name)}<span class="hub-run-src">${r.source === "draft" ? "드래프트" : "repo"}</span></button>`).join("") || `<div class="hint">캠페인 런이 없습니다.</div>`;
    const roster = d.forcedParty.map((m) => `<div class="hub-mem">${avatarHtml(m.avatar, "avt")}<span class="hub-nm">${esc(m.name)}</span></div>`).join("");
    const ok = d.runs.length > 0;
    body = `<section class="hub-sec"><h2>캠페인 런 <span class="hint">스토리 — 주인공 편성 고정</span></h2>
        <div class="hub-runs">${runBtns}</div></section>
      <section class="hub-sec"><h2>출전 <span class="hint">이 런의 정해진 주인공</span></h2>
        <div class="hub-mems">${roster}</div></section>
      <div class="hub-controls"><button class="act ghost" id="hubbackbtn">← 모드</button><button class="act" id="newrunbtn"${ok ? "" : " disabled"}>⚔ ${esc(d.runName)} 시작</button></div>`;
  }
  app.innerHTML = `<div class="hub">
    <header><h1>${header}</h1><button class="hub-link" id="totitlebtn">타이틀로</button></header>
    <div class="hub-body">${body}</div>
  </div>`;
  app.querySelector("#campaignbtn")?.addEventListener("click", () => h.onEnterCampaign());
  app.querySelector("#hubchardexbtn")?.addEventListener("click", () => h.onCharDex());
  app.querySelector("#hubeditorbtn")?.addEventListener("click", () => h.onEditor());
  app.querySelector("#hubjobedbtn")?.addEventListener("click", () => h.onJobEditor());
  app.querySelector("#hubbackbtn")?.addEventListener("click", () => h.onHubBack());
  app.querySelector("#newrunbtn")?.addEventListener("click", () => h.onNewRun());
  app.querySelector("#resumebtn")?.addEventListener("click", () => h.onResumeRun());
  app.querySelector("#abandonbtn")?.addEventListener("click", () => h.onAbandonRun());
  app.querySelector("#totitlebtn")!.addEventListener("click", () => h.onToTitle());
  app.querySelectorAll<HTMLElement>(".hub-run[data-run]").forEach((el) => el.addEventListener("click", () => h.onSelectRun(el.dataset.run!)));
}

/** 오류 알림 오버레이 (게임 내 — 네이티브 alert 대체, 게임-티 금지). 백드롭/확인 = 닫기. */
export function renderError(app: HTMLElement, message: string, onDismiss: () => void): void {
  app.querySelector(".pause-overlay")?.remove();
  const ov = document.createElement("div");
  ov.className = "pause-overlay";
  ov.innerHTML = `<div class="pause-box" role="alertdialog"><h2>⚠ 시작할 수 없음</h2><p class="err-msg">${esc(message)}</p><button class="act" id="errok">확인</button></div>`;
  app.appendChild(ov);
  const close = () => { ov.remove(); onDismiss(); };
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector("#errok")!.addEventListener("click", close);
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
