// 맵 에디터 렌더 — 런 목록(E1) ↔ 단일 층 편집(E2) 디스패치. 층 그래프 패널 = E3.
import { esc } from "../battle/shared.ts";
import type { NodeType } from "../../core/types.ts";
import type { RunSource } from "./store.ts";
import { renderEditView } from "./editView.ts";

export interface EditorRunCard { id: string; name: string; source: RunSource; floors: number; valid: boolean; }
export interface ListData { mode: "list"; runs: EditorRunCard[]; }

export interface EditNode { id: string; type: NodeType; q: number; r: number; icon: string; name: string; }
export interface EditData {
  mode: "edit";
  name: string;
  floorName: string;
  valid: boolean;
  errors: string[];
  deadNodes: string[];
  entryId: string;
  sel: string | null;
  floors: { name: string; valid: boolean }[]; // 층 그래프 패널(선형)
  floorIdx: number;
  nodes: EditNode[];
  edges: { from: string; to: string }[];
  cells: { q: number; r: number; occupied: boolean }[];
  connectable: string[];
  catalog: { type: NodeType; icon: string; name: string }[];
}
export type EditorData = ListData | EditData;

export interface EditorHandlers {
  onNew: () => void;
  onTest: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onBack: () => void;
  // 편집 화면 (E2)
  onPlaceNode: (type: NodeType, q: number, r: number) => void;
  onNodeClick: (id: string) => void;
  onDeleteSel: () => void;
  onTestCurrent: () => void;
  // 층 그래프 패널 (E3)
  onAddFloor: () => void;
  onSelectFloor: (idx: number) => void;
  onDeleteFloor: (idx: number) => void;
  onMoveFloor: (idx: number, dir: number) => void;
}

function card(r: EditorRunCard): string {
  const badge = r.source === "draft" ? `<span class="ed-badge draft">드래프트</span>` : `<span class="ed-badge repo">repo</span>`;
  const valid = r.valid ? `<span class="ed-ok">✓ 유효</span>` : `<span class="ed-bad">✗ 오류</span>`;
  const editLabel = r.source === "draft" ? "편집" : "복제→편집";
  const draftActions = r.source === "draft" ? `<button class="ed-btn ghost" data-del="${r.id}">삭제</button>` : "";
  const exportBtn = r.source === "draft" ? `<button class="ed-btn ghost" data-export="${r.id}">내보내기</button>` : "";
  return `<div class="ed-card">
    <div class="ed-card-head">${badge}<span class="ed-name">${esc(r.name)}</span>${valid}</div>
    <div class="ed-card-meta">층 ${r.floors}개 · <span class="dim">${esc(r.id)}</span></div>
    <div class="ed-card-actions">
      <button class="ed-btn" data-edit="${r.id}">✎ ${editLabel}</button>
      <button class="ed-btn"${r.valid ? "" : " disabled"} data-test="${r.id}">▶ 테스트</button>
      ${exportBtn}${draftActions}
    </div>
  </div>`;
}

function renderList(app: HTMLElement, data: ListData, h: EditorHandlers): void {
  const cards = data.runs.map(card).join("") || `<div class="ed-empty">아직 런이 없습니다. "새 런 만들기"로 시작하세요.</div>`;
  app.innerHTML = `<div class="editor">
    <header><h1>🗺 맵 에디터</h1><button class="hub-link" id="ed-back">타이틀로</button></header>
    <div class="ed-body">
      <div class="ed-toolbar"><button class="act" id="ed-new">＋ 새 런 만들기</button>
        <span class="hint">드래프트는 즉시 편집·테스트. 내보내기로 JSON을 받아 <code>src/data/runs/</code>에 커밋하면 배포본이 됩니다.</span></div>
      <div class="ed-list">${cards}</div>
    </div>
  </div>`;
  app.querySelector("#ed-back")!.addEventListener("click", () => h.onBack());
  app.querySelector("#ed-new")!.addEventListener("click", () => h.onNew());
  app.querySelectorAll<HTMLElement>("[data-edit]").forEach((b) => b.addEventListener("click", () => h.onEdit(b.dataset.edit!)));
  app.querySelectorAll<HTMLElement>("[data-test]").forEach((b) => b.addEventListener("click", () => h.onTest(b.dataset.test!)));
  app.querySelectorAll<HTMLElement>("[data-export]").forEach((b) => b.addEventListener("click", () => h.onExport(b.dataset.export!)));
  app.querySelectorAll<HTMLElement>("[data-del]").forEach((b) => b.addEventListener("click", () => h.onDelete(b.dataset.del!)));
}

export function renderEditor(app: HTMLElement, data: EditorData, h: EditorHandlers): void {
  if (data.mode === "list") renderList(app, data, h);
  else renderEditView(app, data, h);
}
