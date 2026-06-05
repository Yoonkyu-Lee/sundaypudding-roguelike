// 포팅 행동 벡터 (PORTING.md P0-1) — record→replay 바이트 동일 = 행동열이 재생 가능한 충분한 기록.
// 이게 성립해야 Rust가 "같은 행동열 재생 → 같은 이벤트 로그"로 검증될 수 있다(differential 오라클).
import { test } from "node:test";
import assert from "node:assert/strict";
import { RUNS, DEFAULT_RUN } from "../../data/runs/index.ts";
import { recordVector, replayVector, canonicalJson, type ActionPolicy } from "./harness/index.ts";

const POLICIES: ActionPolicy[] = ["random", "ai-allies", "ai"];

test("port-vector: record→replay 바이트 동일 (행동열만으로 로그 재현, choice-rng 무관)", () => {
  for (const runDef of Object.values(RUNS)) {
    for (const policy of POLICIES) {
      for (const seed of [1, 7, 42, 100, 271]) {
        const v = recordVector(seed, runDef, policy);
        const replayed = replayVector(runDef, v);
        assert.equal(replayed, v.log, `${runDef.id}/${policy}/seed${seed}: replay 로그 ≠ record 로그`);
        assert.ok(v.actions.length > 0, `${runDef.id}/${policy}/seed${seed}: 행동 0개`);
      }
    }
  }
});

test("port-vector: recordVector 결정성 (같은 시드 → 동일 행동열 + 동일 로그)", () => {
  for (const seed of [1, 42, 999]) {
    const a = recordVector(seed, DEFAULT_RUN, "ai-allies");
    const b = recordVector(seed, DEFAULT_RUN, "ai-allies");
    assert.equal(canonicalJson(a.actions), canonicalJson(b.actions), `seed ${seed}: 행동열 비결정`);
    assert.equal(a.log, b.log, `seed ${seed}: 로그 비결정`);
  }
});

test("port-vector: 행동열이 전 scope를 포괄(map/battle/reward/shop/encounter 모두 기록됨)", () => {
  const scopes = new Set<string>();
  for (let seed = 1; seed <= 400 && scopes.size < 5; seed++) {
    for (const a of recordVector(seed, DEFAULT_RUN, "ai-allies").actions) scopes.add(a.scope);
  }
  for (const s of ["map", "battle", "reward", "shop", "encounter"]) {
    assert.ok(scopes.has(s), `scope '${s}'가 어떤 벡터에도 기록 안 됨 — emitter 누락`);
  }
});
