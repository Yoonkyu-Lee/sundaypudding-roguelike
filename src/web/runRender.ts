// 런 화면 렌더 (맵/보상/결과). 전투 화면은 render.ts(renderApp)가 담당.
import type { NodeType, RunView } from "../core/run.ts";
import { avatarHtml } from "./render.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export interface RunHandlers {
  onNode: (id: string) => void;
  onReward: (id: string) => void;
  onRestart: () => void;
  onToggleSkill: (charId: string, skillId: string) => void; // 로드아웃 활성 토글
}

const TYPE_ICON: Record<NodeType, string> = {
  start: "📍",
  battle: "⚔️",
  elite: "💀",
  shop: "🛒",
  encounter: "❓",
  rest: "🏕️",
  boss: "👑",
};
const TYPE_NAME: Record<NodeType, string> = {
  start: "시작",
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
      const chips = m.skills
        .map((s) => `<button class="lskill${s.active ? " on" : ""}${s.signature ? " sig" : " univ"}" data-char="${m.charId}" data-lskill="${s.id}" title="${esc(s.name)} · ${s.signature ? "전용기" : "범용기"}${s.canUpgrade ? " · 강화 가능" : ""}">${esc(s.name)}${s.tier > 1 ? `<sup>${s.tier}</sup>` : ""}</button>`)
        .join("");
      return `<div class="pmember${cls}">
        <div class="prow">
          <span class="pname">${avatarHtml(m.avatar, "avt sm")}${esc(m.name)}</span>
          <div class="phpbar"><div class="php" style="width:${pct}%"></div></div>
          <span class="phptext">${m.hp}/${m.maxHp}</span>
        </div>
        <div class="lskills"><span class="lcount">활성 ${m.activeCount}/4</span>${chips}</div>
      </div>`;
    })
    .join("");
  return `<div class="party"><h3>파티 — 활성 스킬(전투 전 선택)</h3>${rows}</div>`;
}

function logPanel(view: RunView): string {
  return `<div class="runlog">${view.log.map((l) => esc(l)).join("<br>")}</div>`;
}

function mapScreen(view: RunView, h: RunHandlers): string {
  // axial(q,r) → 픽셀 (pointy-top): x=W*(q+r/2), y=1.5*size*r. 진짜 벌집 테셀레이션.
  const SIZE = 46;
  const W = Math.sqrt(3) * SIZE; // 헥스 폭
  const H = 2 * SIZE; // 헥스 높이
  const pos = view.nodes.map((n) => ({ n, x: W * (n.q + n.r / 2), y: SIZE * 1.5 * n.r }));
  const minX = Math.min(...pos.map((p) => p.x));
  const minY = Math.min(...pos.map((p) => p.y));
  const cw = Math.max(...pos.map((p) => p.x)) - minX + W;
  const ch = Math.max(...pos.map((p) => p.y)) - minY + H;

  const hexes = pos
    .map(({ n, x, y }) => {
      const clickable = n.status === "reachable";
      const attrs = clickable ? `data-node="${n.id}"` : "disabled";
      return `<button class="mnode ${n.status} ${n.type}"
        style="left:${x - minX}px;top:${y - minY}px;width:${W}px;height:${H}px"
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
  return `<div class="mapwrap"><div class="hexfield" style="width:${cw}px;height:${ch}px">${hexes}</div></div>
  <div class="hint">위쪽이 시작, 아래쪽이 보스. 빛나는 육각 셀을 클릭해 전진하세요.</div>`;
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
  app.querySelectorAll<HTMLButtonElement>(".lskill[data-lskill]").forEach((b) =>
    b.addEventListener("click", () => h.onToggleSkill(b.dataset.char!, b.dataset.lskill!)),
  );
  app.querySelector("#restart")?.addEventListener("click", () => h.onRestart());
}
