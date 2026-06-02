// 본거지 편성 컨트롤러 — 플레이 가능 풀에서 1~4명 선택(영구 저장), 선택 로스터로 런 생성.
// selectedRoster 상태를 캡슐화. main은 makeRun/data/toggle만 호출. (메커니즘=엔진, 선택=플레이어 런타임)
import { createRun, type RunState } from "../core/run.ts";
import type { GameMode } from "../core/types.ts";
import { CHARACTERS } from "../data/characters.ts";
import { MODES, rosterFromIds } from "../data/modes.ts";
import { masteryMap, masteryInfo, getRoster, setRoster } from "./meta.ts";
import type { HubData } from "./shell.ts";

const MAX_ROSTER = 4;

export interface Hub {
  makeRun(seed: number): RunState;
  data(run: RunState, runActive: boolean): HubData;
  toggle(charId: string): void; // 편성 선택 토글(최소1·최대4). 런 잠금은 호출자가 판단
}

export function createHub(mode: GameMode = MODES.normal): Hub {
  const playable = Object.values(CHARACTERS).filter((c) => c.playable);
  let selected = getRoster(mode.roster.map((m) => m.charId)).filter((id) => CHARACTERS[id]?.playable).slice(0, MAX_ROSTER);
  if (selected.length === 0) selected = mode.roster.map((m) => m.charId).slice(0, MAX_ROSTER);

  return {
    makeRun(seed) {
      return createRun(seed, rosterFromIds(selected), mode.acts, { mastery: masteryMap(), useMastery: mode.useMastery });
    },
    data(run, runActive) {
      return {
        pool: playable.map((c) => ({ charId: c.id, name: c.name, avatar: c.avatar, mastery: masteryInfo(c.id), selected: selected.includes(c.id) })),
        selectedCount: selected.length,
        maxRoster: MAX_ROSTER,
        party: run.party.filter((m) => CHARACTERS[m.charId]).map((m) => ({ charId: m.charId, name: CHARACTERS[m.charId].name, avatar: CHARACTERS[m.charId].avatar })),
        runActive,
        act: runActive ? run.act : undefined,
        totalActs: run.acts.length,
      };
    },
    toggle(charId) {
      const i = selected.indexOf(charId);
      if (i >= 0) { if (selected.length > 1) selected.splice(i, 1); } // 최소 1명 유지
      else if (selected.length < MAX_ROSTER) selected.push(charId); // 최대 4명
      setRoster(selected);
    },
  };
}
