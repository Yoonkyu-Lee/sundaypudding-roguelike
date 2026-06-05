// 골든 이벤트 로그 코퍼스 (Codex 적대검토 (d): live-vs-live → live-vs-frozen).
// self-consistency는 "같은 코드 2회=동일"만 보므로 모든 시드 로그를 결정적으로 바꾸는 리팩터를 못 잡는다.
// 이 코퍼스는 (run × 정책 × 시드 × rich + 전투 픽스처)의 canonical 이벤트 로그를 SHA로 동결 →
// 침묵하는 로그 드리프트를 잡는다. demo-md5(전투1·seed42 CLI)보다 훨씬 넓은 GameEvent[] 표면을 커버.
//
// 의도된 동작변경이면: npm run golden:update (manifest.json 재생성 후 diff 리뷰).
// 주의: JSON.stringify 키 순서는 TS 객체 리터럴 순서로 안정(TS↔TS 드리프트 검출엔 충분).
//       TS↔Rust 바이트 동일은 포팅 시점에 canonical 직렬화 계약 필요(MIGRATION-VERIFICATION-PLAN).
import { createHash } from "node:crypto";
import { RUNS } from "../../../data/runs/index.ts";
import { DEMO_ENCOUNTER, NODE_ROSTERS, type Encounter } from "../../../data/encounters.ts";
import { stressRun, type ActionPolicy } from "../harness/index.ts";
import { battleTrace } from "../harness/index.ts";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

export interface GoldenEntry { kind: "run" | "battle"; n: number; sha: string }
export type GoldenManifest = Record<string, GoldenEntry>;

// ── 매트릭스: 런 × 정책 × 시드 (+rich로 targetCell/free-cell AoE 형태까지) ──
interface RunCfg { runId: string; policy: ActionPolicy; seed: number; rich?: boolean }
const RUN_MATRIX: RunCfg[] = [];
for (const runId of Object.keys(RUNS)) {
  for (const policy of ["random", "ai-allies", "ai"] as ActionPolicy[]) {
    for (const seed of [1, 7, 42, 100]) RUN_MATRIX.push({ runId, policy, seed });
  }
  for (const seed of [1, 7, 42]) RUN_MATRIX.push({ runId, policy: "random", seed, rich: true });
}

// ── 전투 픽스처: 단일 전투 결정론(AI·무작위) ──
interface BattleCfg { name: string; enc: Encounter; mode: "ai" | "random"; seed: number }
const BATTLE_MATRIX: BattleCfg[] = [
  { name: "demo/ai/1", enc: DEMO_ENCOUNTER, mode: "ai", seed: 1 },
  { name: "demo/ai/42", enc: DEMO_ENCOUNTER, mode: "ai", seed: 42 },
  { name: "demo/random/1", enc: DEMO_ENCOUNTER, mode: "random", seed: 1 },
  { name: "demo/random/42", enc: DEMO_ENCOUNTER, mode: "random", seed: 42 },
  { name: "battle/ai/7", enc: { id: "b", name: "b", allies: [], enemies: NODE_ROSTERS.battle, boss: false }, mode: "ai", seed: 7 },
  // 한 열 3명(0열) → attackPower 4 분배 = 2,1,1(정수화). 포메이션 정수 분배가 데미지에 반영되는 경로를 동결.
  { name: "battle/stacked-col/ai/3", enc: { id: "sc", name: "sc", allies: [{ charId: "kim", pos: { row: 0, col: 0 } }, { charId: "shin", pos: { row: 1, col: 0 } }, { charId: "cho", pos: { row: 2, col: 0 } }], enemies: NODE_ROSTERS.battle, boss: false }, mode: "ai", seed: 3 },
];

const runKey = (c: RunCfg) => `run/${c.runId}/${c.policy}${c.rich ? "+rich" : ""}/seed${c.seed}`;

/** 코퍼스 전체를 실행해 canonical 트레이스의 SHA 매니페스트를 만든다. 순수(결정론). */
export function computeManifest(): GoldenManifest {
  const out: GoldenManifest = {};
  for (const c of RUN_MATRIX) {
    const trace: string[] = [];
    stressRun(c.seed, RUNS[c.runId], { policy: c.policy, richActions: c.rich, checkInvariants: false, trace });
    out[runKey(c)] = { kind: "run", n: trace.length, sha: sha(JSON.stringify(trace)) };
  }
  for (const c of BATTLE_MATRIX) {
    const log = battleTrace(c.seed, c.enc, c.mode);
    out[`battle/${c.name}`] = { kind: "battle", n: JSON.parse(log).length, sha: sha(log) };
  }
  return out;
}
