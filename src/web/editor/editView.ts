// 맵 에디터 — 단일 층 편집 화면. 격자·노드·벽이 hexgeo(SoT) 공유 → 완벽한 벌집.
// 노드 = SVG 폴리곤(시각, 격자 셀과 구성상 동일) + 투명 오버레이 div(드래그/클릭/아이콘).
import { esc } from "../battle/shared.ts";
import type { NodeType } from "../../core/types.ts";
import type { EditData, EditorHandlers } from "./editorRender.ts";
import { SIZE, W, FW, FH, ccx, ccy, hexPoints, hexEdge, EDGE_DIRS, gridPathStr, pixelToAxial } from "./hexgeo.ts";

const WALL_SW = 3.5; // 벽 선 두께(.ed-wallvis와 일치)

function floorBar(d: EditData): string {
  const cards = d.floors.map((f, i) =>
    `<div class="ed-floor${i === d.floorIdx ? " active" : ""}">
      <button class="ed-fname" data-fsel="${i}">${esc(f.name)}${f.valid ? "" : ' <span class="ed-bad">✗</span>'}</button>
      <span class="ed-fctl"><button data-fmove="${i}:-1" aria-label="앞으로">◀</button><button data-fmove="${i}:1" aria-label="뒤로">▶</button>${d.floors.length > 1 ? `<button data-fdel="${i}" aria-label="삭제">🗑</button>` : ""}</span>
    </div>`).join("");
  return `${cards}<button class="ed-addfloor" id="ed-addfloor">＋ 층</button>`;
}

