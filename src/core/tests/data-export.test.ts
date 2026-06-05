// 데이터 JSON 드리프트 게이트 (PORTING.md P0-4) — data.generated.json이 TS data와 바이트 동기.
// TS data를 바꾸고 재생성 안 하면 여기서 실패 → 'npm run data:export' 후 커밋. (golden 패턴)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataBundleJson, BUNDLE_PATH } from "../../../scripts/export-data.ts";

test("data-export: data.generated.json ↔ TS data 동기(드리프트 검출)", () => {
  const committed = readFileSync(BUNDLE_PATH, "utf8").replace(/\n$/, "");
  const fresh = dataBundleJson();
  assert.equal(fresh, committed, "TS data ↔ data.generated.json 드리프트 — 'npm run data:export' 후 diff 리뷰·커밋");
});
