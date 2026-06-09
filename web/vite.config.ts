/// <reference types="node" />
import { defineConfig, type Plugin } from "vite";
import { writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 웹 프론트(플레이어 GUI). dev: vite 서버(localhost:5173), Rust 엔진은 Tauri IPC로 호출.
// build: 일반 multi-file dist/(index.html + assets/ + avatars/) → Tauri가 frontendDist로 통째 번들(단일 데스크톱 앱).

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "src", "content");
const RUNS_DIR = join(CONTENT_DIR, "runs");
const JOBS_PATH = join(CONTENT_DIR, "jobs.json");
const ITEMS_PATH = join(CONTENT_DIR, "items.json");
const SKILLS_PATH = join(CONTENT_DIR, "skills.json");
const TRAITS_PATH = join(CONTENT_DIR, "traits.json");
const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const EQUIP_SLOTS = new Set(["weapon", "armor", "held"]);
const SKILL_TARGETS = new Set(["enemy", "ally", "self"]);

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
    + `import type { RunDef } from "../../contract/types.ts";\n`
    + `${lines.join("\n")}\n\n`
    + `export const RUNS: Record<string, RunDef> = {\n${entries.join("\n")}\n};\n`;
  writeFileSync(join(RUNS_DIR, "runs.generated.ts"), out, "utf8");
}

// dev 전용: 브라우저 에디터 → repo JSON 자동 기록 + 레지스트리 재생성. 프로덕션 빌드엔 영향 0.
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

// dev 전용: 전직 트리 에디터 → jobs.json 통째 기록. 단일 파일(맵 Record<id,JobDef>)이라 배럴 재생성 불요(loader가 직접 import).
function devWriteJobs(): Plugin {
  return {
    name: "spr-dev-write-jobs",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/save-jobs", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("POST only"); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const { jobs } = JSON.parse(body) as { jobs: Record<string, { id?: string; name?: string; classReq?: number }> };
            if (!jobs || typeof jobs !== "object" || Array.isArray(jobs)) { res.statusCode = 400; res.end("jobs 맵 형식 아님"); return; }
            for (const [key, j] of Object.entries(jobs)) {
              if (!SAFE_ID.test(key)) { res.statusCode = 400; res.end(`잘못된 직업 id: ${key}`); return; }
              if (!j || typeof j !== "object" || j.id !== key || typeof j.name !== "string" || typeof j.classReq !== "number") { res.statusCode = 400; res.end(`JobDef 형식 아님: ${key}`); return; }
            }
            writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2) + "\n", "utf8");
            res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, count: Object.keys(jobs).length }));
          } catch (e) { res.statusCode = 500; res.end(`기록 실패: ${(e as Error).message}`); }
        });
      });
    },
  };
}

// dev 전용: 아이템 에디터 → items.json({ items, pool }) 통째 기록.
function devWriteItems(): Plugin {
  return {
    name: "spr-dev-write-items",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/save-items", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("POST only"); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const { items, pool } = JSON.parse(body) as { items: Record<string, { id?: string; name?: string; slot?: string }>; pool: string[] };
            if (!items || typeof items !== "object" || Array.isArray(items)) { res.statusCode = 400; res.end("items 맵 형식 아님"); return; }
            if (!Array.isArray(pool)) { res.statusCode = 400; res.end("pool 배열 아님"); return; }
            for (const [key, it] of Object.entries(items)) {
              if (!SAFE_ID.test(key)) { res.statusCode = 400; res.end(`잘못된 아이템 id: ${key}`); return; }
              if (!it || typeof it !== "object" || it.id !== key || typeof it.name !== "string" || !EQUIP_SLOTS.has(it.slot as string)) { res.statusCode = 400; res.end(`ItemDef 형식 아님: ${key}`); return; }
            }
            for (const pid of pool) if (!items[pid]) { res.statusCode = 400; res.end(`pool에 미존재 아이템: ${pid}`); return; }
            writeFileSync(ITEMS_PATH, JSON.stringify({ items, pool }, null, 2) + "\n", "utf8");
            res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, count: Object.keys(items).length }));
          } catch (e) { res.statusCode = 500; res.end(`기록 실패: ${(e as Error).message}`); }
        });
      });
    },
  };
}

// dev 전용: 스킬 에디터 → skills.json(Record<id,Skill>) 통째 기록.
function devWriteSkills(): Plugin {
  return {
    name: "spr-dev-write-skills",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/save-skills", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("POST only"); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const { skills } = JSON.parse(body) as { skills: Record<string, { id?: string; name?: string; target?: string; cooldown?: number; accuracy?: number }> };
            if (!skills || typeof skills !== "object" || Array.isArray(skills)) { res.statusCode = 400; res.end("skills 맵 형식 아님"); return; }
            for (const [key, s] of Object.entries(skills)) {
              if (!SAFE_ID.test(key)) { res.statusCode = 400; res.end(`잘못된 스킬 id: ${key}`); return; }
              if (!s || typeof s !== "object" || s.id !== key || typeof s.name !== "string" || !SKILL_TARGETS.has(s.target as string) || typeof s.cooldown !== "number" || typeof s.accuracy !== "number") { res.statusCode = 400; res.end(`Skill 형식 아님: ${key}`); return; }
            }
            writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2) + "\n", "utf8");
            res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, count: Object.keys(skills).length }));
          } catch (e) { res.statusCode = 500; res.end(`기록 실패: ${(e as Error).message}`); }
        });
      });
    },
  };
}

// dev 전용: 패시브/특성 에디터 → traits.json(Record<id,TraitDef>) 통째 기록.
function devWriteTraits(): Plugin {
  return {
    name: "spr-dev-write-traits",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/save-traits", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("POST only"); return; }
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const { traits } = JSON.parse(body) as { traits: Record<string, { id?: string; name?: string; rules?: unknown }> };
            if (!traits || typeof traits !== "object" || Array.isArray(traits)) { res.statusCode = 400; res.end("traits 맵 형식 아님"); return; }
            for (const [key, t] of Object.entries(traits)) {
              if (!SAFE_ID.test(key)) { res.statusCode = 400; res.end(`잘못된 특성 id: ${key}`); return; }
              if (!t || typeof t !== "object" || t.id !== key || typeof t.name !== "string" || !Array.isArray(t.rules)) { res.statusCode = 400; res.end(`TraitDef 형식 아님: ${key}`); return; }
            }
            writeFileSync(TRAITS_PATH, JSON.stringify(traits, null, 2) + "\n", "utf8");
            res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, count: Object.keys(traits).length }));
          } catch (e) { res.statusCode = 500; res.end(`기록 실패: ${(e as Error).message}`); }
        });
      });
    },
  };
}

export default defineConfig({
  base: "./", // Tauri 웹뷰는 frontendDist를 루트로 서빙 — 상대경로 에셋이 안전
  plugins: [devWriteRuns(), devWriteJobs(), devWriteItems(), devWriteSkills(), devWriteTraits()],
  server: { port: 5173, strictPort: false },
});
