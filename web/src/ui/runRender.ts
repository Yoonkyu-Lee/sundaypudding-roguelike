// 런 화면 렌더 (맵/보상/결과). 전투 화면은 render.ts(renderApp)가 담당.
import type { RunView } from "../contract/run.ts";
import { hexAdjacent } from "../contract/run.ts";
import { avatarHtml } from "./render.ts";
import { TYPE_ICON, TYPE_NAME } from "./nodeMeta.ts";
import { attachCamera } from "./camera.ts";
import { cornerOffsets, edgeDirIndex } from "./hexgeo.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// 인게임 맵 카메라 — 모듈 영속(같은 층 내 재렌더에도 줌/팬 유지). 층 바뀌면 리셋(NaN=중앙 정렬).
let mapCam = { zoom: 1, x: NaN, y: NaN };
let mapKey = "";

export interface RunHandlers {
  onNode: (id: string) => void;
  onReward: (id: string) => void;
  onRestart: () => void;
  onToggleSkill: (charId: string, skillId: string) => void; // 로드아웃 활성 토글
  onBuy: (offerId: string) => void; // 상점 구매
  onLeaveShop: () => void; // 상점 나가기
  onEncounterChoice: (choiceId: string) => void; // 인카운터 선택
  onClassChange: (charId: string, toJobId: string) => void; // 전직(4.7) — 한 명 전직
  onClassChangeSkip: () => void; // 전직 건너뛰기
  onOpenParty: (charId: string) => void; // 파티 편성(통합 파티뷰) 열기 — 해당 캐릭 선택
  onToHub: () => void; // 승패 화면 → 집으로
  onPause: () => void; // 일시정지 메뉴 열기
}


function partyPanel(view: RunView): string {
  // 요약만 — 상세(스탯·장착·활성4 관리)는 클릭 시 캐릭터 시트(모달)로. (slice1)
  const rows = view.party
    .map((m) => {
      const pct = Math.max(0, (m.hp / m.maxHp) * 100);
      const cls = m.alive ? "" : " dead";
      const active = m.skills
        .filter((s) => s.active)
        .map((s) => `<span class="lchip${s.signature ? " sig" : " univ"}">${esc(s.name)}${s.tier > 1 ? `<sup>${s.tier}</sup>` : ""}</span>`)
        .join("");
      return `<button class="pmember${cls}" data-sheet="${m.charId}" aria-label="${esc(m.name)} 상세 보기">
        <div class="prow">
          <span class="pname">${avatarHtml(m.avatar, "avt sm")}${esc(m.name)}</span>
          <div class="phpbar"><div class="php" style="width:${pct}%"></div></div>
          <span class="phptext">${m.hp}/${m.maxHp}</span>
          <span class="pmore">자세히 ▸</span>
        </div>
        <div class="lskills"><span class="lcount">활성 ${m.activeCount}/4</span>${active}</div>
      </button>`;
    })
    .join("");
  const editBtn = view.party.length ? `<button class="party-edit" data-party-edit="${view.party[0].charId}">⚙ 파티 편성 ▸</button>` : "";
  // 런 자원 게이지(R1) — 골드 아래 바. 비면 생략.
  const gauges = (view.resources ?? []).map((r) => {
    const pct = r.max > r.min ? Math.max(0, Math.min(100, ((r.value - r.min) / (r.max - r.min)) * 100)) : 0;
    return `<div class="resgauge"><span class="reslabel">${r.icon ? `${r.icon} ` : ""}${esc(r.name)}</span><span class="resbar"><span class="resfill" style="width:${pct}%"></span></span><span class="resval">${r.value}/${r.max}</span></div>`;
  }).join("");
  const resBlock = gauges ? `<div class="resgauges">${gauges}</div>` : "";
  return `<div class="party"><h3>파티 <span class="goldtag">💰 ${view.gold}G</span></h3>${resBlock}${rows}${editBtn}</div>`;
}

