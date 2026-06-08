// 본거지 편성 컨트롤러 — 플레이 가능 풀에서 1~4명 선택(영구 저장). 런 생성은 Rust IPC(run_create_roster)가 담당.
// selectedRoster 상태를 캡슐화. 소비자(rustRun)는 data/toggle/setRun만 호출. (메커니즘=엔진, 선택=플레이어 런타임)
import type { RunState } from "../contract/run.ts";
import type { RunDef } from "../contract/types.ts";
import { CHARACTERS } from "../content/characters.ts";
import { DEFAULT_RUN } from "../content/runs/index.ts";
import { listRuns, getRun } from "./editor/store.ts";
import { masteryInfo, getRoster, setRoster } from "./meta.ts";
import type { HubData, HubMode } from "./shell.ts";

const MAX_ROSTER = 4;

export interface Hub {
  data(run: RunState, runActive: boolean, hubMode: HubMode): HubData;
  toggle(charId: string): void; // 편성 선택 토글(최소1·최대4). 런 잠금은 호출자가 판단(비캠페인 모드용, 휴면)
  setRun(id: string): void; // 플레이할 런 선택(repo/드래프트). 비전투에서만
  selectedRunDef(): RunDef; // 현재 선택 런 정의 — 캠페인은 이 고정 로스터로 시작
}

export function createHub(initial: RunDef = DEFAULT_RUN): Hub {
  const playable = Object.values(CHARACTERS).filter((c) => c.playable);
  let runDef = initial;
  let selected = getRoster(runDef.roster.map((m) => m.charId)).filter((id) => CHARACTERS[id]?.playable).slice(0, MAX_ROSTER);
  if (selected.length === 0) selected = runDef.roster.map((m) => m.charId).slice(0, MAX_ROSTER);

  return {
    data(run, runActive, hubMode) {
      // 캠페인 = mode "campaign"(미지정 포함) 런만 노출. 선택 런이 목록 밖이면 첫 캠페인 런으로 보정.
      const campaign = listRuns().filter((r) => (r.mode ?? "campaign") === "campaign");
      if (!campaign.some((r) => r.id === runDef.id) && campaign.length) { const r = getRun(campaign[0].id); if (r) runDef = r; }
      return {
        hubMode,
        pool: playable.map((c) => ({ charId: c.id, name: c.name, avatar: c.avatar, mastery: masteryInfo(c.id), selected: selected.includes(c.id) })),
        selectedCount: selected.length,
        maxRoster: MAX_ROSTER,
        runs: campaign.map((r) => ({ id: r.id, name: r.name, source: r.source, selected: r.id === runDef.id })),
        runName: runDef.name,
        forcedParty: runDef.roster.filter((m) => CHARACTERS[m.charId]).map((m) => ({ charId: m.charId, name: CHARACTERS[m.charId].name, avatar: CHARACTERS[m.charId].avatar })),
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
    selectedRunDef() { return runDef; },
  };
}
