// 무작위 행동 스트레스 런 (MIGRATION-VERIFICATION-PLAN §3.1 = coremark 자극).
// (검증 용어 "stress run" — 게임의 '캠페인 모드'와 무관. 무작위 자극을 대량으로 쏟아붓는 한 판.)
// 시드 결정 무작위 합법 행동으로 런 전체(맵 이동·전투·보상·상점·인카운터·층 전환)를 주파.
// 매 step 후 불변식 검사(§3.3 = SVA assertion)를 두들김. 크래시/교착/위반 0을 측정.
//
// 결정론: createRun이 run.rng를 seed로, 각 전투 rng를 run.rng로 시드 → 스트레스 런은 (seed) 하나로 재현.
// 선택(choice) rng는 별도 시드(seed^상수)라 run 내부 난수와 독립이지만 똑같이 결정적.
// 따라서 같은 seed → 동일 스트레스 런(self-consistency harness가 이를 검증).
import { Rng } from "../../rng.ts";
import { step, getLegalActions, unitById } from "../../engine.ts";
import { chooseAction } from "../../ai.ts";
import { enumerateRichActions } from "./richActions.ts";
import { canonicalLog } from "./canonical.ts";
import { createRun, enterNode, resolveBattleEnd, chooseReward, buyShopOffer, leaveShop, chooseEncounterOption } from "../../run.ts";
import type { RunState, RunDef } from "../../run.ts";
import { checkCombatInvariants, checkRunInvariants } from "../invariants/index.ts";
import type { Violation } from "../invariants/index.ts";

/** 전투 행동 선택 정책. random=양측 무작위(전투 엣지 자극), ai-allies=아군 AI·적 무작위(런 진행 커버), ai=양측 AI. */
export type ActionPolicy = "random" | "ai-allies" | "ai";

export type Outcome = "won" | "lost" | "deadlock" | "crash";

export interface StressRunResult {
  seed: number;
  runId: string;
  outcome: Outcome;
  steps: number; // 런 phase 전이 횟수
  battleSteps: number; // 전투 행동(step) 총 횟수
  nodesVisited: number;
  phaseHits: Record<string, number>; // phase별 진입 횟수(커버리지 — battle/reward/shop/encounter/map)
  violations: Violation[];
  error?: string; // crash 시 메시지
  logTail?: string[]; // 실패 시 run.log 꼬리(디버깅)
}

export interface StressRunOpts {
  stepCap?: number; // 런 phase 전이 상한(교착 검출)
  battleCap?: number; // 단일 전투 행동 상한(교착 검출)
  useMastery?: boolean;
  checkInvariants?: boolean; // 매 step 불변식 검사(기본 true)
  policy?: ActionPolicy; // 전투 행동 선택(기본 random)
  richActions?: boolean; // random 정책에서 targetCell/free-cell AoE 등 풍부한 행동형태까지 자극(기본 false)
  trace?: string[]; // 주어지면 전투 이벤트 로그 + 최종 다이제스트를 누적(self-consistency용)
  rngTrace?: number[]; // 주어지면 매 전투 step 후 battle rng 상태를 기록(기본 off; 포팅 differential 시 RNG vs 로직 발산 국소화). 읽기뿐 — 결정론 불변
}

const pick = <T>(rng: Rng, arr: T[]): T => arr[rng.int(0, arr.length - 1)];

