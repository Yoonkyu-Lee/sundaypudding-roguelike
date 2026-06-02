// 맵 에디터 — 단일 층 편집 화면. 엑셀식 광활한 육각 격자 위 배치(어디든) + 카메라(고정 뷰포트).
// 벽 = 두 인접 노드의 공유 변에 그리는 테두리(호버=점선 미리보기, 클릭=실선 벽). 연결됨=선 없음.
import { esc } from "../battle/shared.ts";
import type { NodeType } from "../../core/types.ts";
import type { EditData, EditorHandlers } from "./editorRender.ts";

const SIZE = 34;                 // 헥스 중심→꼭짓점
const W = Math.sqrt(3) * SIZE;   // 헥스 폭
const R = 14;                    // 격자 반경(±R 셀)
const OX = W * 1.5 * R + W;      // 원점 오프셋(모든 셀 양수 좌표)
const OY = 1.5 * SIZE * R + 2 * SIZE;
const FW = OX * 2, FH = OY * 2;  // 고정 격자(필드) 크기
const ccx = (q: number, r: number) => OX + W * (q + r / 2); // 셀 중심
const ccy = (r: number) => OY + 1.5 * SIZE * r;

// 픽셀(필드 로컬)→axial 셀 (역변환 + 큐브 라운딩)
function axialRound(qf: number, rf: number): { q: number; r: number } {
  let x = qf, z = rf, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}
function pixelToAxial(fx: number, fy: number): { q: number; r: number } {
  const x = fx - OX, y = fy - OY;
  const r = y / (1.5 * SIZE);
  return axialRound(x / W - r / 2, r);
}

// 희미한 육각 격자 path(엑셀 격자선) — 고정 범위라 1회 계산 후 메모이즈.
let GRID = "";
function gridPath(): string {
  if (GRID) return GRID;
  const segs: string[] = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    const x = ccx(q, r), y = ccy(r), s2 = SIZE / 2;
    segs.push(`M${x.toFixed(1)} ${(y - SIZE).toFixed(1)}L${(x + W / 2).toFixed(1)} ${(y - s2).toFixed(1)}L${(x + W / 2).toFixed(1)} ${(y + s2).toFixed(1)}L${x.toFixed(1)} ${(y + SIZE).toFixed(1)}L${(x - W / 2).toFixed(1)} ${(y + s2).toFixed(1)}L${(x - W / 2).toFixed(1)} ${(y - s2).toFixed(1)}Z`);
  }
  GRID = segs.join("");
  return GRID;
}

// 층 그래프 패널(선형).
function floorBar(d: EditData): string {
  const cards = d.floors.map((f, i) =>
    `<div class="ed-floor${i === d.floorIdx ? " active" : ""}">
      <button class="ed-fname" data-fsel="${i}">${esc(f.name)}${f.valid ? "" : ' <span class="ed-bad">✗</span>'}</button>
      <span class="ed-fctl"><button data-fmove="${i}:-1" title="앞으로">◀</button><button data-fmove="${i}:1" title="뒤로">▶</button>${d.floors.length > 1 ? `<button data-fdel="${i}" title="삭제">🗑</button>` : ""}</span>
    </div>`).join("");
  return `${cards}<button class="ed-addfloor" id="ed-addfloor">＋ 층</button>`;
}

