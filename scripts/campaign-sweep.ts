// 대량 무작위 캠페인 스윕 (MIGRATION-VERIFICATION-PLAN §3.1 "수만 시드") — 수동/야간용.
// 커밋 게이트(campaign.test.ts)는 속도 위해 200시드. 여기선 인자로 받은 만큼 깊게 두들긴다.
//   node scripts/campaign-sweep.ts [seeds=20000] [policy=all]
// 크래시/교착/불변식 위반이 하나라도 나오면 비-0 종료코드 + 상세 출력.
import { RUNS } from "../src/data/runs/index.ts";
import { runCampaign, type ActionPolicy } from "../src/core/tests/harness/index.ts";
import { summarize } from "../src/core/tests/invariants/index.ts";

const SEEDS = Number(process.argv[2] ?? 20000);
const POLICY_ARG = process.argv[3] ?? "all";
const POLICIES: ActionPolicy[] = POLICY_ARG === "all" ? ["random", "ai-allies", "ai"] : [POLICY_ARG as ActionPolicy];

// 하드 실패 = 크래시 · 불변식 위반 · AI 정책 교착. random 교착은 "느림(유한)"이라 informational.
let hardFailures = 0;
let randomSlow = 0;
let total = 0;
const t0 = Date.now();

for (const runDef of Object.values(RUNS)) {
  for (const policy of POLICIES) {
    const tally: Record<string, number> = { won: 0, lost: 0, deadlock: 0, crash: 0 };
    const vmap = new Map<string, number>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      total++;
      const r = runCampaign(seed, runDef, { policy });
      tally[r.outcome]++;
      for (const v of r.violations) vmap.set(v.id, (vmap.get(v.id) ?? 0) + 1);
      if (r.outcome === "crash") {
        hardFailures++;
        if (hardFailures <= 20) console.error(`✗ ${runDef.id}/${policy}/seed${seed}: crash — ${r.error}\n   ${(r.logTail ?? []).join(" / ")}`);
      } else if (r.outcome === "deadlock") {
        if (policy === "random") { randomSlow++; } // 느린 전투(유한) — informational
        else { hardFailures++; if (hardFailures <= 20) console.error(`✗ ${runDef.id}/${policy}/seed${seed}: 교착(AI 비종료 의심) — ${r.error}`); }
      }
      if (r.violations.length) {
        hardFailures++;
        if (hardFailures <= 20) console.error(`✗ ${runDef.id}/${policy}/seed${seed}: ${summarize(r.violations.slice(0, 3))}`);
      }
    }
    console.log(`${runDef.id} / ${policy} (${SEEDS}): ${JSON.stringify(tally)}  violations=${vmap.size ? JSON.stringify(Object.fromEntries(vmap)) : "0"}`);
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n총 ${total} 캠페인, ${secs}s. 하드 실패 ${hardFailures}건` + (randomSlow ? ` (+ random 느린전투 ${randomSlow}건: cap 초과, 유한·무해)` : "") + ".");
process.exit(hardFailures === 0 ? 0 : 1);
