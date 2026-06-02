// 맵 에디터 — 단일 층 편집 화면(E2). 좌: 맵 뷰포트(드롭 그리드+노드+무방향 변), 우: 카탈로그+검증/선택 사이드바.
import { esc } from "../battle/shared.ts";
import type { NodeType } from "../../core/types.ts";
import type { EditData, EditorHandlers } from "./editorRender.ts";

const SIZE = 40;
const W = Math.sqrt(3) * SIZE;
const H = 2 * SIZE;
const PAD = W;
const cx = (q: number, r: number) => W * (q + r / 2);
const cy = (r: number) => SIZE * 1.5 * r;

// 층 그래프 패널(선형) — 선택/순서/삭제 + 추가.
function floorBar(d: EditData): string {
  const cards = d.floors.map((f, i) =>
    `<div class="ed-floor${i === d.floorIdx ? " active" : ""}">
      <button class="ed-fname" data-fsel="${i}">${esc(f.name)}${f.valid ? "" : ' <span class="ed-bad">✗</span>'}</button>
      <span class="ed-fctl">
        <button data-fmove="${i}:-1" title="앞으로">◀</button>
        <button data-fmove="${i}:1" title="뒤로">▶</button>
        ${d.floors.length > 1 ? `<button data-fdel="${i}" title="삭제">🗑</button>` : ""}
      </span>
    </div>`).join("");
  return `${cards}<button class="ed-addfloor" id="ed-addfloor">＋ 층</button>`;
}