/** 한 시드로 런 1판을 무작위 합법 행동으로 끝까지 구동(=스트레스 런 1회). throw하지 않고 결과를 반환. */
export function stressRun(seed: number, runDef: RunDef, opts: StressRunOpts = {}): StressRunResult {
  const stepCap = opts.stepCap ?? 3000;
  // battleCap = 비종료 검출용 헤드룸. 무작위 양측 플레이는 병적으로 길어질 수 있음(힐/미스가 데미지를 거의
  // 상쇄 → 수렴 느림. 실측: 큰 cap에서 항상 종료, 즉 유한). AI 플레이는 수십 행동에 끝남. 진짜 무한루프는
  // 어떤 유한 cap도 넘으므로 검출은 유지. random의 cap 도달 = "느림(유한)"이지 "고착(무한)"이 아님.
  const battleCap = opts.battleCap ?? 8000;
  const check = opts.checkInvariants ?? true;
  const policy = opts.policy ?? "random";
  const choice = new Rng((seed ^ 0xc0ffee) >>> 0); // 선택 전용 결정 rng
  const violations: Violation[] = [];
  const runId = runDef.id;
  let steps = 0;
  let battleSteps = 0;
  const phaseHits: Record<string, number> = {};

  let run: RunState;
  try {
    run = createRun(seed, runDef.roster, runDef, { useMastery: opts.useMastery ?? false });
  } catch (e) {
    return { seed, runId, outcome: "crash", steps, battleSteps, nodesVisited: 0, phaseHits, violations, error: `createRun: ${String(e)}` };
  }
  if (check) violations.push(...checkRunInvariants(run));

  const fail = (outcome: Outcome, error?: string): StressRunResult => ({
    seed, runId, outcome, steps, battleSteps, nodesVisited: run.visited.length, phaseHits, violations, error, logTail: run.log.slice(-15),
  });

  try {
    while (run.phase !== "won" && run.phase !== "lost") {
      if (++steps > stepCap) return fail("deadlock", `stepCap ${stepCap} 초과 (phase=${run.phase})`);
      phaseHits[run.phase] = (phaseHits[run.phase] ?? 0) + 1;

      switch (run.phase) {
        case "map": {
          if (run.reachable.length === 0) return fail("deadlock", "map: reachable 비어있음");
          enterNode(run, pick(choice, run.reachable));
          break;
        }
        case "battle": {
          const b = run.battle;
          if (!b) return fail("crash", "phase=battle인데 battle=null");
          let guard = 0;
          while (b.phase === "inProgress") {
            if (++guard > battleCap) return fail("deadlock", `battleCap ${battleCap} 초과`);
            const useAi = policy === "ai" || (policy === "ai-allies" && unitById(b, b.current!.uid).side === "ally");
            let act;
            if (useAi) {
              act = chooseAction(b);
            } else {
              const acts = opts.richActions ? enumerateRichActions(b) : getLegalActions(b).map((a) => a.action);
              if (acts.length === 0) return fail("deadlock", "전투: 합법행동 0 (G6 위반)");
              act = pick(choice, acts);
            }
            step(b, act);
            battleSteps++;
            if (opts.rngTrace) opts.rngTrace.push(b.rng.state); // 행동 후 RNG 상태(읽기뿐, 소비 없음)
            if (check) violations.push(...checkCombatInvariants(b));
          }
          if (opts.trace) opts.trace.push(`B ${canonicalLog(b.log)}`);
          resolveBattleEnd(run);
          break;
        }
        case "reward": {
          if (!run.rewards || run.rewards.length === 0) return fail("crash", "phase=reward인데 rewards 비어있음");
          chooseReward(run, pick(choice, run.rewards).id);
          break;
        }
        case "shop": {
          // 무작위로 0~3개 affordable 구매 후 나가기
          let budget = choice.int(0, 3);
          while (budget-- > 0 && run.shop && run.shop.length) {
            const affordable = run.shop.filter((o) => o.cost <= run.gold);
            if (affordable.length === 0) break;
            buyShopOffer(run, pick(choice, affordable).id);
          }
          leaveShop(run);
          break;
        }
        case "encounter": {
          const choices = run.encounter?.choices;
          if (!choices || choices.length === 0) return fail("crash", "phase=encounter인데 choices 비어있음");
          chooseEncounterOption(run, pick(choice, choices).id);
          break;
        }
        default:
          return fail("crash", `알 수 없는 phase: ${run.phase}`);
      }

      if (check) violations.push(...checkRunInvariants(run));
    }
  } catch (e) {
    return fail("crash", String((e as Error)?.stack ?? e));
  }

  if (opts.trace) {
    opts.trace.push(`END ${run.phase} gold=${run.gold} visited=${run.visited.join(">")} party=${run.party.map((m) => `${m.charId}:${m.hp}`).join(",")}`);
  }
  return { seed, runId, outcome: run.phase, steps, battleSteps, nodesVisited: run.visited.length, phaseHits, violations };
}
