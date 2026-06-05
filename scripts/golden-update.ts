// 골든 코퍼스 매니페스트 재생성 — 의도된 동작변경 시 실행: npm run golden:update
// (검증 인프라: src/core/tests/golden/corpus.ts 매트릭스의 canonical 이벤트 로그 SHA를 manifest.json에 동결.)
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { computeManifest } from "../src/core/tests/golden/corpus.ts";

const path = resolve(import.meta.dirname, "..", "src", "core", "tests", "golden", "manifest.json");
const manifest = computeManifest();
writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
const keys = Object.keys(manifest);
console.log(`골든 매니페스트 갱신: ${keys.length} 항목 → ${join("src", "core", "tests", "golden", "manifest.json")}`);