export function renderEditView(app: HTMLElement, d: EditData, h: EditorHandlers): void {
  const xs = d.cells.map((c) => cx(c.q, c.r));
  const ys = d.cells.map((c) => cy(c.r));
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const fw = Math.max(...xs) - minX + W + PAD * 2;
  const fh = Math.max(...ys) - minY + H + PAD * 2;
  const px = (q: number, r: number) => cx(q, r) - minX + PAD;
  const py = (r: number) => cy(r) - minY + PAD;
  const center = new Map(d.nodes.map((n) => [n.id, { x: px(n.q, n.r) + W / 2, y: py(n.r) + H / 2 }]));

  // 변: 연결(실선) + 벽(인접·미연결, 점선). 중점에 클릭 점 → 토글.
  const allEdges = [...d.edges.map((e) => ({ ...e, wall: false })), ...d.walls.map((w) => ({ ...w, wall: true }))];
  const lines = allEdges.map((e) => {
    const a = center.get(e.a), b = center.get(e.b);
    return a && b ? `<line class="medge${e.wall ? " wall" : ""}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>` : "";
  }).join("");
  const edgesSvg = `<svg class="ed-edges" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}">${lines}</svg>`;
  const edgeBtns = allEdges.map((e) => {
    const a = center.get(e.a), b = center.get(e.b);
    if (!a || !b) return "";
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return `<button class="ed-edgebtn${e.wall ? " wall" : ""}" data-edge="${e.a}|${e.b}" style="left:${(mx - 9).toFixed(1)}px;top:${(my - 9).toFixed(1)}px" title="${e.wall ? "차단됨 — 클릭해 연결" : "연결됨 — 클릭해 차단(벽)"}"></button>`;
  }).join("");

  // 빈 드롭 슬롯
  const slots = d.cells.filter((c) => !c.occupied).map((c) =>
    `<div class="ed-slot" data-hex="${c.q},${c.r}" style="left:${px(c.q, c.r)}px;top:${py(c.r)}px;width:${W}px;height:${H}px"></div>`).join("");

  // 노드 (드래그=이동, 클릭=선택)
  const dead = new Set(d.deadNodes);
  const nodes = d.nodes.map((n) => {
    const cls = [n.type, n.id === d.sel ? "sel" : "", dead.has(n.id) ? "dead" : "", n.id === d.entryId ? "entry" : ""].filter(Boolean).join(" ");
    return `<button class="mnode ${cls}" draggable="true" data-node="${n.id}" style="left:${px(n.q, n.r)}px;top:${py(n.r)}px;width:${W}px;height:${H}px" title="${n.icon} ${n.name}${n.id === d.entryId ? " (입장)" : ""}">
      <span class="mhex"><span class="mico">${n.icon}</span><span class="mlabel">${n.name}</span></span>
    </button>`;
  }).join("");

  const catalog = d.catalog.map((c) =>
    `<div class="ed-chip" draggable="true" data-nt="${c.type}" title="드래그해서 맵에 놓기"><span class="mico">${c.icon}</span><span>${c.name}</span></div>`).join("");

  const selInfo = d.sel
    ? `<div class="ed-selinfo">선택: ${esc(d.nodes.find((n) => n.id === d.sel)!.name)}${d.sel === d.entryId ? " (입장 — 삭제 불가)" : ""}
        ${d.sel !== d.entryId ? `<button class="ed-btn ghost" id="ed-delnode">🗑 노드 삭제 (Del)</button>` : ""}</div>`
    : `<div class="ed-selinfo hint">노드 <b>드래그</b>=이동 · <b>클릭</b>=선택(삭제) · 변의 <b>점 클릭</b>=길 차단(벽)/연결. 인접하면 기본 연결됩니다. 카탈로그를 드래그해 배치.</div>`;

  const errs = d.valid ? `<div class="ed-ok">✓ 유효한 맵</div>` : `<div class="ed-bad">✗ ${d.errors.map(esc).join("<br>")}</div>`;

  app.innerHTML = `<div class="editor edit-mode">
    <header><h1>🗺 ${esc(d.name)} <span class="dim">— ${esc(d.floorName)}</span></h1>
      <div><button class="ed-btn"${d.valid ? "" : " disabled"} id="ed-test">▶ 테스트플레이</button><button class="hub-link" id="ed-back">← 목록</button></div></header>
    <div class="ed-edit">
      <div class="ed-left">
        <div class="ed-canvas"><div class="mapwrap"><div class="hexfield" style="width:${fw}px;height:${fh}px">${edgesSvg}${slots}${nodes}${edgeBtns}</div></div></div>
        <div class="ed-floors">${floorBar(d)}</div>
      </div>
      <aside class="ed-side">
        <section><h3>노드 카탈로그</h3><div class="ed-catalog">${catalog}</div></section>
        <section><h3>검증</h3>${errs}</section>
        <section><h3>선택</h3>${selInfo}</section>
      </aside>
    </div>
  </div>`;

  app.querySelector("#ed-back")!.addEventListener("click", () => h.onBack());
  app.querySelector("#ed-test")!.addEventListener("click", () => h.onTestCurrent());
  app.querySelector("#ed-delnode")?.addEventListener("click", () => h.onDeleteSel());
  app.querySelector("#ed-addfloor")?.addEventListener("click", () => h.onAddFloor());
  app.querySelectorAll<HTMLElement>("[data-fsel]").forEach((b) => b.addEventListener("click", () => h.onSelectFloor(Number(b.dataset.fsel))));
  app.querySelectorAll<HTMLElement>("[data-fdel]").forEach((b) => b.addEventListener("click", () => h.onDeleteFloor(Number(b.dataset.fdel))));
  app.querySelectorAll<HTMLElement>("[data-fmove]").forEach((b) => b.addEventListener("click", () => { const [i, dir] = b.dataset.fmove!.split(":").map(Number); h.onMoveFloor(i, dir); }));
  // 노드: 클릭=선택, 드래그=이동(mv:)
  app.querySelectorAll<HTMLElement>(".mnode[data-node]").forEach((b) => {
    b.addEventListener("click", () => h.onNodeClick(b.dataset.node!));
    b.addEventListener("dragstart", (e) => e.dataTransfer!.setData("text/plain", `mv:${b.dataset.node}`));
  });
  // 변의 점: 클릭=연결/벽 토글
  app.querySelectorAll<HTMLElement>(".ed-edgebtn[data-edge]").forEach((b) =>
    b.addEventListener("click", () => { const [a, c] = b.dataset.edge!.split("|"); h.onToggleEdge(a, c); }));
  // 카탈로그 칩 드래그(nt:)
  app.querySelectorAll<HTMLElement>(".ed-chip").forEach((c) =>
    c.addEventListener("dragstart", (e) => e.dataTransfer!.setData("text/plain", `nt:${c.dataset.nt}`)));
  // 빈 슬롯: nt:=배치 / mv:=이동
  app.querySelectorAll<HTMLElement>(".ed-slot").forEach((s) => {
    s.addEventListener("dragover", (e) => { e.preventDefault(); s.classList.add("over"); });
    s.addEventListener("dragleave", () => s.classList.remove("over"));
    s.addEventListener("drop", (e) => {
      e.preventDefault();
      const data = e.dataTransfer!.getData("text/plain");
      const [q, r] = s.dataset.hex!.split(",").map(Number);
      if (data.startsWith("nt:")) h.onPlaceNode(data.slice(3) as NodeType, q, r);
      else if (data.startsWith("mv:")) h.onMoveNode(data.slice(3), q, r);
    });
  });
}
