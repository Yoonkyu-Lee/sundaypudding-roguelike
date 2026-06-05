// 코어 레이어 시퀀서 (NODE-DESIGN Phase A2) — 노드 core[] 를 순서 실행.
// 데코레이터는 즉시(helpers), 상호작용(combat)은 phase 전환으로 블록 후 resolveBattleEnd가 advanceCore로 복귀.
// run.ts가 호출(run→layers). 이 모듈은 run을 import하지 않음 → 사이클 없음(engine·helpers·data만 의존).
import { createBattle } from "../engine.ts";
import { NODE_ROSTERS } from "../../data/encounters.ts";
import type { InteractiveLayer, Layer, MapNode } from "../types.ts";
import type { RunState } from "./types.ts";
import { node, runInstantLayers, completeNode } from "./helpers.ts";
import { genRewards } from "./rewards.ts";
import { defaultCore } from "../../data/nodeCores.ts";

/** 노드의 실행 core — 인라인 core 우선, 없으면 타입 기본 시드(레거시 type 노드 호환). */
export const nodeCore = (n: MapNode): Layer[] => (n.core && n.core.length ? n.core : defaultCore(n.type));

// 상호작용 레이어 스타터 DI 레지스트리 — shop/event는 시작 로직이 shop.ts/encounter.ts(이들은 재진입 위해
// advanceCore를 import) 의존 → layers가 그걸 직접 import하면 사이클. 런타임 주입(run.ts)으로 정적 사이클 차단.
type LayerStarter = (run: RunState, layer: Layer) => void;
const starters: Record<string, LayerStarter> = {};
export function registerLayerStarter(kind: string, fn: LayerStarter): void { starters[kind] = fn; }

/** core 시퀀스 시작(enterNode에서, onEnter 데코 실행 후 호출). */
export function startCore(run: RunState, n: MapNode): void {
  run.coreCursor = 0;
  stepCore(run, n);
}

/** 현재 커서부터 진행: 데코는 즉시 소비하며 전진, 상호작용 만나면 블록(return), 소진 시 노드 완료. */
function stepCore(run: RunState, n: MapNode): void {
  const core = nodeCore(n);
  while (run.coreCursor! < core.length) {
    const L = core[run.coreCursor!];
    if (L.kind === "combat") { startCombat(run, L); return; } // 블록(전투 phase) — resolveBattleEnd가 advanceCore
    if (L.kind === "reward") { run.rewards = genRewards(run, L.tier); run.phase = "reward"; run.log.push("보상 선택"); return; } // 블록 — chooseReward가 advanceCore (등급별 차등)
    if (L.kind === "shop" || L.kind === "event") {
      const starter = starters[L.kind];
      if (!starter) throw new Error(`stepCore: '${L.kind}' 스타터 미등록 — run.ts의 registerLayerStarter 누락(시퀀서 무한 정지 방지, Part6 #3)`);
      starter(run, L); return; // 블록 — leaveShop/chooseEncounterOption이 advanceCore (DI 스타터)
    }
    runInstantLayers(run, [L]); // 데코레이터 즉시 실행(L은 여기서 DecoratorLayer로 좁혀짐)
    run.coreCursor!++;
  }
  finishCore(run, n);
}

/** 상호작용 전투 레이어 시작 — 적 구성(레이어 override 우선) + 모험 계승 상태 + 이 레이어의 트리거 룰(연출) 주입. */
function startCombat(run: RunState, L: Extract<InteractiveLayer, { kind: "combat" }>): void {
  const seed = run.rng.int(0, 2_000_000_000);
  const enemies = L.roster && L.roster.length ? L.roster : NODE_ROSTERS.battle; // 인라인 roster 소유, 비면 안전 fallback
  const enc = { id: "combat", name: "전투", allies: [], enemies, boss: !!L.boss };
  const allyStates = run.party.filter((m) => m.hp > 0).map((m) => ({ ...m, startStatuses: run.pendingStatuses[m.charId] }));
  run.battle = createBattle(seed, enc, allyStates, L.rules);
  run.pendingStatuses = {};
  run.phase = "battle";
  run.log.push("전투 진입");
}

/** 상호작용 레이어 종료 후(전투 승리 등) 다음 스텝으로. (HP 반영은 호출측에서.) */
export function advanceCore(run: RunState): void {
  run.battle = null;
  run.coreCursor!++;
  stepCore(run, node(run, run.activeNodeId!));
}

/** 코어 소진 — 커서 해제 후 노드 완료(onResolve 데코는 completeNode가 발동). */
function finishCore(run: RunState, n: MapNode): void {
  run.coreCursor = null;
  completeNode(run, n.id);
}
