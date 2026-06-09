// 런 진행 기록 (CDX) — 파티 보유 스킬을 도감에 공개, 런 승리 시 출연진(roster+합류 playable) 해금.
// rustRun에서 분리(순수 함수, 가변상태 없음). 메타(unlocked/seenSkills)만 갱신.
import type { RunDef } from "../contract/types.ts";
import type { RunView } from "../contract/run.ts";
import { CHARACTERS } from "../content/characters.ts";
import { markSkillsSeen, unlockChars } from "./meta.ts";

/** 런 출연진(roster + partyChange 합류) 중 playable — 클리어 시 해금 대상. */
export function playableRunCast(def: RunDef): string[] {
  const ids = new Set<string>(def.roster.map((m) => m.charId));
  for (const f of def.floors) for (const n of f.nodes)
    for (const L of [...(n.core ?? []), ...(n.layers?.onEnter ?? []), ...(n.layers?.onResolve ?? [])])
      if (L.kind === "partyChange") for (const id of L.add ?? []) ids.add(id);
  return [...ids].filter((id) => CHARACTERS[id]?.playable);
}

/** 진행 기록: 파티 보유 스킬 도감 공개 + 런 승리 시 출연진 해금. startedDef=시작한 런(승리 해금용). */
export function recordRunProgress(view: RunView | null, startedDef: RunDef | null): void {
  if (!view) return;
  markSkillsSeen(view.party.flatMap((p) => p.skills.map((s) => s.id)));
  if (view.phase === "won" && startedDef) unlockChars(playableRunCast(startedDef));
}