function shopScreen(view: RunView): string {
  const items = (view.shop ?? [])
    .map((o) => {
      const afford = view.gold >= o.cost;
      return `<button class="shopitem${afford ? "" : " broke"}" ${afford ? `data-buy="${o.id}"` : "disabled"}>
        <span class="shoplabel">${esc(o.label)}</span><span class="shopcost">${o.cost}G</span>
      </button>`;
    })
    .join("");
  return `<div class="shop"><h2>🛒 상점 <span class="goldtag">보유 💰 ${view.gold}G</span></h2>
    <div class="shopitems">${items || "<div class='hint'>살 수 있는 게 없다.</div>"}</div>
    <button class="act" id="leaveshop">나가기 →</button></div>`;
}

function encounterScreen(view: RunView): string {
  const ev = view.encounter;
  if (!ev) return "";
  const choices = ev.choices.map((c) => `<button class="enchoice${c.available ? "" : " locked"}" data-choice="${c.id}"${c.available ? "" : " disabled"}>${esc(c.label)}${!c.available && c.requiresLabel ? `<span class="enc-req">🔒 ${esc(c.requiresLabel)}</span>` : ""}</button>`).join("");
  return `<div class="encounter"><h2>❓ ${esc(ev.title)}</h2><p class="enctext">${esc(ev.text)}</p><div class="encchoices">${choices}</div></div>`;
}

function logPanel(view: RunView): string {
  return `<div class="runlog">${view.log.map((l) => esc(l)).join("<br>")}</div>`;
}

