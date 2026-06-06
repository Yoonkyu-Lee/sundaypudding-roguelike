// 본거지 편성 컨트롤러 — 플레이 가능 풀에서 1~4명 선택(영구 저장). 런 생성은 Rust IPC(run_create_roster)가 담당.
// selectedRoster 상태를 캡슐화. 소비자(rustRun)는 data/toggle/setRun만 호출. (메커니즘=엔진, 선택=플레이어 런타임)
import type { RunState } from "../core/run.ts";
import type { RunDef } from "../core/types.ts";
import { CHARACTERS } from "../data/characters.ts";
import { DEFAULT_RUN } from "../data/runs/index.ts";
import { listRuns, getRun } from "./editor/store.ts";
import { masteryInfo, getRoster, setRoster } from "./meta.ts";
import type { HubData } from "./shell.ts";

const MAX_ROSTER = 4;

export interface Hub {
  data(run: RunState, runActive: boolean): HubData;
  toggle(charId: string): void; // 편성 선택 토글(최소1·최대4). 런 잠금은 호출자가 판단
  setRun(id: string): void; // 플레이할 런 선택(repo/드래프트). 비전투에서만
}

export function createHub(initial: RunDef = DEFAULT_RUN): Hub {
  const playable = Object.values(CHARACTERS).filter((c) => c.playable);
  let runDef = initial;
  let selected = getRoster(runDef.roster.map((m) => m.charId)).filter((id) => CHARACTERS[id]?.playable).slice(0, MAX_ROSTER);
  if (selected.length === 0) selected = runDef.roster.map((m) => m.charId).slice(0, MAX_ROSTER);

  return {
    data(run, runActive) {
      return {
        pool: playable.map((c) => ({ charId: c.id, name: c.name, avatar: c.avatar, mastery: masteryInfo(c.id), selected: selected.includes(c.id) })),
        selectedCount: selected.length,
        maxRoster: MAX_ROSTER,
        runs: listRuns().map((r) => ({ id: r.id, name: r.name, source: r.source, selected: r.id === runDef.id })),
        runName: runDef.name,
        party: run.party.filter((m) => CHARACTERS[m.charId]).map((m) => ({ charId: m.charId, name: CHARACTERS[m.charId].name, avatar: CHARACTERS[m.charId].avatar })),
        runActive,
        floor: runActive ? run.floor + 1 : undefined,
        totalFloors: run.runDef.floors.length,
      };
    },
    toggle(charId) {
      const i = selected.indexOf(charId);
      if (i >= 0) { if (selected.length > 1) selected.splice(i, 1); } // 최소 1명 유지
      else if (selected.length < MAX_ROSTER) selected.push(charId); // 최대 4명
      setRoster(selected);
    },
    setRun(id) { const r = getRun(id); if (r) runDef = r; },
  };
}
