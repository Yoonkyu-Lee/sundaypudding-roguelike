// 맵 에디터 — 노드 메타데이터 사이드바 패널(F2). 라벨 입력 + 적 구성 override 미니 에디터.
// editView가 사이드바 "선택" 섹션에 끼워 넣는다. 전투 노드(battle/elite/boss)만 적 구성 편집 노출.
import { esc } from "../battle/shared.ts";
import type { EditData, EditNode, EditorHandlers } from "./editorRender.ts";
import { rosterWidget, wireRoster } from "./rosterWidget.ts";

const COMBAT = new Set(["battle", "elite", "boss"]);
const isCombat = (n: EditNode): boolean => COMBAT.has(n.type);

/** 노드 1개 선택 시 라벨 입력 + (전투 노드면) 적 구성 편집기 HTML. */
export function nodeMetaPanel(d: EditData, n: EditNode): string {
  const label = `<label class="ed-meta-row">라벨 <input id="ednm-label" type="text" maxlength="24" placeholder="${esc(n.name)}" value="${esc(n.label ?? "")}"></label>`;
  if (!isCombat(n)) return `<div class="ed-meta">${label}</div>`;
  return `<div class="ed-meta">${label}
    <div class="ed-meta-row">적 구성 <span class="hint">override (행,열 = 적 진형)</span></div>
    ${rosterWidget(n.roster ?? [], d.chars)}</div>`;
}

/** nodeMetaPanel의 입력 와이어링. 단일 선택 노드 id = d.sel[0]. */
export function wireNodeMeta(app: HTMLElement, d: EditData, h: EditorHandlers): void {
  const id = d.sel[0];
  const n = d.sel.length === 1 ? d.nodes.find((x) => x.id === id) : null;
  if (!n) return;
  app.querySelector<HTMLInputElement>("#ednm-label")?.addEventListener("change", (e) => h.onSetNodeLabel(id, (e.target as HTMLInputElement).value));
  if (!isCombat(n)) return;
  wireRoster(app, n.roster ?? [], (next) => h.onSetNodeRoster(id, next));
}
