// 맵 에디터 컨트롤러 — 목록↔편집 모드 상태 + 핸들러. main은 run 수명주기 콜백만 주입.
import { validateRun } from "../../core/run.ts";
import type { Condition, Effect, EncounterEvent, EncounterOutcome, FloorDef, Layer, MapNode, RunDef, Trigger } from "../../core/types.ts";
import { listRuns, getRun, saveDraft, deleteDraft, blankRun, exportRun, isDraft, cloneAsDraft, saveToRepo } from "./store.ts";
import { addNode, moveNode, moveNodes, deleteNode, toggleEdge, adjacentPairs, addFloor, deleteFloor, moveFloor, setNodeLabel } from "./ops.ts";
import { NODE_ROSTERS } from "../../data/encounters.ts";

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
import { CATALOG_TYPES, TYPE_ICON, TYPE_NAME } from "../nodeMeta.ts";
import { LAYER_SPECS } from "./layerSchema.ts";
import { WHEN_SPECS, COND_SPECS, EFFECT_SPECS } from "./ruleSchema.ts";
import type { EditorData, EditorHandlers, LayerSlot } from "./editorRender.ts";

/** 노드의 레이어 슬롯 배열을 보장·반환(없으면 생성). onEnter/onResolve는 데코 전용이나 편의상 Layer[]로 다룸(UI가 kind 제한). */
function slotArray(nd: MapNode, slot: LayerSlot): Layer[] {
  if (slot === "core") return (nd.core ??= []);
  const ly = (nd.layers ??= {});
  if (slot === "onEnter") return (ly.onEnter ??= []) as Layer[];
  return (ly.onResolve ??= []) as Layer[];
}

export interface EditorDeps {
  testRun: (def: RunDef) => void; // 즉시 플레이(허브 우회)
  rerender: () => void;
  toTitle: () => void;
}

