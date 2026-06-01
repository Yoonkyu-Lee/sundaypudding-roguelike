// 테스트 공용 헬퍼 (결정론 전투 구동·강제 턴). 여러 *.test.ts가 공유.
import { createBattle, step } from "./engine.ts";
import { chooseAction } from "./ai.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";
import type { GameState } from "./types.ts";

/** 데모 인코딩으로 시드 전투를 종료까지 자동 플레이. */
export function playToEnd(seed: number, cap = 500): GameState {
  const state = createBattle(seed, DEMO_ENCOUNTER);
  let n = 0;
  while (state.phase === "inProgress" && n < cap) {
    step(state, chooseAction(state));
    n++;
  }
  return state;
}

/** 특정 유닛을 강제로 현재 턴으로 (명중 100% 등 결정론 검증용). */
export function forceTurn(state: GameState, uid: string): void {
  const entry = { uid, kind: "normal" as const, speed: 5 };
  state.roundOrder = [entry];
  state.cursor = 0;
  state.current = entry;
}
