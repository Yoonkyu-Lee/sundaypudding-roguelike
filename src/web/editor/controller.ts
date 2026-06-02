// 맵 에디터 컨트롤러 — 목록↔편집 모드 상태 + 핸들러. main은 run 수명주기 콜백만 주입.
import { validateRun, hexAdjacent } from "../../core/run.ts";
import type { FloorDef, RunDef } from "../../core/types.ts";
import { listRuns, getRun, saveDraft, deleteDraft, blankRun, exportRun, isDraft, cloneAsDraft } from "./store.ts";
import { addNode, deleteNode, toggleEdge, gridCells, nodeAt } from "./ops.ts";
import { CATALOG_TYPES, TYPE_ICON, TYPE_NAME } from "../nodeMeta.ts";
import type { EditorData, EditorHandlers } from "./editorRender.ts";

export interface EditorDeps {
  testRun: (def: RunDef) => void; // 즉시 플레이(허브 우회)
  rerender: () => void;
  toTitle: () => void;
}

export function createEditor(deps: EditorDeps): { data: () => EditorData; handlers: EditorHandlers } {
  let mode: "list" | "edit" = "list";
  let draft: RunDef | null = null;
  let floorIdx = 0;
  let sel: string | null = null;

  const floor = (): FloorDef => draft!.floors[floorIdx];
  const save = () => { if (draft) saveDraft(draft); };

  function openEdit(id: string): void {
    const def = getRun(id);
    if (!def) return;
    if (isDraft(id)) draft = def;
    else { draft = cloneAsDraft(def); saveDraft(draft); } // repo 런은 드래프트로 복제 후 편집
    floorIdx = 0; sel = null; mode = "edit";
    deps.rerender();
  }

  function listData(): EditorData {
    return {
      mode: "list",
      runs: listRuns().map((r) => {
        const d = getRun(r.id)!;
        return { id: r.id, name: r.name, source: r.source, floors: d.floors.length, valid: validateRun(d).ok };
      }),
    };
  }

  function editData(): EditorData {
    const f = floor();
    const v = validateRun(draft!);
    const fv = v.floors[floorIdx];
    const selNode = sel ? f.nodes.find((n) => n.id === sel) : null;
    return {
      mode: "edit",
      name: draft!.name,
      floorName: f.name ?? `층 ${floorIdx + 1}`,
      valid: v.ok,
      errors: fv?.errors ?? [],
      deadNodes: fv?.deadNodes ?? [],
      entryId: f.entryNodeId,
      sel,
      nodes: f.nodes.map((n) => ({ id: n.id, type: n.type, q: n.q, r: n.r, icon: TYPE_ICON[n.type], name: TYPE_NAME[n.type] })),
      edges: f.edges.map((e) => ({ from: e.from, to: e.to })),
      cells: gridCells(f).map((c) => ({ q: c.q, r: c.r, occupied: !!nodeAt(f, c.q, c.r) })),
      connectable: selNode ? f.nodes.filter((n) => n.id !== sel && hexAdjacent(selNode, n)).map((n) => n.id) : [],
      catalog: CATALOG_TYPES.map((t) => ({ type: t, icon: TYPE_ICON[t], name: TYPE_NAME[t] })),
    };
  }

  return {
    data: () => (mode === "list" ? listData() : editData()),
    handlers: {
      onNew() { saveDraft(blankRun()); deps.rerender(); },
      onTest(id) { const d = getRun(id); if (d && validateRun(d).ok) deps.testRun(d); },
      onExport(id) { exportRun(id); },
      onDelete(id) { deleteDraft(id); deps.rerender(); },
      onEdit(id) { openEdit(id); },
      onBack() {
        if (mode === "edit") { mode = "list"; draft = null; sel = null; deps.rerender(); }
        else deps.toTitle();
      },
      onPlaceNode(type, q, r) { if (!draft) return; addNode(floor(), type, q, r); save(); deps.rerender(); },
      onNodeClick(id) {
        if (!draft) return;
        const f = floor();
        if (sel && sel !== id) {
          const a = f.nodes.find((n) => n.id === sel), b = f.nodes.find((n) => n.id === id);
          if (a && b && hexAdjacent(a, b)) { toggleEdge(f, sel, id); save(); deps.rerender(); return; } // 인접 → 변 토글(선택 유지)
        }
        sel = sel === id ? null : id;
        deps.rerender();
      },
      onDeleteSel() { if (!draft || !sel) return; deleteNode(floor(), sel); sel = null; save(); deps.rerender(); },
      onTestCurrent() { if (draft && validateRun(draft).ok) deps.testRun(draft); },
    },
  };
}
