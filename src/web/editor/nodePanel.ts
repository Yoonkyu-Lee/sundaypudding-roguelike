// 맵 에디터 — 노드 메타 사이드바 패널. 라벨 편집(표시명). 적 배치·내용물은 노드 에디터(더블클릭)에서.
import { esc } from "../battle/shared.ts";
import type { EditData, EditNode, EditorHandlers } from "./editorRender.ts";

/** 노드 1개 선택 시 라벨 입력. (적 구성·레이어는 더블클릭 → 노드 에디터.) */
export function nodeMetaPanel(_d: EditData, n: EditNode): string {
  return `<div class="ed-meta"><label class="ed-meta-row">라벨 <input id="ednm-label" type="text" maxlength="24" placeholder="${esc(n.name)}" value="${esc(n.label ?? "")}"></label>
    <div class="hint">적 배치·레이어·트리거 룰은 노드를 <b>더블클릭</b>해 편집.</div></div>`;
}

/** nodeMetaPanel 와이어링. 단일 선택 노드 id = d.sel[0]. */
export function wireNodeMeta(app: HTMLElement, d: EditData, h: EditorHandlers): void {
  const id = d.sel[0];
  if (d.sel.length !== 1) return;
  app.querySelector<HTMLInputElement>("#ednm-label")?.addEventListener("change", (e) => h.onSetNodeLabel(id, (e.target as HTMLInputElement).value));
}
