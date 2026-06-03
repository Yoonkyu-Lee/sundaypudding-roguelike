/// <reference types="node" />
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 웹 렌더러. dev: 코어(src/core) 무수정 import. build: JS/CSS를 index.html 한 파일로 인라인
// (viteSingleFile). 아바타(public/)는 빌드 후 scripts/inline-avatars.mjs가 base64로 박아넣음
// → 친구에게 보내는 완전 단일 HTML (더블클릭 → 브라우저, 오프라인).

const RUNS_DIR = join(dirname(fileURLToPath(import.meta.url)), "src", "data", "runs");
const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;

// runs.generated.ts 재생성 — src/data/runs/*.json을 스캔해 RUNS 레지스트리를 결정론적으로 통째로 쓴다.
// (Node 코어는 glob 불가하나 dev 미들웨어는 fs 접근 가능 → 마커 삽입 대신 전체 생성 = 견고)
function regenerateRegistry(): void {
  const files = readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json")).sort();
  const lines: string[] = [];
  const entries: string[] = [];
  for (const file of files) {
    const base = file.slice(0, -5); // .json 제거
    const v = `run_${base.replace(/[^A-Za-z0-9_]/g, "_")}`;
    let id = base;
    try { const o = JSON.parse(readFileSync(join(RUNS_DIR, file), "utf8")); if (typeof o.id === "string") id = o.id; } catch { /* 깨진 json은 파일명 키로 */ }
    lines.push(`import ${v} from "./${file}" with { type: "json" };`);
    entries.push(`  ${JSON.stringify(id)}: ${v} as unknown as RunDef,`);
  }
  const out = `// AUTO-GENERATED — 에디터 'repo에 저장'(dev-write 미들웨어, F3)이 src/data/runs/*.json을\n`
    + `// 스캔해 통째로 재생성한다. 직접 편집 금지(다음 저장 때 덮어써짐). 키 = 각 json의 id.\n`
    + `import type { RunDef } from "../../core/types.ts";\n`
    + `${lines.join("\n")}\n\n`
    + `export const RUNS: Record<string, RunDef> = {\n${entries.join("\n")}\n};\n`;
  writeFileSync(join(RUNS_DIR, "runs.generated.ts"), out, "utf8");
}

// dev 전용: 브라우저 에디터 → repo JSON 자동 기록 + 레지스트리 재생성. 빌드 단일 HTML엔 영향 0.
function devWriteRuns(): Plugin {
  return {
    name: "spr-dev-write-runs",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/save-run", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("POST only"); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const { fileId, def } = JSON.parse(body) as { fileId: string; def: { id?: string; floors?: unknown } };
            if (!SAFE_ID.test(fileId)) { res.statusCode = 400; res.end("잘못된 파일 id(영숫자·_·-, 1~40자)"); return; }
            if (!def || typeof def !== "object" || !Array.isArray(def.floors)) { res.statusCode = 400; res.end("RunDef 형식 아님"); return; }
            def.id = fileId; // 파일명 = 레지스트리 키 일치
            writeFileSync(join(RUNS_DIR, `${fileId}.json`), JSON.stringify(def, null, 2), "utf8");
            regenerateRegistry();
            res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, id: fileId }));
          } catch (e) { res.statusCode = 500; res.end(`기록 실패: ${(e as Error).message}`); }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [devWriteRuns(), viteSingleFile()],
  server: { port: 5173, strictPort: false },
});
