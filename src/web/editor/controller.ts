// 맵 에디터 컨트롤러 — 목록↔편집 모드 상태 + 핸들러. main은 run 수명주기 콜백만 주입.
import { validateRun } from "../../core/run.ts";
import type { FloorDef, RunDef } from "../../core/types.ts";
import { listRuns, getRun, saveDraft, deleteDraft, blankRun, exportRun, isDraft, cloneAsDraft } from "./store.ts";
import { addNode, moveNode, deleteNode, toggleEdge, adjacentPairs, addFloor, deleteFloor, moveFloor } from "./ops.ts";

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
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
  let camera = { zoom: 1, x: 0, y: 0 };

  const floor = (): FloorDef => draft!.floors[floorIdx];
  const save = () => { if (draft) saveDraft(draft); };

  function openEdit(id: string): void {
    const def = getRun(id);
    if (!def) return;
    if (isDraft(id)) draft = def;
    else { draft = cloneAsDraft(def); saveDraft(draft); } // repo 런은 드래프트로 복제 후 편집
    floorIdx = 0; sel = null; camera = { zoom: 1, x: NaN, y: NaN }; mode = "edit"; // NaN=뷰가 첫 진입 시 중앙 정렬
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
    const connected = new Set(f.edges.map((e) => edgeKey(e.from, e.to)));
    return {
      mode: "edit",
      name: draft!.name,
      floorName: f.name ?? `층 ${floorIdx + 1}`,
      valid: v.ok,
      errors: fv?.errors ?? [],
      deadNodes: fv?.deadNodes ?? [],
      entryId: f.entryNodeId,
      sel,
      floors: draft!.floors.map((fl, i) => ({ name: fl.name ?? `층 ${i + 1}`, valid: v.floors[i].ok })),
      floorIdx,
      nodes: f.nodes.map((n) => ({ id: n.id, type: n.type, q: n.q, r: n.r, icon: TYPE_ICON[n.type], name: TYPE_NAME[n.type] })),
      edges: f.edges.map((e) => ({ a: e.from, b: e.to })), // 연결(실선)
      walls: adjacentPairs(f).filter((p) => !connected.has(edgeKey(p.a, p.b))), // 인접·미연결 = 세워진 벽
      catalog: CATALOG_TYPES.map((t) => ({ type: t, icon: TYPE_ICON[t], name: TYPE_NAME[t] })),
      camera: { ...camera },
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
      onMoveNode(id, q, r) { if (!draft) return; moveNode(floor(), id, q, r); save(); deps.rerender(); },
      onNodeClick(id) { if (!draft) return; sel = sel === id ? null : id; deps.rerender(); }, // 선택 전용
      onToggleEdge(a, b) { if (!draft) return; toggleEdge(floor(), a, b); save(); deps.rerender(); }, // 변 클릭=연결/벽 토글
      onCamera(cam) { camera = cam; }, // 영속만(DOM은 호출자가 직접 갱신 — 재렌더 없음)
      onDeleteSel() { if (!draft || !sel) return; deleteNode(floor(), sel); sel = null; save(); deps.rerender(); },
      onTestCurrent() { if (draft && validateRun(draft).ok) deps.testRun(draft); },
      onAddFloor() { if (!draft) return; addFloor(draft); floorIdx = draft.floors.length - 1; sel = null; save(); deps.rerender(); },
      onSelectFloor(i) { floorIdx = i; sel = null; deps.rerender(); },
      onDeleteFloor(i) { if (!draft) return; deleteFloor(draft, i); if (floorIdx >= draft.floors.length) floorIdx = draft.floors.length - 1; sel = null; save(); deps.rerender(); },
      onMoveFloor(i, dir) { if (!draft) return; moveFloor(draft, i, dir); if (i === floorIdx) floorIdx = Math.max(0, Math.min(draft.floors.length - 1, i + dir)); save(); deps.rerender(); },
    },
  };
}
