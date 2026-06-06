// 런 에디터 렌더 — 런 목록(E1) ↔ 단일 층 편집(E2) 디스패치. 층 그래프 패널 = E3.
import { esc } from "../battle/shared.ts";
import type { NodeType } from "../../contract/types.ts";
import type { RunSource } from "./store.ts";
import { renderEditView } from "./editView.ts";
import { renderNodeEditView } from "./nodeEditView.ts";

export interface EditorRunCard { id: string; name: string; source: RunSource; floors: number; valid: boolean; }
export interface ListData { mode: "list"; runs: EditorRunCard[]; }

export interface RosterEntry { charId: string; pos: { row: number; col: number }; }
export interface EditNode { id: string; type: NodeType; q: number; r: number; icon: string; name: string; toFloor?: string; label?: string; hasCore?: boolean; }
export interface EditData {
  mode: "edit";
  id: string; // 편집 중 드래프트 id (repo 저장용)
  name: string;
  floorName: string;
  valid: boolean;
  errors: string[];
  deadNodes: string[];
  entryId: string;
  sel: string[]; // 다중 선택
  floors: { id: string; name: string; valid: boolean; toFloors: string[] }[]; // 층 그래프(toFloors=clear→다음 층)
  floorIdx: number;
  entryFloorId: string; // 입장 층(★)
  nodes: EditNode[];
  edges: { a: string; b: string }[]; // 연결된 인접쌍
  walls: { a: string; b: string }[]; // 인접·미연결 = 세워진 벽
  catalog: { type: NodeType; icon: string; name: string }[];
  templates: { id: string; name: string; type: NodeType; icon: string }[]; // 저장된 노드 템플릿(복제 배치용)
  camera: { zoom: number; x: number; y: number }; // 노드 맵 뷰포트 카메라(줌·팬) — 편집 중 보존
  floorCamera: { zoom: number; x: number; y: number }; // 층 그래프 뷰포트 카메라 — 편집 중 보존
  splitH: number | null; // 노드 맵 뷰포트 높이(px) — 스플리터 조절, null=CSS 기본
}
// 전용 노드 에디터(Phase E) — 더블클릭한 노드의 레이어(onEnter·core·onResolve 슬롯) 편집
export type LayerSlot = "onEnter" | "core" | "onResolve";
export interface NodeEditData {
  mode: "nodeEdit";
  nodeId: string;
  nodeName: string;
  onEnter: import("../../contract/types.ts").Layer[];
  core: import("../../contract/types.ts").Layer[];
  onResolve: import("../../contract/types.ts").Layer[];
  sel: { slot: LayerSlot; idx: number } | null; // 선택 레이어
  rules: import("../../contract/types.ts").NodeRule[]; // 노드 트리거 룰(Phase C/E4) — owner 포함
  selRule: number | null; // 편집 중 룰 인덱스
  allies: RosterEntry[]; // RunDef.roster — 전장 아군(읽기전용 표시·룰 소유자 후보)
  combatRoster: RosterEntry[]; // 선택 combat 레이어의 적(룰 소유자 후보)
  eventLayer: import("../../contract/types.ts").EncounterEvent | null; // 선택 event 레이어의 인라인 이벤트(없으면 null)
}
export type EditorData = ListData | EditData | NodeEditData;