export function renderEditView(app: HTMLElement, d: EditData, h: EditorHandlers): void {
  const center = new Map(d.nodes.map((n) => [n.id, { x: ccx(n.q, n.r), y: ccy(n.r) }]));
  const ekey = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`);

  // 벽: 인접 노드쌍의 공유 변에 테두리 선분(중점에서 수직, 길이=헥스 변). hit(투명)→호버, vis→점선/실선.
  const pairs = [...d.edges.map((e) => ({ ...e, built: false })), ...d.walls.map((w) => ({ ...w, built: true }))];
  const wallSvg = pairs.map((p) => {
    const a = center.get(p.a), b = center.get(p.b);
    if (!a || !b) return "";
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const pxu = -dy / len, pyu = dx / len, half = SIZE / 2; // 공유 변 = 중점에서 수직 ±half
    const x1 = (mx - pxu * half).toFixed(1), y1 = (my - pyu * half).toFixed(1), x2 = (mx + pxu * half).toFixed(1), y2 = (my + pyu * half).toFixed(1);
    return `<line class="ed-ehit" data-edge="${p.a}|${p.b}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><title>${p.built ? "벽 — 클릭해 연결" : "연결됨 — 클릭해 벽 세우기"}</title></line>`
      + `<line class="ed-wallvis${p.built ? " built" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");

  const dead = new Set(d.deadNodes);
  const nodes = d.nodes.map((n) => {
    const cls = [n.type, n.id === d.sel ? "sel" : "", dead.has(n.id) ? "dead" : "", n.id === d.entryId ? "entry" : ""].filter(Boolean).join(" ");
    const cxp = ccx(n.q, n.r), cyp = ccy(n.r);
    return `<button class="mnode ${cls}" draggable="true" data-node="${n.id}" style="left:${(cxp - W / 2).toFixed(1)}px;top:${(cyp - SIZE).toFixed(1)}px;width:${W.toFixed(1)}px;height:${(2 * SIZE).toFixed(1)}px" title="${n.icon} ${n.name}${n.id === d.entryId ? " (입장)" : ""}">
      <span class="mhex"><span class="mico">${n.icon}</span><span class="mlabel">${n.name}</span></span>
    </button>`;
  }).join("");

  const gridSvg = `<svg class="ed-grid" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}"><path d="${gridPath()}"/></svg>`;
  const wallsSvg = `<svg class="ed-walls" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">${wallSvg}</svg>`;

  const catalog = d.catalog.map((c) =>
    `<div class="ed-chip" draggable="true" data-nt="${c.type}" title="드래그해서 격자에 놓기"><span class="mico">${c.icon}</span><span>${c.name}</span></div>`).join("");
  const selInfo = d.sel
    ? `<div class="ed-selinfo">선택: ${esc(d.nodes.find((n) => n.id === d.sel)!.name)}${d.sel === d.entryId ? " (입장 — 삭제 불가)" : ""}
        ${d.sel !== d.entryId ? `<button class="ed-btn ghost" id="ed-delnode">🗑 노드 삭제 (Del)</button>` : ""}</div>`
    : `<div class="ed-selinfo hint">카탈로그를 격자에 <b>드래그</b>해 배치 · 노드 <b>드래그</b>=이동 · <b>클릭</b>=선택(Del 삭제) · 두 칸 사이 변에 <b>호버→클릭</b>=벽(차단)/연결.</div>`;
  const errs = d.valid ? `<div class="ed-ok">✓ 유효한 맵</div>` : `<div class="ed-bad">✗ ${d.errors.map(esc).join("<br>")}</div>`;

  app.innerHTML = `<div class="editor edit-mode">
    <header><h1>🗺 ${esc(d.name)} <span class="dim">— ${esc(d.floorName)}</span></h1>
      <div><button class="ed-btn"${d.valid ? "" : " disabled"} id="ed-test">▶ 테스트플레이</button><button class="hub-link" id="ed-back">← 목록</button></div></header>
    <div class="ed-edit">
      <div class="ed-left">
        <div class="ed-viewport">
          <div class="hexfield" id="ed-field" style="width:${FW}px;height:${FH}px">${gridSvg}${wallsSvg}${nodes}</div>
          <div class="ed-zoom"><button id="ed-zin" title="확대">＋</button><button id="ed-zout" title="축소">－</button><button id="ed-zreset" title="리셋">⤢</button></div>
          <div class="ed-vphint">휠=줌 · 휠(가운데) 드래그=이동</div>
        </div>
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
  app.querySelectorAll<HTMLElement>(".mnode[data-node]").forEach((b) => {
    b.addEventListener("click", () => h.onNodeClick(b.dataset.node!));
    b.addEventListener("dragstart", (e) => e.dataTransfer!.setData("text/plain", `mv:${b.dataset.node}`));
  });
  app.querySelectorAll<SVGElement>(".ed-ehit[data-edge]").forEach((b) =>
    b.addEventListener("click", () => { const [a, c] = b.dataset.edge!.split("|"); h.onToggleEdge(a, c); }));
  app.querySelectorAll<HTMLElement>(".ed-chip").forEach((c) =>
    c.addEventListener("dragstart", (e) => e.dataTransfer!.setData("text/plain", `nt:${c.dataset.nt}`)));

  const vp = app.querySelector<HTMLElement>(".ed-viewport");
  const field = app.querySelector<HTMLElement>("#ed-field");
  if (!vp || !field) return;

  // 드롭(필드 전체, 버블링으로 노드 위에서도) — 픽셀→셀 좌표로 배치/이동
  field.addEventListener("dragover", (e) => e.preventDefault());
  field.addEventListener("drop", (e) => {
    e.preventDefault();
    const data = e.dataTransfer!.getData("text/plain");
    const rect = field.getBoundingClientRect();
    const zoom = rect.width / field.offsetWidth || 1;
    const { q, r } = pixelToAxial((e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom);
    if (data.startsWith("nt:")) h.onPlaceNode(data.slice(3) as NodeType, q, r);
    else if (data.startsWith("mv:")) h.onMoveNode(data.slice(3), q, r);
  });

  // ── 카메라(줌·팬) — DOM 직접 변환, 변경분만 영속. 첫 진입은 입장 노드 중앙 정렬 ──
  const cam = { ...d.camera };
  const clamp = (z: number) => Math.max(0.3, Math.min(2.5, z));
  const apply = () => { field.style.transformOrigin = "0 0"; field.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.zoom})`; };
  if (Number.isNaN(cam.x)) {
    const e0 = d.nodes.find((n) => n.id === d.entryId) ?? d.nodes[0];
    const r0 = vp.getBoundingClientRect();
    const ex = e0 ? ccx(e0.q, e0.r) : OX, ey = e0 ? ccy(e0.r) : OY;
    cam.zoom = 1; cam.x = r0.width / 2 - ex; cam.y = r0.height / 2 - ey;
    h.onCamera({ ...cam });
  }
  apply();
  const zoomAt = (mx: number, my: number, factor: number) => {
    const nz = clamp(cam.zoom * factor), k = nz / cam.zoom;
    cam.x = mx - (mx - cam.x) * k; cam.y = my - (my - cam.y) * k; cam.zoom = nz;
    apply(); h.onCamera({ ...cam });
  };
  vp.addEventListener("wheel", (e) => { e.preventDefault(); const r = vp.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  let panning = false, lastX = 0, lastY = 0;
  vp.addEventListener("pointerdown", (e) => { if (e.button !== 1) return; e.preventDefault(); panning = true; lastX = e.clientX; lastY = e.clientY; vp.setPointerCapture(e.pointerId); });
  vp.addEventListener("pointermove", (e) => { if (!panning) return; cam.x += e.clientX - lastX; cam.y += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; apply(); });
  vp.addEventListener("pointerup", () => { if (panning) { panning = false; h.onCamera({ ...cam }); } });
  const ctr = () => { const r = vp.getBoundingClientRect(); return [r.width / 2, r.height / 2] as const; };
  app.querySelector("#ed-zin")!.addEventListener("click", () => zoomAt(...ctr(), 1.2));
  app.querySelector("#ed-zout")!.addEventListener("click", () => zoomAt(...ctr(), 1 / 1.2));
  app.querySelector("#ed-zreset")!.addEventListener("click", () => { cam.zoom = 1; const [mx, my] = ctr(); cam.x = mx - OX; cam.y = my - OY; apply(); h.onCamera({ ...cam }); });
}
