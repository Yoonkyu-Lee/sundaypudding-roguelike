// 맵 에디터 드래프트 영속 (localStorage) + 런 목록 병합. (meta.ts/save.ts 패턴)
// 진실 = repo JSON(RUNS). 드래프트는 브라우저 작업본 — 즉시 편집·테스트, 내보내기로 repo 커밋.
import type { RunDef } from "../../core/types.ts";
import { RUNS } from "../../data/runs/index.ts";

const KEY = "spr_editor_drafts_v1";
type Drafts = Record<string, RunDef>;

/** RunDef 최소 스키마 가드 — 손상 드래프트 폐기. */
function loadable(d: unknown): d is RunDef {
  const r = d as RunDef | null;
  return !!r && typeof r.id === "string" && typeof r.name === "string" && Array.isArray(r.floors) && Array.isArray(r.roster);
}
function load(): Drafts {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const o = JSON.parse(s);
      if (o && typeof o === "object") {
        const out: Drafts = {};
        for (const id in o) if (loadable(o[id])) out[id] = o[id];
        return out;
      }
    }
  } catch { /* 무시 */ }
  return {};
}
let drafts: Drafts = load();
function persist(): void { try { localStorage.setItem(KEY, JSON.stringify(drafts)); } catch { /* */ } }

export type RunSource = "repo" | "draft";
export interface RunListItem { id: string; name: string; source: RunSource; }

/** 런 목록 = 드래프트(편집가능) + repo RUNS(읽기전용). 같은 id면 드래프트 우선. */
export function listRuns(): RunListItem[] {
  const out: RunListItem[] = Object.values(drafts).map((r) => ({ id: r.id, name: r.name, source: "draft" as const }));
  for (const r of Object.values(RUNS)) if (!drafts[r.id]) out.push({ id: r.id, name: r.name, source: "repo" });
  return out;
}
export function getRun(id: string): RunDef | undefined { return drafts[id] ?? RUNS[id]; }
export function isDraft(id: string): boolean { return !!drafts[id]; }
export function saveDraft(def: RunDef): void { drafts[def.id] = def; persist(); }
export function deleteDraft(id: string): void { delete drafts[id]; persist(); }

/** 새 빈 런: 층 1개(입장 start + 목표 clear, 인접·연결). 바로 유효·테스트플레이 가능. */
export function blankRun(): RunDef {
  const id = `draft_${Date.now()}`;
  return {
    id,
    name: "새 런",
    useMastery: false,
    entryFloorId: "f1",
    roster: [
      { charId: "kim", pos: { row: 1, col: 0 } },
      { charId: "shin", pos: { row: 2, col: 0 } },
      { charId: "shanghai", pos: { row: 1, col: 2 } },
      { charId: "cho", pos: { row: 2, col: 2 } },
    ],
    floors: [
      {
        id: "f1", name: "1층", entryNodeId: "n_start",
        nodes: [
          { id: "n_start", type: "start", q: 0, r: 0 },
          { id: "n_clear", type: "clear", q: 0, r: 1 },
        ],
        edges: [{ from: "n_start", to: "n_clear" }],
      },
    ],
  };
}

/** 드래프트를 새 id로 복제(편집용 — repo 런 편집 시). */
export function cloneAsDraft(def: RunDef): RunDef {
  const copy: RunDef = JSON.parse(JSON.stringify(def));
  copy.id = `draft_${Date.now()}`;
  copy.name = `${def.name} (복사본)`;
  return copy;
}

/** {id}.json 다운로드 — repo src/data/runs/에 넣어 커밋(공유·배포 진실). */
export function exportRun(id: string): void {
  const def = getRun(id);
  if (!def) return;
  const blob = new Blob([JSON.stringify(def, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${def.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