export interface EditorHandlers {
  onNew: () => void;
  onTest: (id: string) => void;
  onExport: (id: string) => void;
  onSaveToRepo: (id: string) => void; // dev: repo JSON 자동 기록 (F3)
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onBack: () => void;
  // 편집 화면 (E2/E4)
  onPlaceNode: (type: NodeType, q: number, r: number) => void;
  onPlaceTemplate: (templateId: string, q: number, r: number) => void; // 템플릿 복제 배치
  onSaveTemplate: () => void; // 현재 편집 노드를 템플릿으로 저장(노드 에디터)
  onDeleteTemplate: (templateId: string) => void; // 템플릿 라이브러리에서 제거
  onMoveNode: (id: string, q: number, r: number) => void; // 선택군이면 일괄 이동
  onNodeClick: (id: string, additive: boolean) => void; // additive=Ctrl(토글)
  onSelectAll: () => void;
  onClearSel: () => void;
  onToggleEdge: (a: string, b: string) => void;
  onCamera: (cam: { zoom: number; x: number; y: number }) => void; // 노드 맵 카메라 변경 영속(재렌더 없음)
  onFloorCamera: (cam: { zoom: number; x: number; y: number }) => void; // 층 그래프 카메라 변경 영속(재렌더 없음)
  onSplit: (px: number) => void; // 뷰포트 분할 높이 영속(재렌더 없음)
  onSetRunName: (name: string) => void; // 런 제목 편집
  onSetFloorName: (name: string) => void; // 현재 층 제목 편집
  onDeleteSel: () => void; // 선택 전부 삭제(입장 제외)
  onTestCurrent: () => void;
  // 층 그래프 패널 (E3 + F1)
  onAddFloor: () => void;
  onSelectFloor: (idx: number) => void;
  onDeleteFloor: (idx: number) => void;
  onMoveFloor: (idx: number, dir: number) => void;
  onSetEntryFloor: (id: string) => void; // 입장 층 지정 (F1)
  onSetNodeToFloor: (id: string, toFloor: string | null) => void; // clear 노드 다음 층 (F1)
  // 노드 메타데이터 (F2)
  onSetNodeLabel: (id: string, label: string) => void; // 표시 라벨
  // 노드 에디터 (Phase E)
  onOpenNodeEditor: (id: string) => void; // 노드 더블클릭 → 전용 화면
  onAddLayer: (slot: LayerSlot, kind: string) => void; // 슬롯에 레이어 추가(기본값)
  onRemoveLayer: (slot: LayerSlot, idx: number) => void;
  onMoveLayer: (slot: LayerSlot, idx: number, dir: number) => void; // 순서 ↑(-1)/↓(+1)
  onSelectLayer: (slot: LayerSlot, idx: number) => void;
  onSetLayerField: (slot: LayerSlot, idx: number, key: string, value: string | number | boolean | RosterEntry[]) => void;
  // 트리거 룰 (Phase E4) — 선택 룰(selRule) 대상으로 동작
  onAddRule: () => void;
  onRemoveRule: (idx: number) => void;
  onSelectRule: (idx: number) => void;
  onSetWhen: (kind: string) => void; // when 트리거 종류 교체(기본값으로)
  onSetWhenField: (key: string, value: string | number | boolean) => void;
  onAddCond: (kind: string) => void;
  onRemoveCond: (ci: number) => void;
  onSetCondField: (ci: number, key: string, value: string | number | boolean) => void;
  onAddEffect: (kind: string) => void;
  onRemoveEffect: (ei: number) => void;
  onSetEffectField: (ei: number, key: string, value: string | number | boolean) => void;
  onSetRuleOwner: (owner: { side: "ally" | "enemy"; charId: string } | null) => void; // 룰 소유자(화자/기준) 지정
  // event 레이어 인라인 이벤트 저작 (Phase D 슬라이스2)
  onCreateEvent: () => void;
  onSetEventField: (key: string, value: string) => void; // title/text
  onAddChoice: () => void;
  onRemoveChoice: (ci: number) => void;
  onSetChoiceLabel: (ci: number, value: string) => void;
  onSetChoiceOutcome: (ci: number, kind: string) => void;
  onSetOutcomeField: (ci: number, key: string, value: number) => void;
  // 도박(gamble) 선택지 — 확정↔도박 전환 + 확률·성공/실패 결과
  onSetChoiceMode: (ci: number, mode: "fixed" | "gamble") => void;
  onSetGambleChance: (ci: number, chance: number) => void;
  onSetGambleOutcome: (ci: number, branch: "win" | "lose", kind: string) => void;
  onSetGambleOutcomeField: (ci: number, branch: "win" | "lose", key: string, value: number) => void;
  // 상점 진열(shop 레이어 offers) 저작
  onAddShopOffer: (kind: string) => void;
  onRemoveShopOffer: (idx: number) => void;
  onSetShopOfferKind: (idx: number, kind: string) => void;
  onSetShopOfferField: (idx: number, key: string, value: string | number) => void;
  onSetKeepGenerated: (value: boolean) => void;
}

function card(r: EditorRunCard): string {
  const badge = r.source === "draft" ? `<span class="ed-badge draft">드래프트</span>` : `<span class="ed-badge repo">repo</span>`;
  const valid = r.valid ? `<span class="ed-ok">✓ 유효</span>` : `<span class="ed-bad">✗ 오류</span>`;
  const editLabel = r.source === "draft" ? "편집" : "복제→편집";
  const draftActions = r.source === "draft" ? `<button class="ed-btn ghost" data-del="${r.id}">삭제</button>` : "";
  const exportBtn = r.source === "draft" ? `<button class="ed-btn ghost" data-saverepo="${r.id}">💾 repo에 저장</button><button class="ed-btn ghost" data-export="${r.id}">내보내기</button>` : "";
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
    <header><h1>🗺 런 에디터</h1><button class="hub-link" id="ed-back">타이틀로</button></header>
    <div class="ed-body">
      <div class="ed-toolbar"><button class="act" id="ed-new">＋ 새 런 만들기</button>
        <span class="hint">드래프트는 즉시 편집·테스트. 내보내기로 JSON을 받아 <code>src/content/runs/</code>에 커밋하면 배포본이 됩니다.</span></div>
      <div class="ed-list">${cards}</div>
    </div>
  </div>`;
  app.querySelector("#ed-back")!.addEventListener("click", () => h.onBack());
  app.querySelector("#ed-new")!.addEventListener("click", () => h.onNew());
  app.querySelectorAll<HTMLElement>("[data-edit]").forEach((b) => b.addEventListener("click", () => h.onEdit(b.dataset.edit!)));
  app.querySelectorAll<HTMLElement>("[data-test]").forEach((b) => b.addEventListener("click", () => h.onTest(b.dataset.test!)));
  app.querySelectorAll<HTMLElement>("[data-export]").forEach((b) => b.addEventListener("click", () => h.onExport(b.dataset.export!)));
  app.querySelectorAll<HTMLElement>("[data-saverepo]").forEach((b) => b.addEventListener("click", () => h.onSaveToRepo(b.dataset.saverepo!)));
  app.querySelectorAll<HTMLElement>("[data-del]").forEach((b) => b.addEventListener("click", () => h.onDelete(b.dataset.del!)));
}

export function renderEditor(app: HTMLElement, data: EditorData, h: EditorHandlers): void {
  if (data.mode === "list") renderList(app, data, h);
  else if (data.mode === "nodeEdit") renderNodeEditView(app, data, h);
  else renderEditView(app, data, h);
}
