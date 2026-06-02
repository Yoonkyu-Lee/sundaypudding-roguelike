// 맵 에디터 메뉴 컨트롤러 — 런 목록 데이터 + 핸들러 캡슐화. main은 run 수명주기 콜백만 주입.
// (E2: 단일 층 캔버스 편집 상태가 여기 합류. E3: 층 패널.)
import { validateRun } from "../../core/run.ts";
import type { RunDef } from "../../core/types.ts";
import { listRuns, getRun, saveDraft, deleteDraft, blankRun, exportRun } from "./store.ts";
import type { EditorData, EditorHandlers } from "./editorRender.ts";

export interface EditorDeps {
  testRun: (def: RunDef) => void; // 즉시 플레이(허브 우회)
  rerender: () => void;
  toTitle: () => void;
}

export function createEditorMenu(deps: EditorDeps): { data: () => EditorData; handlers: EditorHandlers } {
  return {
    data: () => ({
      runs: listRuns().map((r) => {
        const def = getRun(r.id)!;
        return { id: r.id, name: r.name, source: r.source, floors: def.floors.length, valid: validateRun(def).ok };
      }),
    }),
    handlers: {
      onNew() { saveDraft(blankRun()); deps.rerender(); },
      onTest(id) { const d = getRun(id); if (d && validateRun(d).ok) deps.testRun(d); },
      onExport(id) { exportRun(id); },
      onDelete(id) { deleteDraft(id); deps.rerender(); },
      onBack() { deps.toTitle(); },
    },
  };
}