export function renderEditView(app: HTMLElement, d: EditData, h: EditorHandlers): void {
  const center = new Map(d.nodes.map((n) => [n.id, { x: ccx(n.q, n.r), y: ccy(n.r) }]));

  // 벽: 인접 노드쌍의 공유 변 테두리(중점 수직, 둥근 캡이 꼭짓점에 닿게 길이 보정). hit=넓게, vis=점선/실선.
  const pairs = [...d.edges.map((e) => ({ ...e, built: false })), ...d.walls.map((w) => ({ ...w, built: true }))];
  const wallSvg = pairs.map((p) => {
    const a = center.get(p.a), b = center.get(p.b);
    if (!a || !b) return "";
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const seg = (half: number) => [mx - px * half, my - py * half, mx + px * half, my + py * half].map((v) => v.toFixed(1));
    const [hx1, hy1, hx2, hy2] = seg(SIZE / 2);
    const [vx1, vy1, vx2, vy2] = seg((SIZE - WALL_SW) / 2);
    return `<line class="ed-ehit" data-edge="${p.a}|${p.b}" x1="${hx1}" y1="${hy1}" x2="${hx2}" y2="${hy2}"/>`
      + `<line class="ed-wallvis${p.built ? " built" : ""}" x1="${vx1}" y1="${vy1}" x2="${vx2}" y2="${vy2}"/>`;
  }).join("");

  const dead = new Set(d.deadNodes);
  const selSet = new Set(d.sel);
  const cellId = new Map(d.nodes.map((n) => [`${n.q},${n.r}`, n.id])); // 셀→노드 id(선택 외곽 계산)

  // 노드 시각 = SVG 폴리곤(채움만; 테두리는 하이라이트 레이어가 담당 → 클리핑 없음)
  const nodePolys = d.nodes.map((n) =>
    `<polygon class="ednode-poly ${n.type}${dead.has(n.id) ? " dead" : ""}" points="${hexPoints(n.q, n.r)}"/>`).join("");
  // 노드 상호작용/아이콘 = 투명 오버레이 div(드래그=이동, 클릭=선택)
  const nodeOverlays = d.nodes.map((n) => {
    const cxp = ccx(n.q, n.r), cyp = ccy(n.r);
    return `<button class="ednode${selSet.has(n.id) ? " sel" : ""}" data-node="${n.id}" style="left:${(cxp - W / 2).toFixed(1)}px;top:${(cyp - SIZE).toFixed(1)}px;width:${W.toFixed(1)}px;height:${(2 * SIZE).toFixed(1)}px" aria-label="${n.name}${n.id === d.entryId ? " (입장)" : ""}">
      <span class="ednode-ico">${n.icon}</span><span class="ednode-lbl">${n.name}</span></button>`;
  }).join("");

  // 하이라이트(테두리=부위 강조, 노드 위 레이어 → 클리핑 없음): 시작=파랑·클리어=초록 전체 윤곽, 선택=노랑 군집 외곽
  const typeOutlines = d.nodes.filter((n) => n.type === "start" || n.type === "clear").map((n) =>
    `<polygon class="hl-${n.type}" points="${hexPoints(n.q, n.r)}"/>`).join("");
  const selLines = d.nodes.filter((n) => selSet.has(n.id)).flatMap((n) =>
    EDGE_DIRS.map(([dq, dr], i) => {
      if (selSet.has(cellId.get(`${n.q + dq},${n.r + dr}`) ?? "")) return ""; // 인접 선택끼리 = 내부 변, 생략
      const [x1, y1, x2, y2] = hexEdge(n.q, n.r, i);
      return `<line class="hl-sel" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    })).join("");

  const gridSvg = `<svg class="ed-grid" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}"><path d="${gridPathStr()}"/></svg>`;
  const nodesSvg = `<svg class="ed-nodes" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">${nodePolys}</svg>`;
  const typeSvg = `<svg class="ed-hl-type" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">${typeOutlines}</svg>`;
  const wallsSvg = `<svg class="ed-walls" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">${wallSvg}</svg>`;
  const selSvg = `<svg class="ed-hl-sel" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">${selLines}</svg>`;

  const catalog = d.catalog.map((c) =>
    `<div class="ed-chip" data-nt="${c.type}"><span class="mico">${c.icon}</span><span>${c.name}</span></div>`).join("");
  const selN = d.sel.length;
  const hasDeletable = d.sel.some((id) => id !== d.entryId);
  const selInfo = selN === 0
    ? `<div class="ed-selinfo hint">카탈로그를 격자에 <b>드래그</b>해 배치 · 노드 <b>드래그</b>=이동 · <b>클릭</b>=선택(<b>Ctrl</b>=다중, <b>Ctrl+A</b>=전체, 빈칸=해제) · 두 칸 사이 변 <b>호버→클릭</b>=벽/연결.</div>`
    : `<div class="ed-selinfo">${selN === 1 ? `선택: ${esc(d.nodes.find((n) => n.id === d.sel[0])!.name)}` : `${selN}개 선택`}
        ${hasDeletable ? `<button class="ed-btn ghost" id="ed-delnode">🗑 삭제 (Del)</button>` : " (입장 노드 — 삭제 불가)"}</div>`;
  const errs = d.valid ? `<div class="ed-ok">✓ 유효한 맵</div>` : `<div class="ed-bad">✗ ${d.errors.map(esc).join("<br>")}</div>`;

  app.innerHTML = `<div class="editor edit-mode">
    <header><h1>🗺 ${esc(d.name)} <span class="dim">— ${esc(d.floorName)}</span></h1>
      <div><button class="ed-btn"${d.valid ? "" : " disabled"} id="ed-test">▶ 테스트플레이</button><button class="hub-link" id="ed-back">← 목록</button></div></header>
    <div class="ed-edit">
      <div class="ed-left">
        <div class="ed-viewport">
          <div class="hexfield" id="ed-field" style="width:${FW}px;height:${FH}px">${gridSvg}${nodesSvg}${typeSvg}${nodeOverlays}${wallsSvg}${selSvg}</div>
          <div class="ed-zoom"><button id="ed-zin" aria-label="확대">＋</button><button id="ed-zout" aria-label="축소">－</button><button id="ed-zreset" aria-label="리셋">⤢</button></div>
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
  app.querySelectorAll<SVGElement>(".ed-ehit[data-edge]").forEach((b) =>
    b.addEventListener("click", () => { const [a, c] = b.dataset.edge!.split("|"); h.onToggleEdge(a, c); }));

  const vp = app.querySelector<HTMLElement>(".ed-viewport");
  const field = app.querySelector<HTMLElement>("#ed-field");
  if (!vp || !field) return;

  // ── 포인터 기반 드래그(네이티브 DnD·브라우저 고스트 이미지 제거 → 게임 오브젝트 이동 느낌) ──
  type Drag = { kind: "place" | "move" | "empty"; id?: string; type?: string; icon?: string; ctrl?: boolean; sx: number; sy: number; moved: boolean };
  let drag: Drag | null = null;
  let avatar: HTMLElement | null = null;
  const endDrag = () => { avatar?.remove(); avatar = null; document.body.classList.remove("ed-dragging"); drag = null; };
  const cellAt = (cx: number, cy: number) => { const r = field.getBoundingClientRect(); const z = r.width / field.offsetWidth || 1; return pixelToAxial((cx - r.left) / z, (cy - r.top) / z); };
  const overField = (cx: number, cy: number) => { const r = vp.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
      drag.moved = true;
      if (drag.kind !== "empty") { avatar = document.createElement("div"); avatar.className = "ed-dragavatar"; avatar.textContent = drag.icon ?? ""; document.body.appendChild(avatar); document.body.classList.add("ed-dragging"); }
    }
    if (avatar) { avatar.style.left = `${e.clientX}px`; avatar.style.top = `${e.clientY}px`; }
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    const cur = drag; endDrag();
    if (cur.kind === "place") { if (cur.moved && overField(e.clientX, e.clientY)) { const { q, r } = cellAt(e.clientX, e.clientY); h.onPlaceNode(cur.type as NodeType, q, r); } }
    else if (cur.kind === "move") {
      if (cur.moved) { if (overField(e.clientX, e.clientY)) { const { q, r } = cellAt(e.clientX, e.clientY); h.onMoveNode(cur.id!, q, r); } }
      else h.onNodeClick(cur.id!, !!cur.ctrl); // 안 움직이면 클릭=선택
    } else if (cur.kind === "empty" && !cur.moved) h.onClearSel(); // 빈칸 클릭=해제
  };
  // 카탈로그 칩에서 끌어 배치
  app.querySelectorAll<HTMLElement>(".ed-chip").forEach((c) => {
    c.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); c.setPointerCapture(e.pointerId); drag = { kind: "place", type: c.dataset.nt, icon: c.querySelector(".mico")?.textContent ?? "", sx: e.clientX, sy: e.clientY, moved: false }; });
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
  });
  // 격자: 노드=이동/선택, 빈칸=해제 (벽은 click이 처리). 좌클릭만; 가운데(팬)는 vp가 처리.
  field.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    const nodeEl = t.closest<HTMLElement>(".ednode");
    if (nodeEl) drag = { kind: "move", id: nodeEl.dataset.node, ctrl: e.ctrlKey || e.metaKey, icon: nodeEl.querySelector(".ednode-ico")?.textContent ?? "", sx: e.clientX, sy: e.clientY, moved: false };
    else if (t.closest(".ed-ehit")) return; // 벽 클릭
    else drag = { kind: "empty", sx: e.clientX, sy: e.clientY, moved: false };
    field.setPointerCapture(e.pointerId);
  });
  field.addEventListener("pointermove", onMove);
  field.addEventListener("pointerup", onUp);

  // ── 카메라(줌·팬) — translate 정수 스냅, 변경분만 영속. 첫 진입은 입장 노드 중앙 정렬 ──
  const cam = { ...d.camera };
  const clamp = (z: number) => Math.max(0.3, Math.min(2.5, z));
  const apply = () => { field.style.transformOrigin = "0 0"; field.style.transform = `translate(${Math.round(cam.x)}px,${Math.round(cam.y)}px) scale(${cam.zoom})`; };
  if (Number.isNaN(cam.x)) {
    const e0 = d.nodes.find((n) => n.id === d.entryId) ?? d.nodes[0];
    const r0 = vp.getBoundingClientRect();
    cam.zoom = 1; cam.x = r0.width / 2 - (e0 ? ccx(e0.q, e0.r) : FW / 2); cam.y = r0.height / 2 - (e0 ? ccy(e0.r) : FH / 2);
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
  app.querySelector("#ed-zreset")!.addEventListener("click", () => { cam.zoom = 1; const [mx, my] = ctr(); cam.x = mx - FW / 2; cam.y = my - FH / 2; apply(); h.onCamera({ ...cam }); });
}
