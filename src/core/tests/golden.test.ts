// 골든 이벤트 로그 코퍼스 회귀 (Codex 적대검토 (d)) — 동결된 manifest.json과 비교해 침묵 드리프트 검출.
// self-consistency(live-vs-live)는 못 잡는 "모든 시드 로그를 일관되게 바꾸는 리팩터"를 여기서 잡는다.
// 의도된 동작변경이면: npm run golden:update
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeManifest, type GoldenManifest } from "./golden/corpus.ts";

const MANIFEST = resolve(import.meta.dirname, "golden", "manifest.json");

test("golden: 이벤트 로그 코퍼스가 동결 manifest와 일치 (run×정책×시드×rich + 전투 픽스처)", () => {
  const gold = JSON.parse(readFileSync(MANIFEST, "utf8")) as GoldenManifest;
  const fresh = computeManifest();

  assert.deepEqual(Object.keys(fresh).sort(), Object.keys(gold).sort(), "코퍼스 키 목록 변경 — 'npm run golden:update' 후 diff 리뷰");

  const drift: string[] = [];
  for (const k of Object.keys(gold)) {
    if (gold[k].sha !== fresh[k].sha) {
      drift.push(`${k}: n ${gold[k].n}→${fresh[k].n}, sha ${gold[k].sha.slice(0, 10)}→${fresh[k].sha.slice(0, 10)}`);
    }
  }
  assert.equal(drift.length, 0, `이벤트 로그 드리프트 ${drift.length}/${Object.keys(gold).length} — 의도된 변경이면 'npm run golden:update':\n${drift.join("\n")}`);
});
