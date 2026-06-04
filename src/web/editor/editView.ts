// 런 에디터 — 단일 층 편집 화면. 격자·노드·벽이 hexgeo(SoT) 공유 → 완벽한 벌집.
// 노드 = SVG 폴리곤(시각, 격자 셀과 구성상 동일) + 투명 오버레이 div(드래그/클릭/아이콘).
import { esc } from "../battle/shared.ts";
import type { NodeType } from "../../core/types.ts";
import type { EditData, EditorHandlers } from "./editorRender.ts";
import { nodeMetaPanel, wireNodeMeta } from "./nodePanel.ts";
import { attachCamera } from "../camera.ts";
import { SIZE, W, FW, FH, ccx, ccy, hexPoints, hexEdge, EDGE_DIRS, gridPathStr, pixelToAxial } from "../hexgeo.ts";

const WALL_SW = 3.5; // 벽 선 두께(.ed-wallvis와 일치)
// 더블클릭 감지(모듈 전역 — 첫 클릭이 재렌더해도 유지). 포인터 캡처로 네이티브 dblclick 타깃이 바뀌어 직접 감지.
let lastNodeClick: { id: string; t: number } | null = null;

// 층 그래프 뷰포트(블럭 다이어그램) — 층=박스, 클리어 toFloor=방향 화살표, 입장 층 ★. 입장에서 BFS 레벨로 좌→우 배치.
const FGW = 132, FGH = 52, FGX = 50, FGY = 16;
function floorGraph(d: EditData): string {
  const byId = new Map(d.floors.map((f) => [f.id, f]));
  const level = new Map<string, number>();
  if (byId.has(d.entryFloorId)) {
    const q = [d.entryFloorId]; level.set(d.entryFloorId, 0);
    while (q.length) { const id = q.shift()!; for (const t of byId.get(id)!.toFloors) if (byId.has(t) && !level.has(t)) { level.set(t, level.get(id)! + 1); q.push(t); } }
  }
  const reachedMax = level.size ? Math.max(...level.values()) : 0;
  d.floors.forEach((f) => { if (!level.has(f.id)) level.set(f.id, reachedMax + 1); }); // 고립 층 = 끝 열
  const rowOf = new Map<string, number>(); const colCount = new Map<number, number>();
  d.floors.forEach((f) => { const l = level.get(f.id)!; const r = colCount.get(l) ?? 0; rowOf.set(f.id, r); colCount.set(l, r + 1); });
  const bx = (id: string) => level.get(id)! * (FGW + FGX);
  const by = (id: string) => rowOf.get(id)! * (FGH + FGY);
  const maxLv = Math.max(0, ...[...level.values()]); const maxRow = Math.max(1, ...[...colCount.values()]);
  const cw = (maxLv + 1) * (FGW + FGX), ch = maxRow * (FGH + FGY);

  // 선택한 클리어 노드(현재 층)가 가리키는 링크 = 하이라이트 대상(선택 노랑과 통일)
  const curId = d.floors[d.floorIdx]?.id;
  const selNode = d.sel.length === 1 ? d.nodes.find((n) => n.id === d.sel[0]) : null;
  const hl = selNode && selNode.type === "clear" && selNode.toFloor ? { from: curId, to: selNode.toFloor } : null;
  const arrows = d.floors.flatMap((f) => f.toFloors.filter((t) => byId.has(t)).map((t) => {
    const x1 = bx(f.id) + FGW, y1 = by(f.id) + FGH / 2, x2 = bx(t) - 2, y2 = by(t) + FGH / 2;
    const hot = !!hl && f.id === hl.from && t === hl.to;
    return `<line class="${hot ? "hot" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${hot ? "fgah-hot" : "fgah"})"/>`;
  })).join("");
  const edgesSvg = `<svg class="fg-edges" width="${cw}" height="${ch}"><defs>
    <marker id="fgah" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="fgah" d="M0,0 L7,3 L0,6 Z"/></marker>
    <marker id="fgah-hot" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="fgah-hot" d="M0,0 L7,3 L0,6 Z"/></marker>
    </defs>${arrows}</svg>`;
  const boxes = d.floors.map((f, i) => {
    const entry = f.id === d.entryFloorId, cur = i === d.floorIdx;
    return `<div class="fg-box${cur ? " current" : ""}${entry ? " entry" : ""}${f.valid ? "" : " invalid"}" data-floor-idx="${i}" style="left:${bx(f.id)}px;top:${by(f.id)}px;width:${FGW}px;height:${FGH}px">
      <div class="fg-name">${entry ? "★ " : ""}${esc(f.name)}${f.valid ? "" : " ✗"}</div>
      <div class="fg-acts">${entry ? `<span class="fg-entry">입장</span>` : `<button class="fg-mini" data-fentry="${f.id}">입장 지정</button>`}${d.floors.length > 1 ? `<button class="fg-mini" data-fdel="${i}">🗑</button>` : ""}</div>
    </div>`;
  }).join("");
  return `<div class="fg-viewport">
      <div class="fg-canvas" style="width:${cw}px;height:${ch}px">${edgesSvg}${boxes}</div>
      <div class="ed-zoom"><button id="fg-zin" aria-label="확대">＋</button><button id="fg-zout" aria-label="축소">－</button><button id="fg-zreset" aria-label="리셋">⤢</button></div>
      <div class="ed-vphint">휠=줌 · 드래그=이동</div>
    </div><button class="ed-addfloor" id="ed-addfloor">＋ 층</button>`;
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
    const lbl = n.label ?? n.name;
    const badge = n.hasCore ? `<span class="ednode-badge" aria-label="내용물 편집됨">⚙</span>` : "";
    return `<button class="ednode${selSet.has(n.id) ? " sel" : ""}" data-node="${n.id}" style="left:${(cxp - W / 2).toFixed(1)}px;top:${(cyp - SIZE).toFixed(1)}px;width:${W.toFixed(1)}px;height:${(2 * SIZE).toFixed(1)}px" aria-label="${esc(lbl)}${n.id === d.entryId ? " (입장)" : ""}">
      <span class="ednode-ico">${n.icon}</span><span class="ednode-lbl">${esc(lbl)}</span>${badge}</button>`;
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
  const templates = d.templates.length
    ? d.templates.map((t) => `<div class="ed-chip tpl" data-tpl="${t.id}"><span class="mico">${t.icon}</span><span>${esc(t.name)}</span><button class="ed-tpl-del" data-tpldel="${t.id}" aria-label="템플릿 삭제" title="삭제">✕</button></div>`).join("")
    : `<div class="hint">노드를 더블클릭→편집 후 "📋 템플릿으로 저장"으로 재사용할 노드를 만들 수 있습니다.</div>`;
  const selN = d.sel.length;
  const one = selN === 1 ? d.nodes.find((n) => n.id === d.sel[0]) : null;
  const hasDeletable = d.sel.some((id) => id !== d.entryId);
  const floorPick = one && one.type === "clear"
    ? `<div class="ed-tofloor">다음 층 <select id="ed-tofloor"><option value="">🏁 승리(종료)</option>${d.floors.map((f) => `<option value="${f.id}"${one.toFloor === f.id ? " selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div>`
    : "";
  const selInfo = selN === 0
    ? `<div class="ed-selinfo hint">카탈로그를 격자에 <b>드래그</b>해 배치 · 노드 <b>드래그</b>=이동 · <b>클릭</b>=선택(<b>Ctrl</b>=다중, <b>Ctrl+A</b>=전체, 빈칸=해제) · 두 칸 사이 변 <b>호버→클릭</b>=벽/연결.</div>`
    : `<div class="ed-selinfo">${selN === 1 ? `선택: ${esc(one!.label ?? one!.name)}` : `${selN}개 선택`}
        ${floorPick}
        ${one ? nodeMetaPanel(d, one) : ""}
        ${hasDeletable ? `<button class="ed-btn ghost" id="ed-delnode">🗑 삭제 (Del)</button>` : " (입장 노드 — 삭제 불가)"}</div>`;
  const errs = d.valid ? `<div class="ed-ok">✓ 유효한 맵</div>` : `<div class="ed-bad">✗ ${d.errors.map(esc).join("<br>")}</div>`;

  const vpStyle = d.splitH ? ` style="height:${d.splitH}px"` : "";
  app.innerHTML = `<div class="editor edit-mode">
    <header><h1>🗺 <input class="ed-title" id="ed-runname" value="${esc(d.name)}" aria-label="런 제목" maxlength="40"> <span class="dim">—</span> <input class="ed-title floor" id="ed-floorname" value="${esc(d.floorName)}" aria-label="현재 층 제목" maxlength="30"></h1>
      <div><button class="ed-btn"${d.valid ? "" : " disabled"} id="ed-test">▶ 테스트플레이</button><button class="ed-btn ghost" id="ed-saverepo">💾 repo에 저장</button><button class="hub-link" id="ed-back">← 목록</button></div></header>
    <div class="ed-edit">
      <div class="ed-left">
        <div class="ed-viewport"${vpStyle}>
          <div class="hexfield" id="ed-field" style="width:${FW}px;height:${FH}px">${gridSvg}${nodesSvg}${typeSvg}${nodeOverlays}${wallsSvg}${selSvg}</div>
          <div class="ed-zoom"><button id="ed-zin" aria-label="확대">＋</button><button id="ed-zout" aria-label="축소">－</button><button id="ed-zreset" aria-label="리셋">⤢</button></div>
          <div class="ed-vphint">휠=줌 · 휠(가운데) 드래그=이동</div>
        </div>
        <div class="ed-vsplit" id="ed-vsplit" role="separator" aria-label="영역 크기 조절" title="드래그하여 위/아래 영역 크기 조절"></div>
        <div class="ed-floors"><div class="ed-floors-h">층 그래프 <span class="hint">박스=층, 화살표=클리어의 다음 층. 박스 클릭=편집</span></div>${floorGraph(d)}</div>
      </div>
      <aside class="ed-side">
        <section><h3>노드 카탈로그</h3><div class="ed-catalog">${catalog}</div></section>
        <section><h3>📋 내 템플릿</h3><div class="ed-catalog tpl">${templates}</div></section>
        <section><h3>검증</h3>${errs}</section>
        <section><h3>선택</h3>${selInfo}</section>
      </aside>
    </div>
  </div>`;

  app.querySelector("#ed-back")!.addEventListener("click", () => h.onBack());
  app.querySelector("#ed-test")!.addEventListener("click", () => h.onTestCurrent());
  app.querySelector("#ed-saverepo")?.addEventListener("click", () => h.onSaveToRepo(d.id));
  app.querySelector<HTMLInputElement>("#ed-runname")?.addEventListener("change", (e) => h.onSetRunName((e.target as HTMLInputElement).value));
  app.querySelector<HTMLInputElement>("#ed-floorname")?.addEventListener("change", (e) => h.onSetFloorName((e.target as HTMLInputElement).value));
  app.querySelector("#ed-delnode")?.addEventListener("click", () => h.onDeleteSel());
  app.querySelector("#ed-addfloor")?.addEventListener("click", () => h.onAddFloor());
  app.querySelectorAll<HTMLElement>(".fg-box[data-floor-idx]").forEach((b) => b.addEventListener("click", () => h.onSelectFloor(Number(b.dataset.floorIdx))));
  app.querySelectorAll<HTMLElement>("[data-fdel]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); h.onDeleteFloor(Number(b.dataset.fdel)); }));
  app.querySelectorAll<HTMLElement>("[data-fentry]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); h.onSetEntryFloor(b.dataset.fentry!); }));
  app.querySelector<HTMLSelectElement>("#ed-tofloor")?.addEventListener("change", (e) => h.onSetNodeToFloor(d.sel[0], (e.target as HTMLSelectElement).value || null));
  wireNodeMeta(app, d, h);
  app.querySelectorAll<SVGElement>(".ed-ehit[data-edge]").forEach((b) =>
    b.addEventListener("click", () => { const [a, c] = b.dataset.edge!.split("|"); h.onToggleEdge(a, c); }));

  const vp = app.querySelector<HTMLElement>(".ed-viewport");
  const field = app.querySelector<HTMLElement>("#ed-field");
  if (!vp || !field) return;

  // ── 포인터 기반 드래그(네이티브 DnD·브라우저 고스트 이미지 제거 → 게임 오브젝트 이동 느낌) ──
  type Drag = { kind: "place" | "placeTpl" | "move" | "empty"; id?: string; tpl?: string; type?: string; icon?: string; ctrl?: boolean; sx: number; sy: number; moved: boolean };
  let drag: Drag | null = null;
  let avatar: HTMLElement | null = null;
  const endDrag = () => { avatar?.remove(); avatar = null; document.body.classList.remove("dragging"); drag = null; };
  const cellAt = (cx: number, cy: number) => { const r = field.getBoundingClientRect(); const z = r.width / field.offsetWidth || 1; return pixelToAxial((cx - r.left) / z, (cy - r.top) / z); };
  const overField = (cx: number, cy: number) => { const r = vp.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
      drag.moved = true;
      if (drag.kind !== "empty") { avatar = document.createElement("div"); avatar.className = "drag-avatar"; avatar.textContent = drag.icon ?? ""; document.body.appendChild(avatar); document.body.classList.add("dragging"); }
    }
    if (avatar) { avatar.style.left = `${e.clientX}px`; avatar.style.top = `${e.clientY}px`; }
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    const cur = drag; endDrag();
    if (cur.kind === "place") { if (cur.moved && overField(e.clientX, e.clientY)) { const { q, r } = cellAt(e.clientX, e.clientY); h.onPlaceNode(cur.type as NodeType, q, r); } }
    else if (cur.kind === "placeTpl") { if (cur.moved && overField(e.clientX, e.clientY)) { const { q, r } = cellAt(e.clientX, e.clientY); h.onPlaceTemplate(cur.tpl!, q, r); } }
    else if (cur.kind === "move") {
      if (cur.moved) { if (overField(e.clientX, e.clientY)) { const { q, r } = cellAt(e.clientX, e.clientY); h.onMoveNode(cur.id!, q, r); } }
      else { // 안 움직이면 클릭=선택, 같은 노드 빠른 두 번째 클릭=노드 에디터 진입(더블클릭)
        const id = cur.id!;
        if (lastNodeClick && lastNodeClick.id === id && e.timeStamp - lastNodeClick.t < 400) { lastNodeClick = null; h.onOpenNodeEditor(id); }
        else { lastNodeClick = { id, t: e.timeStamp }; h.onNodeClick(id, !!cur.ctrl); }
      }
    } else if (cur.kind === "empty" && !cur.moved) { lastNodeClick = null; h.onClearSel(); } // 빈칸 클릭=해제
  };
  // 카탈로그 칩(타입)에서 끌어 배치
  app.querySelectorAll<HTMLElement>(".ed-chip[data-nt]").forEach((c) => {
    c.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); c.setPointerCapture(e.pointerId); drag = { kind: "place", type: c.dataset.nt, icon: c.querySelector(".mico")?.textContent ?? "", sx: e.clientX, sy: e.clientY, moved: false }; });
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
  });
  // 템플릿 칩에서 끌어 복제 배치 (✕ 삭제 버튼은 별도 click)
  app.querySelectorAll<HTMLElement>(".ed-chip[data-tpl]").forEach((c) => {
    c.addEventListener("pointerdown", (e) => { if (e.button !== 0 || (e.target as HTMLElement).closest(".ed-tpl-del")) return; e.preventDefault(); c.setPointerCapture(e.pointerId); drag = { kind: "placeTpl", tpl: c.dataset.tpl, icon: c.querySelector(".mico")?.textContent ?? "", sx: e.clientX, sy: e.clientY, moved: false }; });
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
  });
  app.querySelectorAll<HTMLElement>("[data-tpldel]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); h.onDeleteTemplate(b.dataset.tpldel!); }));
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

  // ── 노드 맵 카메라(줌·팬) — 첫 진입은 입장 노드 중앙 정렬. (공용 attachCamera) ──
  const nodeCam = attachCamera({
    viewport: vp, field, cam: { ...d.camera }, onChange: (c) => h.onCamera(c),
    contentSize: { w: FW, h: FH },
    initialCenter: () => { const e0 = d.nodes.find((n) => n.id === d.entryId) ?? d.nodes[0]; return e0 ? { x: ccx(e0.q, e0.r), y: ccy(e0.r) } : null; },
  });
  app.querySelector("#ed-zin")!.addEventListener("click", () => nodeCam.zoomAtCenter(1.2));
  app.querySelector("#ed-zout")!.addEventListener("click", () => nodeCam.zoomAtCenter(1 / 1.2));
  app.querySelector("#ed-zreset")!.addEventListener("click", () => nodeCam.reset());

  // ── 층 그래프 카메라 — 빈 배경 좌드래그 또는 중클릭으로 팬, 휠 줌. 박스/버튼 클릭과 충돌 없음 ──
  const fgvp = app.querySelector<HTMLElement>(".fg-viewport");
  const fgfield = app.querySelector<HTMLElement>(".fg-canvas");
  if (fgvp && fgfield) {
    const fgCam = attachCamera({
      viewport: fgvp, field: fgfield, cam: { ...d.floorCamera }, onChange: (c) => h.onFloorCamera(c),
      contentSize: { w: fgfield.offsetWidth, h: fgfield.offsetHeight },
      canPan: (e) => e.button === 1 || (e.button === 0 && !(e.target as HTMLElement).closest(".fg-box,.fg-mini")),
    });
    app.querySelector("#fg-zin")?.addEventListener("click", () => fgCam.zoomAtCenter(1.2));
    app.querySelector("#fg-zout")?.addEventListener("click", () => fgCam.zoomAtCenter(1 / 1.2));
    app.querySelector("#fg-zreset")?.addEventListener("click", () => fgCam.reset());
  }

  // ── 뷰포트 사이 스플리터 — 드래그로 노드 맵 높이 조절(층 영역은 잔여 공간 flex-fill). 영속, 재렌더 없음 ──
  const split = app.querySelector<HTMLElement>("#ed-vsplit");
  const left = app.querySelector<HTMLElement>(".ed-left");
  if (split && left) {
    let dragging = false, startY = 0, startH = 0;
    split.addEventListener("pointerdown", (e) => { dragging = true; startY = e.clientY; startH = vp.getBoundingClientRect().height; split.setPointerCapture(e.pointerId); e.preventDefault(); });
    split.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const max = left.getBoundingClientRect().height - 160; // 층 영역 최소 확보
      const hpx = Math.max(220, Math.min(max, startH + (e.clientY - startY)));
      vp.style.height = `${hpx}px`;
    });
    split.addEventListener("pointerup", () => { if (dragging) { dragging = false; h.onSplit(Math.round(vp.getBoundingClientRect().height)); } });
  }
}
