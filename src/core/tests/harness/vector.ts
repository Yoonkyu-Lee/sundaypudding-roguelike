// 포팅 행동 벡터 (PORTING.md P0-1, Codex (b)) — 행동선택을 엔진에서 분리한 재생 가능 기록.
// recordVector: (seed,runDef,policy)를 구동하며 모든 결정을 RunAction[]로 기록 + canonical 이벤트 로그 산출.
// replayVector: 기록된 행동열을 fresh 런에 그대로 적용 → 같은 로그 재현.
// record→replay 바이트 동일 = "행동열은 choice-rng와 무관한 충분한 재생 기록" → Rust가 이 행동열을 재생하면
// 같은 이벤트 로그를 내야 함(differential 오라클). Codex: Rust가 행동을 자가생성하지 말고 이 벡터를 재생.
import { Rng } from "../../rng.ts";
import type { Action } from "../../types.ts";
import { step, getLegalActions, unitById } from "../../engine.ts";
import { chooseAction } from "../../ai.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, buyShopOffer, leaveShop, chooseEncounterOption } from "../../run.ts";
import type { RunState, RunDef } from "../../run.ts";
import type { ActionPolicy } from "./stressRun.ts";
import { canonicalLog } from "./canonical.ts";

/** 한 결정 = 한 RunAction. 재생 시 phase와 scope가 일치해야 한다(결정론으로 보장). */
export type RunAction =
  | { scope: "map"; nodeId: string }
  | { scope: "battle"; action: Action }
  | { scope: "reward"; optionId: string }
  | { scope: "shop"; buys: string[] } // 구매한 offer id들(순서) 후 leave
  | { scope: "encounter"; choiceId: string };

export interface PortingVector {
  seed: number;
  runId: string;
  policy: ActionPolicy;
  actions: RunAction[];
  log: string; // 전투 이벤트 로그(canonical) 연결 + 최종 다이제스트 — Rust가 바이트 대조할 기준
}

const pick = <T>(rng: Rng, a: T[]): T => a[rng.int(0, a.length - 1)];

function digest(run: RunState): string {
  return `END ${run.phase} gold=${run.gold} visited=${run.visited.join(">")} party=${run.party.map((m) => `${m.charId}:${m.hp}`).join(",")}`;
}

/** (seed,runDef,policy)를 구동하며 행동열 + canonical 로그를 기록. stepCap 초과(드문 random 느린전투)면 거기까지 기록. */
export function recordVector(seed: number, runDef: RunDef, policy: ActionPolicy = "ai", stepCap = 3000, battleCap = 8000): PortingVector {
  const choice = new Rng((seed ^ 0xc0ffee) >>> 0);
  const run = createRun(seed, runDef.roster, runDef, {});
  const actions: RunAction[] = [];
  const logParts: string[] = [];
  let steps = 0;
  while (run.phase !== "won" && run.phase !== "lost" && steps++ < stepCap) {
    if (run.phase === "map") {
      if (run.reachable.length === 0) break;
      const nodeId = pick(choice, run.reachable);
      actions.push({ scope: "map", nodeId });
      enterNode(run, nodeId);
    } else if (run.phase === "battle") {
      const b = run.battle!;
      let g = 0;
      while (b.phase === "inProgress" && g++ < battleCap) {
        const useAi = policy === "ai" || (policy === "ai-allies" && unitById(b, b.current!.uid).side === "ally");
        const action = useAi ? chooseAction(b) : pick(choice, getLegalActions(b).map((a) => a.action));
        actions.push({ scope: "battle", action });
        step(b, action);
      }
      logParts.push(`B ${canonicalLog(b.log)}`);
      resolveBattleEnd(run);
    } else if (run.phase === "reward") {
      const optionId = pick(choice, run.rewards!).id;
      actions.push({ scope: "reward", optionId });
      chooseReward(run, optionId);
    } else if (run.phase === "shop") {
      const buys: string[] = [];
      let budget = choice.int(0, 3);
      while (budget-- > 0 && run.shop && run.shop.length) {
        const affordable = run.shop.filter((o) => o.cost <= run.gold);
        if (affordable.length === 0) break;
        const id = pick(choice, affordable).id;
        buys.push(id);
        buyShopOffer(run, id);
      }
      actions.push({ scope: "shop", buys });
      leaveShop(run);
    } else if (run.phase === "encounter") {
      const choiceId = pick(choice, run.encounter!.choices).id;
      actions.push({ scope: "encounter", choiceId });
      chooseEncounterOption(run, choiceId);
    }
  }
  logParts.push(digest(run));
  return { seed, runId: runDef.id, policy, actions, log: logParts.join("\n") };
}

/** 기록된 행동열을 fresh 런에 그대로 적용 → canonical 로그 재현(choice-rng 미사용). Rust 재생의 TS 레퍼런스. */
export function replayVector(runDef: RunDef, vec: PortingVector): string {
  const run = createRun(vec.seed, runDef.roster, runDef, {});
  const logParts: string[] = [];
  let i = 0;
  while (run.phase !== "won" && run.phase !== "lost" && i < vec.actions.length) {
    const a = vec.actions[i];
    if (run.phase === "map" && a.scope === "map") { enterNode(run, a.nodeId); i++; }
    else if (run.phase === "battle" && a.scope === "battle") {
      const b = run.battle!;
      while (b.phase === "inProgress" && i < vec.actions.length && vec.actions[i].scope === "battle") {
        step(b, (vec.actions[i] as { action: Action }).action);
        i++;
      }
      logParts.push(`B ${canonicalLog(b.log)}`);
      resolveBattleEnd(run);
    } else if (run.phase === "reward" && a.scope === "reward") { chooseReward(run, a.optionId); i++; }
    else if (run.phase === "shop" && a.scope === "shop") { for (const id of a.buys) buyShopOffer(run, id); leaveShop(run); i++; }
    else if (run.phase === "encounter" && a.scope === "encounter") { chooseEncounterOption(run, a.choiceId); i++; }
    else throw new Error(`replayVector: phase '${run.phase}' ↔ action.scope '${a.scope}' 불일치 @${i}`);
  }
  logParts.push(digest(run));
  return logParts.join("\n");
}
