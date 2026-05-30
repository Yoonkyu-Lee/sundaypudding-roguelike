// 런 화면 렌더 (맵/보상/결과). 전투 화면은 render.ts(renderApp)가 담당.
import type { NodeType, RunView } from "../core/run.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export interface RunHandlers {
  onNode: (id: string) => void;
  onReward: (id: string) => void;
  onRestart: () => void;
}

const TYPE_ICON: Record<NodeType, string> = {
  battle: "⚔️",
  elite: "💀",
  shop: "🛒",
  encounter: "❓",
  rest: "🏕️",
  boss: "👑",
};
const TYPE_NAME: Record<NodeType, string> = {
  battle: "전투",
  elite: "엘리트",
  shop: "상점",
  encounter: "인카운터",
  rest: "휴식",
  boss: "보스",
};

function partyPanel(view: RunView): string {
  const rows = view.party
    .map((m) => {
      const pct = Math.max(0, (m.hp / m.maxHp) * 100);
      const cls = m.alive ? "" : " dead";
      return `<div class="pmember${cls}">
        <span class="pname">${esc(m.name)}</span>
        <div class="phpbar"><div class="php" style="width:${pct}%"></div></div>
        <span class="phptext">${m.hp}/${m.maxHp}</span>
      </div>`;
    })
    .join("");
  return `<div class="party"><h3>파티</h3>${rows}</div>`;
}

function logPanel(view: RunView): string {
  return `<div class="runlog">${view.log.map((l) => esc(l)).join("<br>")}</div>`;
}

function mapScreen(view: RunView, h: RunHandlers): string {
  // 레이어를 행으로(위=시작, 아래=보스)
  let rowsHtml = "";
  for (let layer = 0; layer <= view.rows; layer++) {
    const nodes = view.nodes.filter((n) => n.layer === layer).sort((a, b) => a.col - b.col);
    const chips = nodes
      .map((n) => {
        const clickable = n.status === "reachable";
        const attrs = clickable ? `data-node="${n.id}"` : "";
        return `<button class="mnode ${n.status} ${n.type}" ${attrs} ${clickable ? "" : "disabled"}
          title="${TYPE_NAME[n.type]}" data-uid="${n.id}">
          <span class="mico">${TYPE_ICON[n.type]}</span>
          <span class="mlabel">${TYPE_NAME[n.type]}</span>
          ${n.status === "visited" ? '<span class="mdone">✓</span>' : ""}
        </button>`;
      })
      .join("");
    rowsHtml += `<div class="maprow" data-layer="${layer}">${chips}</div>`;
  }
  return `<div class="mapwrap">
    <svg class="mapedges"></svg>
    ${rowsHtml}
  </div>
  <div class="hint">선택 가능한(빛나는) 노드를 클릭해 전진하세요.</div>`;
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
    <div class="endbig">${won ? "🏆 런 클리어!" : "💀 런 실패"}</div>
    <button class="act" id="restart">새 런 시작</button>
  </div>`;
}

export function renderRunScreen(app: HTMLElement, view: RunView, h: RunHandlers): void {
  let body = "";
  if (view.phase === "won" || view.phase === "lost") body = endScreen(view);
  else if (view.phase === "reward") body = rewardScreen(view, h);
  else body = mapScreen(view, h);

  app.innerHTML = `
    <header>
      <h1>🍮 Sunday Pudding Roguelike</h1>
      <div class="meta">${view.phase === "map" ? "맵 — 경로 선택" : view.phase}</div>
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
  app.querySelector("#restart")?.addEventListener("click", () => h.onRestart());

  if (view.phase === "map") drawMapEdges(app, view);
}

// 노드 간선을 SVG 선으로 (측정 기반)
function drawMapEdges(app: HTMLElement, view: RunView): void {
  const svg = app.querySelector<SVGSVGElement>(".mapedges");
  if (!svg) return;
  const rectOf = (id: string) => app.querySelector<HTMLElement>(`.mnode[data-uid="${id}"]`)?.getBoundingClientRect();
  let lines = "";
  for (const n of view.nodes) {
    const a = rectOf(n.id);
    if (!a) continue;
    for (const nx of n.next) {
      const b = rectOf(nx);
      if (!b) continue;
      const x1 = a.left + a.width / 2, y1 = a.bottom;
      const x2 = b.left + b.width / 2, y2 = b.top;
      const reachableNext = view.nodes.find((m) => m.id === nx)?.status === "reachable";
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="medge${reachableNext ? " hot" : ""}"/>`;
    }
  }
  svg.innerHTML = lines;
}
