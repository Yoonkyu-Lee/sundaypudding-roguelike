// 런 화면 렌더 (맵/보상/결과). 전투 화면은 render.ts(renderApp)가 담당.
import type { RunView } from "../core/run.ts";
import { avatarHtml } from "./render.ts";
import { TYPE_ICON, TYPE_NAME } from "./nodeMeta.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export interface RunHandlers {
  onNode: (id: string) => void;
  onReward: (id: string) => void;
  onRestart: () => void;
  onToggleSkill: (charId: string, skillId: string) => void; // 로드아웃 활성 토글
  onBuy: (offerId: string) => void; // 상점 구매
  onLeaveShop: () => void; // 상점 나가기
  onEncounterChoice: (choiceId: string) => void; // 인카운터 선택
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
      return `<button class="pmember${cls}" data-sheet="${m.charId}" title="${esc(m.name)} 상세 보기">
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
  return `<div class="party"><h3>파티 <span class="goldtag">💰 ${view.gold}G</span></h3>${rows}${editBtn}</div>`;
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
  const choices = ev.choices.map((c) => `<button class="enchoice" data-choice="${c.id}">${esc(c.label)}</button>`).join("");
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

  // 노드 id → 중심좌표·상태
  const ctr = new Map(pos.map((p) => [p.n.id, { x: px(p.x) + W / 2, y: py(p.y) + H / 2 }]));
  const statusOf = new Map(view.nodes.map((n) => [n.id, n.status]));

  // 무방향 변: 맞닿은 헥스 중심을 잇는 선(화살표 없음). 현재 위치에서 갈 수 있는 활성 경로는 강조.
  const edges = view.edges
    .map((e) => {
      const a = ctr.get(e.from);
      const b = ctr.get(e.to);
      if (!a || !b) return "";
      const sa = statusOf.get(e.from), sb = statusOf.get(e.to);
      const hot = (sa === "current" && sb === "reachable") || (sb === "current" && sa === "reachable");
      return `<line class="medge${hot ? " hot" : ""}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
    })
    .join("");
  const edgesSvg = `<svg class="mapedges" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}">${edges}</svg>`;

  const hexes = pos
    .map(({ n, x, y }) => {
      const clickable = n.status === "reachable";
      const attrs = clickable ? `data-node="${n.id}"` : "disabled";
      return `<button class="mnode ${n.status} ${n.type}"
        style="left:${px(x)}px;top:${py(y)}px;width:${W}px;height:${H}px"
        ${attrs} data-uid="${n.id}" title="${TYPE_NAME[n.type]}">
        <span class="mhex">
          <span class="mico">${TYPE_ICON[n.type]}</span>
          <span class="mlabel">${TYPE_NAME[n.type]}</span>
          ${n.status === "visited" ? '<span class="mdone">✓</span>' : ""}
          ${n.status === "current" ? '<span class="mhere">▾</span>' : ""}
        </span>
      </button>`;
    })
    .join("");
  return `<div class="mapwrap"><div class="hexfield" style="width:${cw}px;height:${ch}px">${edgesSvg}${hexes}</div></div>
  <div class="hint">맞닿은 길을 따라 클리어(🚩) 노드에 도달하면 층 완료(지나온 칸은 잠김). 빛나는 육각 셀을 클릭하세요.</div>`;
}

function rewardScreen(view: RunView, h: RunHandlers): string {
  const cards = (view.rewards ?? [])
    .map((r) => `<button class="rwcard" data-reward="${r.id}">${esc(r.label)}</button>`)
    .join("");
  return `<div class="reward"><h2>🎁 보상 선택 (1개)</h2><div class="rwcards">${cards}</div></div>`;
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
  else body = mapScreen(view, h);

  app.innerHTML = `
    <header>
      <h1>🍮 Sundaypudding Roguelike</h1>
      <div class="meta">${view.phase === "won" || view.phase === "lost" ? "" : `층 ${view.floor}/${view.totalFloors} · `}${view.phase === "map" ? "맵 — 경로 선택" : view.phase}${view.phase === "won" || view.phase === "lost" ? "" : ` <button class="hdr-menu" id="pausebtn" title="메뉴 (Esc)">⏸</button>`}</div>
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
  app.querySelector("#tohub")?.addEventListener("click", () => h.onToHub());
  app.querySelector("#pausebtn")?.addEventListener("click", () => h.onPause());
}