function mapScreen(view: RunView, h: RunHandlers): string {
  // axial(q,r) → 픽셀 (pointy-top): x=W*(q+r/2), y=1.5*size*r. 자유 방향그래프 — 간선은 화살표로 명시.
  const SIZE = 46;
  const W = Math.sqrt(3) * SIZE; // 헥스 폭
  const H = 2 * SIZE; // 헥스 높이
  const PAD = W; // 가장자리 여백(음수 좌표 노드도 잘리지 않게)
  const pos = view.nodes.map((n) => ({ n, x: W * (n.q + n.r / 2), y: SIZE * 1.5 * n.r }));
  const minX = Math.min(...pos.map((p) => p.x));
  const minY = Math.min(...pos.map((p) => p.y));
  const cw = Math.max(...pos.map((p) => p.x)) - minX + W + PAD * 2;
  const ch = Math.max(...pos.map((p) => p.y)) - minY + H + PAD * 2;
  const px = (x: number) => x - minX + PAD;
  const py = (y: number) => y - minY + PAD;

  // 노드 id → 중심좌표(카메라 초기 중앙 정렬 + 벽 기하). 연결선(열린 길)은 표시 안 함 — reachable 발광으로.
  const ctr = new Map(pos.map((p) => [p.n.id, { x: px(p.x) + W / 2, y: py(p.y) + H / 2 }]));

  // 벽 = 인접(맞닿은)하지만 변(edge)이 없는 노드쌍 = 막힌 길. 에디터와 동일 개념, hexgeo 기하 공유(SIZE만 다름).
  const connected = new Set(view.edges.map((e) => (e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`)));
  const corners = cornerOffsets(SIZE);
  const ns = view.nodes;
  const wallSegs: string[] = [];
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j];
    if (!hexAdjacent(a, b)) continue;
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (connected.has(key)) continue; // 열린 길 — 벽 아님
    const ei = edgeDirIndex(b.q - a.q, b.r - a.r); // a 기준 b를 향한 변
    if (ei < 0) continue;
    const ca = ctr.get(a.id)!, o1 = corners[ei], o2 = corners[(ei + 1) % 6];
    wallSegs.push(`<line x1="${(ca.x + o1.x).toFixed(1)}" y1="${(ca.y + o1.y).toFixed(1)}" x2="${(ca.x + o2.x).toFixed(1)}" y2="${(ca.y + o2.y).toFixed(1)}"/>`);
  }
  const wallsSvg = wallSegs.length ? `<svg class="mwalls" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}">${wallSegs.join("")}</svg>` : "";

  const hexes = pos
    .map(({ n, x, y }) => {
      const clickable = n.status === "reachable";
      const attrs = clickable ? `data-node="${n.id}"` : "disabled";
      return `<button class="mnode ${n.status} ${n.type}"
        style="left:${px(x)}px;top:${py(y)}px;width:${W}px;height:${H}px"
        ${attrs} data-uid="${n.id}" aria-label="${esc(n.label ?? TYPE_NAME[n.type])}">
        <span class="mhex">
          <span class="mico">${TYPE_ICON[n.type]}</span>
          <span class="mlabel">${esc(n.label ?? TYPE_NAME[n.type])}</span>
          ${n.status === "visited" ? '<span class="mdone">✓</span>' : ""}
          ${n.status === "current" ? '<span class="mhere">▾</span>' : ""}
        </span>
      </button>`;
    })
    .join("");
  // 카메라 초기 중앙 = 현재 위치 노드(없으면 콘텐츠 중앙)
  const curId = view.nodes.find((n) => n.status === "current")?.id;
  const cc = curId ? ctr.get(curId) : null;
  const dataCtr = cc ? ` data-cx="${cc.x.toFixed(1)}" data-cy="${cc.y.toFixed(1)}"` : "";
  return `<div class="mapview">
    <div class="hexfield" id="run-field" style="width:${cw}px;height:${ch}px"${dataCtr}>${hexes}${wallsSvg}</div>
    <div class="ed-zoom"><button id="map-zin" aria-label="확대">＋</button><button id="map-zout" aria-label="축소">－</button><button id="map-zreset" aria-label="리셋">⤢</button></div>
    <div class="ed-vphint">휠=줌 · 드래그=이동</div>
  </div>
  <div class="hint">맞닿은 길을 따라 클리어(🚩) 노드에 도달하면 층 완료(지나온 칸은 잠김). 빛나는 육각 셀을 클릭하세요.</div>`;
}

function rewardScreen(view: RunView, h: RunHandlers): string {
  const cards = (view.rewards ?? [])
    .map((r) => `<button class="rwcard" data-reward="${r.id}">${esc(r.label)}</button>`)
    .join("");
  return `<div class="reward"><h2>🎁 보상 선택 (1개)</h2><div class="rwcards">${cards}</div></div>`;
}

function classChangeScreen(view: RunView): string {
  const cc = view.classChange;
  if (!cc) return "";
  const groups = cc.candidates
    .map((c) => {
      const opts = c.options
        .map((o) => `<button class="rwcard" data-cc-char="${esc(c.charId)}" data-cc-job="${esc(o.id)}">${esc(c.name)} → 「${esc(o.name)}」</button>`)
        .join("");
      return `<div class="ccgroup"><div class="ccwho">${esc(c.name)}${c.jobName ? ` <span class="ccnow">현재: ${esc(c.jobName)}</span>` : ""}</div><div class="rwcards">${opts}</div></div>`;
    })
    .join("");
  const body = cc.candidates.length ? groups : "<div class='hint'>전직 가능한 인원이 없다.</div>";
  return `<div class="reward classchange"><h2>🔀 전직 <span class="goldtag">남은 인원 ${cc.remaining}</span></h2>${body}<button class="act" id="ccskip">건너뛰기 →</button></div>`;
}

function endScreen(view: RunView): string {
  const won = view.phase === "won";
  return `<div class="endscreen ${won ? "won" : "lost"}">
    <div class="endbig">${won ? "🏆 전 층 클리어! 게임 승리!" : "💀 전멸 — 런 실패"}</div>
    <button class="act" id="tohub">🏠 집으로</button>
  </div>`;
}

export function renderRunScreen(app: HTMLElement, view: RunView, h: RunHandlers): void {
  let body = "";
  if (view.phase === "won" || view.phase === "lost") body = endScreen(view);
  else if (view.phase === "reward") body = rewardScreen(view, h);
  else if (view.phase === "shop") body = shopScreen(view);
  else if (view.phase === "encounter") body = encounterScreen(view);
  else if (view.phase === "classChange") body = classChangeScreen(view);
  else body = mapScreen(view, h);

  app.innerHTML = `
    <header>
      <h1>🍮 Sundaypudding Roguelike</h1>
      <div class="meta">${view.phase === "won" || view.phase === "lost" ? "" : `층 ${view.floor}/${view.totalFloors} · `}${view.phase === "map" ? "맵 — 경로 선택" : view.phase === "classChange" ? "전직" : view.phase}${view.phase === "won" || view.phase === "lost" ? "" : ` <button class="hdr-menu" id="pausebtn" aria-label="메뉴 (Esc)">⏸</button>`}</div>
    </header>
    <div class="runlayout">
      <div class="runmain">${body}</div>
      <aside class="runside">${partyPanel(view)}${logPanel(view)}</aside>
    </div>
  `;

  app.querySelectorAll<HTMLButtonElement>("[data-node]").forEach((b) =>
    b.addEventListener("click", () => h.onNode(b.dataset.node!)),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-reward]").forEach((b) =>
    b.addEventListener("click", () => h.onReward(b.dataset.reward!)),
  );
  app.querySelectorAll<HTMLButtonElement>(".pmember[data-sheet]").forEach((b) =>
    b.addEventListener("click", () => h.onOpenParty(b.dataset.sheet!)),
  );
  app.querySelector<HTMLButtonElement>("[data-party-edit]")?.addEventListener("click", (e) =>
    h.onOpenParty((e.currentTarget as HTMLElement).dataset.partyEdit!),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) =>
    b.addEventListener("click", () => h.onBuy(b.dataset.buy!)),
  );
  app.querySelector("#leaveshop")?.addEventListener("click", () => h.onLeaveShop());
  app.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((b) =>
    b.addEventListener("click", () => h.onEncounterChoice(b.dataset.choice!)),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-cc-job]").forEach((b) =>
    b.addEventListener("click", () => h.onClassChange(b.dataset.ccChar!, b.dataset.ccJob!)),
  );
  app.querySelector("#ccskip")?.addEventListener("click", () => h.onClassChangeSkip());
  app.querySelector("#tohub")?.addEventListener("click", () => h.onToHub());
  app.querySelector("#pausebtn")?.addEventListener("click", () => h.onPause());

  // 맵 뷰포트 카메라(고정 크기 + 휠 줌 + 드래그 팬). 층 바뀌면 카메라 리셋(중앙 정렬).
  if (view.phase === "map") {
    const mvp = app.querySelector<HTMLElement>(".mapview");
    const field = app.querySelector<HTMLElement>("#run-field");
    if (mvp && field) {
      const key = `${view.floor}:${view.nodes.map((n) => n.id).join(",")}`;
      if (key !== mapKey) { mapKey = key; mapCam = { zoom: 1, x: NaN, y: NaN }; }
      const cam = attachCamera({
        viewport: mvp, field, cam: { ...mapCam }, onChange: (c) => { mapCam = c; },
        contentSize: { w: field.offsetWidth, h: field.offsetHeight },
        initialCenter: () => { const cx = Number(field.dataset.cx), cy = Number(field.dataset.cy); return Number.isFinite(cx) && Number.isFinite(cy) ? { x: cx, y: cy } : null; },
        canPan: (e) => e.button === 1 || (e.button === 0 && !(e.target as HTMLElement).closest(".mnode")),
      });
      app.querySelector("#map-zin")?.addEventListener("click", () => cam.zoomAtCenter(1.2));
      app.querySelector("#map-zout")?.addEventListener("click", () => cam.zoomAtCenter(1 / 1.2));
      app.querySelector("#map-zreset")?.addEventListener("click", () => cam.reset());
    }
  }
}