export function createEditor(deps: EditorDeps): { data: () => EditorData; handlers: EditorHandlers } {
  let mode: "list" | "edit" | "nodeEdit" = "list";
  let draft: RunDef | null = null;
  let floorIdx = 0;
  let nodeEditId: string | null = null; // 노드 에디터 대상(Phase E)
  let selLayerRef: { slot: LayerSlot; idx: number } | null = null; // 선택 레이어(슬롯+인덱스)
  let selRule: number | null = null; // 편집 중 트리거 룰 인덱스(Phase E4)
  let sel: string[] = [];
  let camera = { zoom: 1, x: 0, y: 0 };
  let floorCamera = { zoom: 1, x: 0, y: 0 }; // 층 그래프 뷰포트 카메라(편집 중 보존)
  let splitH: number | null = null; // 노드 맵 뷰포트 높이(px) — 스플리터로 조절, 편집 중 보존(null=CSS 기본)

  const floor = (): FloorDef => draft!.floors[floorIdx];
  const editNode = () => floor().nodes.find((n) => n.id === nodeEditId) ?? null; // 노드 에디터 대상
  const layerAt = () => { const nd = editNode(); if (!nd || !selLayerRef) return null; const arr = selLayerRef.slot === "core" ? nd.core : selLayerRef.slot === "onEnter" ? nd.layers?.onEnter : nd.layers?.onResolve; return arr?.[selLayerRef.idx] ?? null; }; // 선택 레이어
  const editRule = () => { const lay = layerAt(); return lay && lay.kind === "combat" && selRule !== null ? lay.rules?.[selRule] ?? null : null; }; // 편집 중 룰(선택 combat 레이어 소유)
  const save = () => { if (draft) saveDraft(draft); };

  function openEdit(id: string): void {
    const def = getRun(id);
    if (!def) return;
    if (isDraft(id)) draft = def;
    else { draft = cloneAsDraft(def); saveDraft(draft); } // repo 런은 드래프트로 복제 후 편집
    floorIdx = 0; sel = []; camera = { zoom: 1, x: NaN, y: NaN }; floorCamera = { zoom: 1, x: NaN, y: NaN }; mode = "edit"; // NaN=뷰가 첫 진입 시 중앙 정렬
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
      id: draft!.id,
      name: draft!.name,
      floorName: f.name ?? `층 ${floorIdx + 1}`,
      valid: v.ok,
      errors: fv?.errors ?? [],
      deadNodes: fv?.deadNodes ?? [],
      entryId: f.entryNodeId,
      sel: [...sel],
      floors: draft!.floors.map((fl, i) => ({ id: fl.id, name: fl.name ?? `층 ${i + 1}`, valid: v.floors[i].ok, toFloors: [...new Set(fl.nodes.filter((n) => n.type === "clear" && n.toFloor).map((n) => n.toFloor!))] })),
      floorIdx,
      entryFloorId: draft!.entryFloorId,
      nodes: f.nodes.map((n) => ({ id: n.id, type: n.type, q: n.q, r: n.r, icon: TYPE_ICON[n.type], name: TYPE_NAME[n.type], toFloor: n.toFloor, label: n.label, hasCore: !!(n.core && n.core.length) })),
      edges: f.edges.map((e) => ({ a: e.from, b: e.to })), // 연결(실선)
      walls: adjacentPairs(f).filter((p) => !connected.has(edgeKey(p.a, p.b))), // 인접·미연결 = 세워진 벽
      catalog: CATALOG_TYPES.map((t) => ({ type: t, icon: TYPE_ICON[t], name: TYPE_NAME[t] })),
      camera: { ...camera },
      floorCamera: { ...floorCamera },
      splitH,
    };
  }

  function nodeEditData(): EditorData {
    const nd = editNode();
    return {
      mode: "nodeEdit",
      nodeId: nodeEditId!,
      nodeName: nd?.label ?? (nd ? TYPE_NAME[nd.type] : nodeEditId!),
      onEnter: nd?.layers?.onEnter ?? [],
      core: nd?.core ?? [],
      onResolve: nd?.layers?.onResolve ?? [],
      sel: selLayerRef,
      rules: (() => { const lay = layerAt(); return lay && lay.kind === "combat" ? lay.rules ?? [] : []; })(), // 선택 combat 레이어의 룰
      selRule,
      allies: draft!.roster.map((m) => ({ charId: m.charId, pos: { ...m.pos } })), // 전장 아군(읽기전용)
      combatRoster: (() => { const lay = layerAt(); if (lay?.kind !== "combat") return []; return lay.roster && lay.roster.length ? lay.roster : (NODE_ROSTERS.battle as { charId: string; pos: { row: number; col: number } }[]); })(), // 룰 소유자 후보(적)
      eventLayer: (() => { const lay = layerAt(); return lay?.kind === "event" ? lay.event ?? null : null; })(), // 선택 event 레이어의 인라인 이벤트
    };
  }

  /** 선택 event 레이어의 인라인 이벤트(있을 때). */
  const editEvent = (): EncounterEvent | null => { const lay = layerAt(); return lay?.kind === "event" ? lay.event ?? null : null; };
  const OUTCOME_DEFAULT: Record<string, EncounterOutcome> = { nothing: { kind: "nothing" }, heal: { kind: "heal", pct: 0.3 }, hurt: { kind: "hurt", pct: 0.15 }, gold: { kind: "gold", amount: 20 }, upgradeRandom: { kind: "upgradeRandom" }, learnUniversal: { kind: "learnUniversal" } };

  return {
    data: () => (mode === "list" ? listData() : mode === "nodeEdit" ? nodeEditData() : editData()),
    handlers: {
      onNew() { saveDraft(blankRun()); deps.rerender(); },
      onTest(id) { const d = getRun(id); if (d && validateRun(d).ok) deps.testRun(d); },
      onExport(id) { exportRun(id); },
      async onSaveToRepo(id) {
        const def = getRun(id); if (!def) return;
        const suggested = def.id.replace(/^draft_/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "myrun";
        const fileId = prompt("repo 파일명 (런 id) — 영숫자·_·- 만:", suggested);
        if (!fileId) return;
        const r = await saveToRepo(id, fileId);
        if (r.ok) alert(`저장됨 → src/data/runs/${fileId}.json (레지스트리 자동 갱신). git에 커밋하세요.`);
        else { alert(`repo 저장 실패: ${r.error}\nJSON 다운로드로 폴백합니다.`); exportRun(id); }
      },
      onDelete(id) { deleteDraft(id); deps.rerender(); },
      onEdit(id) { openEdit(id); },
      onBack() {
        if (mode === "nodeEdit") { mode = "edit"; nodeEditId = null; selLayerRef = null; selRule = null; deps.rerender(); return; }
        if (mode === "edit") { mode = "list"; draft = null; sel = []; deps.rerender(); return; }
        deps.toTitle();
      },
      onPlaceNode(type, q, r) { if (!draft) return; addNode(floor(), type, q, r); save(); deps.rerender(); },
      onMoveNode(id, q, r) {
        if (!draft) return;
        const n = floor().nodes.find((x) => x.id === id);
        if (sel.includes(id) && sel.length > 1 && n) moveNodes(floor(), sel, q - n.q, r - n.r); // 선택군 일괄 이동
        else moveNode(floor(), id, q, r);
        save(); deps.rerender();
      },
      onNodeClick(id, additive) {
        if (!draft) return;
        if (additive) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]; // Ctrl=토글
        else sel = [id];
        deps.rerender();
      },
      onSelectAll() { if (!draft) return; sel = floor().nodes.map((n) => n.id); deps.rerender(); },
      onClearSel() { if (!sel.length) return; sel = []; deps.rerender(); },
      onToggleEdge(a, b) { if (!draft) return; toggleEdge(floor(), a, b); save(); deps.rerender(); }, // 변 클릭=연결/벽 토글
      onCamera(cam) { camera = cam; }, // 영속만(DOM은 호출자가 직접 갱신 — 재렌더 없음)
      onFloorCamera(cam) { floorCamera = cam; }, // 층 그래프 카메라 영속(재렌더 없음)
      onSplit(px) { splitH = px; }, // 뷰포트 분할 높이 영속(재렌더 없음)
      onSetRunName(name) { if (!draft) return; draft.name = name.trim() || draft.name; save(); deps.rerender(); },
      onSetFloorName(name) { if (!draft) return; floor().name = name.trim() || undefined; save(); deps.rerender(); },
      onDeleteSel() { if (!draft || !sel.length) return; for (const id of sel) if (id !== floor().entryNodeId) deleteNode(floor(), id); sel = []; save(); deps.rerender(); },
      onTestCurrent() { if (draft && validateRun(draft).ok) deps.testRun(draft); },
      onAddFloor() { if (!draft) return; addFloor(draft); floorIdx = draft.floors.length - 1; sel = []; save(); deps.rerender(); },
      onSelectFloor(i) { floorIdx = i; sel = []; deps.rerender(); },
      onDeleteFloor(i) { if (!draft) return; deleteFloor(draft, i); if (floorIdx >= draft.floors.length) floorIdx = draft.floors.length - 1; sel = []; save(); deps.rerender(); },
      onMoveFloor(i, dir) { if (!draft) return; moveFloor(draft, i, dir); if (i === floorIdx) floorIdx = Math.max(0, Math.min(draft.floors.length - 1, i + dir)); save(); deps.rerender(); },
      onSetEntryFloor(id) { if (!draft) return; draft.entryFloorId = id; save(); deps.rerender(); },
      onSetNodeToFloor(id, toFloor) { if (!draft) return; const nd = floor().nodes.find((n) => n.id === id); if (nd && nd.type === "clear") { if (toFloor) nd.toFloor = toFloor; else delete nd.toFloor; save(); deps.rerender(); } },
      onSetNodeLabel(id, label) { if (!draft) return; setNodeLabel(floor(), id, label); save(); deps.rerender(); },
      // 노드 에디터 (Phase E) — 슬롯(onEnter/core/onResolve)별 레이어 편집
      onOpenNodeEditor(id) { if (!draft) return; const nd = floor().nodes.find((n) => n.id === id); if (!nd) return; nodeEditId = id; selLayerRef = nd.core && nd.core.length ? { slot: "core", idx: 0 } : null; selRule = null; mode = "nodeEdit"; deps.rerender(); },
      onAddLayer(slot, kind) { const nd = editNode(); const spec = LAYER_SPECS[kind]; if (!nd || !spec) return; const arr = slotArray(nd, slot); arr.push(spec.make()); selLayerRef = { slot, idx: arr.length - 1 }; save(); deps.rerender(); },
      onRemoveLayer(slot, idx) { const nd = editNode(); if (!nd) return; const arr = slotArray(nd, slot); arr.splice(idx, 1); selLayerRef = arr.length ? { slot, idx: Math.min(idx, arr.length - 1) } : null; save(); deps.rerender(); },
      onMoveLayer(slot, idx, dir) { const nd = editNode(); if (!nd) return; const arr = slotArray(nd, slot); const j = idx + dir; if (j < 0 || j >= arr.length) return; [arr[idx], arr[j]] = [arr[j], arr[idx]]; if (selLayerRef && selLayerRef.slot === slot && selLayerRef.idx === idx) selLayerRef = { slot, idx: j }; save(); deps.rerender(); },
      onSelectLayer(slot, idx) { selLayerRef = { slot, idx }; selRule = null; deps.rerender(); }, // 레이어 바꾸면 룰 선택 초기화(룰은 레이어 소유)
      onSetLayerField(slot, idx, key, value) { const nd = editNode(); if (!nd) return; const arr = slotArray(nd, slot); if (!arr[idx]) return; (arr[idx] as Record<string, unknown>)[key] = value; save(); deps.rerender(); },
      // 트리거 룰 (Phase E4) — 선택 룰(selRule) 대상
      onAddRule() { const lay = layerAt(); if (lay?.kind !== "combat") return; (lay.rules ??= []).push({ when: { on: "battleStart" }, then: [] }); selRule = lay.rules.length - 1; save(); deps.rerender(); },
      onRemoveRule(idx) { const lay = layerAt(); if (lay?.kind !== "combat" || !lay.rules) return; lay.rules.splice(idx, 1); selRule = lay.rules.length ? Math.min(idx, lay.rules.length - 1) : null; save(); deps.rerender(); },
      onSelectRule(idx) { selRule = idx; deps.rerender(); },
      onSetWhen(kind) { const r = editRule(); const s = WHEN_SPECS[kind]; if (!r || !s) return; r.when = s.make() as Trigger; save(); deps.rerender(); },
      onSetWhenField(key, value) { const r = editRule(); if (!r) return; (r.when as Record<string, unknown>)[key] = value; save(); deps.rerender(); },
      onAddCond(kind) { const r = editRule(); const s = COND_SPECS[kind]; if (!r || !s) return; (r.if ??= []).push(s.make() as Condition); save(); deps.rerender(); },
      onRemoveCond(ci) { const r = editRule(); if (!r?.if) return; r.if.splice(ci, 1); save(); deps.rerender(); },
      onSetCondField(ci, key, value) { const r = editRule(); if (!r?.if?.[ci]) return; (r.if[ci] as Record<string, unknown>)[key] = value; save(); deps.rerender(); },
      onAddEffect(kind) { const r = editRule(); const s = EFFECT_SPECS[kind]; if (!r || !s) return; r.then.push(s.make() as Effect); save(); deps.rerender(); },
      onRemoveEffect(ei) { const r = editRule(); if (!r) return; r.then.splice(ei, 1); save(); deps.rerender(); },
      onSetEffectField(ei, key, value) { const r = editRule(); if (!r?.then?.[ei]) return; (r.then[ei] as Record<string, unknown>)[key] = value; save(); deps.rerender(); },
      onSetRuleOwner(owner) { const r = editRule() as { owner?: { side: "ally" | "enemy"; charId: string } } | null; if (!r) return; if (owner) r.owner = owner; else delete r.owner; save(); deps.rerender(); },
      // event 레이어 인라인 이벤트 저작 (Phase D 슬라이스2)
      onCreateEvent() { const lay = layerAt(); if (lay?.kind !== "event") return; lay.event = { id: "node_event", title: "새 인카운터", text: "", choices: [] }; save(); deps.rerender(); },
      onSetEventField(key, value) { const ev = editEvent(); if (!ev) return; (ev as unknown as Record<string, unknown>)[key] = value; save(); deps.rerender(); },
      onAddChoice() { const ev = editEvent(); if (!ev) return; ev.choices.push({ id: `c${ev.choices.length}`, label: "선택지", result: { kind: "nothing" } }); save(); deps.rerender(); },
      onRemoveChoice(ci) { const ev = editEvent(); if (!ev) return; ev.choices.splice(ci, 1); save(); deps.rerender(); },
      onSetChoiceLabel(ci, value) { const ev = editEvent(); if (!ev?.choices[ci]) return; ev.choices[ci].label = value; save(); deps.rerender(); },
      onSetChoiceOutcome(ci, kind) { const ev = editEvent(); if (!ev?.choices[ci]) return; ev.choices[ci].result = { ...(OUTCOME_DEFAULT[kind] ?? { kind: "nothing" }) }; delete ev.choices[ci].gamble; save(); deps.rerender(); },
      onSetOutcomeField(ci, key, value) { const ev = editEvent(); const r = ev?.choices[ci]?.result; if (!r) return; (r as Record<string, unknown>)[key] = value; save(); deps.rerender(); },
    },
  };
}
