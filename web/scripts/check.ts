// 자동 게이트 — 슬라이스 드리프트를 "행동하는 순간"에 잡는다. (CLAUDE.md 모듈/경계 규칙의 기계적 강제)
// 실행: `npm run check` (수동) 또는 git pre-commit 훅(.githooks/pre-commit).
// FAIL 하나라도 있으면 exit 1. WARN은 통과(시야 확보용). 결정론 회귀 게이트 = cargo test(differential·save-roundtrip).
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, dirname, resolve, basename } from "node:path";
import { checkSchemaDrift } from "./schema-drift.ts";

const ROOT = resolve(import.meta.dirname, "..");  // web/ (TS 프로젝트 루트 — npm 실행 위치)
const REPO = resolve(ROOT, "..");                  // 레포 루트 (docs/·engine/ 는 여기)
const SRC = join(ROOT, "src");
const fails: string[] = [];
const warns: string[] = [];
const fail = (m: string) => fails.push(m);
const warn = (m: string) => warns.push(m);

// ── 0) 파일 수집 ──────────────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const srcFiles = walk(SRC).filter((f) => f.endsWith(".ts"));
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

// ── 1) 줄 수 캡 (소프트캡 ~300 경고, ~400 실패) ──────────────────────────────
const CODE_WARN = 300, CODE_FAIL = 400;
for (const f of srcFiles) {
  const n = readFileSync(f, "utf8").split("\n").length;
  if (n >= CODE_FAIL) fail(`줄 수 초과(${n}≥${CODE_FAIL}): ${rel(f)} — 먼저 분리 후 추가`);
  else if (n >= CODE_WARN) warn(`줄 수 근접(${n}≥${CODE_WARN}): ${rel(f)} — 곧 분리 고려`);
}
// 문서 길이(#6) — 경고만. 스펙(GAME-DESIGN)은 길 수 있으니 관대하게.
const DOC_WARN = 700;
for (const d of ["CLAUDE.md", "README.md", "docs/GAME-DESIGN.md", "docs/CODE-MAP.md"]) {
  const p = join(REPO, d);
  if (!existsSync(p)) continue;
  const n = readFileSync(p, "utf8").split("\n").length;
  const cap = d === "CLAUDE.md" ? 200 : DOC_WARN;
  if (n >= cap) warn(`문서 김(${n}≥${cap}줄): ${d} — 분리/축약 고려`);
}

// ── 2) 계약 레이어 순수성 (8.1/8.3) — src/contract = 타입+순수유틸, IO/뷰의존 금지 ──
const coreFiles = srcFiles.filter((f) => rel(f).startsWith("src/contract/"));
for (const f of coreFiles) {
  const txt = readFileSync(f, "utf8");
  // 결정론: 테스트 포함 전부 금지
  for (const pat of [/\bMath\.random\b/, /\bDate\.now\b/, /\bnew Date\b/]) {
    if (pat.test(txt)) fail(`코어 결정론 위반(${pat.source}): ${rel(f)} — 무작위는 state.rng만`);
  }
  if (f.endsWith(".test.ts")) continue; // 아래는 비테스트만
  if (/\bconsole\s*\./.test(txt)) fail(`계약 IO 위반(console): ${rel(f)} — 출력은 ui에서만`);
  if (/from\s+["'][^"']*\/ui\//.test(txt) || /from\s+["']\.\.?\/ui\//.test(txt))
    fail(`계약→뷰 의존(단방향 위반): ${rel(f)} — contract는 ui를 import하지 않음`);
  if (/\brequire\(["']readline/.test(txt) || /from\s+["']node:readline/.test(txt))
    fail(`코어 IO 위반(readline): ${rel(f)}`);
}

// ── 2.5) 웹 게임-티 가드 (CLAUDE 평행개발: 플레이어 표면은 브라우저 네이티브 UI 노출 금지) ──
// player 표면 = src/ui/ − editor/(디자이너 도구 면제). 네이티브 다이얼로그·툴팁·드롭다운·링크 금지.
const WEB_TELLS: { pat: RegExp; why: string }[] = [
  { pat: /\balert\(/, why: "네이티브 alert → 인게임 토스트/모달" },
  { pat: /\bconfirm\(/, why: "네이티브 confirm → 인게임 확인 모달" },
  { pat: /\bprompt\(/, why: "네이티브 prompt → 인게임 입력 모달" },
  { pat: /\bwindow\.open\(/, why: "새 창/탭 → 인게임 화면 전환" },
  { pat: /\bnew Notification\b|\bNotification\.requestPermission/, why: "OS 알림 → 인게임 알림" },
  { pat: /\stitle="/, why: "네이티브 title= 툴팁 → 커스텀 툴팁(.chip 패턴)" },
  { pat: /<select(\s|>)/, why: "네이티브 <select> 드롭다운 → div 기반 커스텀" },
  { pat: /<a\s+href|target="_blank"/, why: "하이퍼링크/새탭 → 인게임 라우팅" },
];
const playerWeb = srcFiles.filter((f) => rel(f).startsWith("src/ui/") && !rel(f).startsWith("src/ui/editor/") && !f.endsWith(".test.ts"));
for (const f of playerWeb) {
  const txt = readFileSync(f, "utf8");
  for (const { pat, why } of WEB_TELLS) if (pat.test(txt)) fail(`웹 게임-티(${pat.source}): ${rel(f)} — ${why}`);
}

// ── 3) 배럴 규율 (서브시스템 내부 파일은 배럴/파사드로만 접근) ──────────────────
const isCoreFacade = (f: string) => /^src\/contract\/[^/]+\.ts$/.test(rel(f)); // src/contract 바로 밑 파일 = 파사드 허용
for (const f of srcFiles) {
  const rf = rel(f);
  const txt = readFileSync(f, "utf8");
  for (const m of txt.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = rel(resolve(dirname(f), m[1]));
    const seg = target.match(/^src\/contract\/(run|types)\/(.+)$/);
    if (!seg) continue;
    const [, sub, inner] = seg;
    if (basename(inner) === "index.ts") continue; // 배럴은 OK
    const importerInSub = rf.startsWith(`src/contract/${sub}/`);
    if (importerInSub) continue; // 같은 서브시스템 내부 = OK
    if (isCoreFacade(f)) continue; // 파사드(run.ts/types.ts) = OK
    warn(`배럴 우회 import: ${rf} → ${target} (배럴/파사드 경유 권장)`);
  }
}

// ── 3.5) 스키마 드리프트 가드 (TS 콘텐츠 data.generated ↔ Rust spr-types 구조체 필드 일치) ──
for (const m of checkSchemaDrift()) fail(m);

// ── 4) tsc ────────────────────────────────────────────────────────────────
function run(cmd: string): { ok: boolean; out: string } {
  try { return { ok: true, out: execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e: any) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
}
process.stdout.write("typecheck… ");
const tsc = run("npm run -s typecheck");
console.log(tsc.ok ? "ok" : "FAIL");
if (!tsc.ok) fail(`typecheck 에러:\n${tsc.out.trim().split("\n").slice(-12).join("\n")}`);

// ── 5) 테스트 ────────────────────────────────────────────────────────────────
process.stdout.write("test… ");
const test = run("npm test");
const passed = /pass (\d+)/.exec(test.out)?.[1];
console.log(test.ok ? `ok (${passed} pass)` : "FAIL");
if (!test.ok) fail(`테스트 실패:\n${test.out.trim().split("\n").slice(-15).join("\n")}`);

// ── 5.5) Rust 엔진 게이트 (engine/ 결정론·differential 회귀) ──────────────────
if (existsSync(join(REPO, "engine", "Cargo.toml"))) {
  process.stdout.write("cargo test… ");
  const cargo = run("cargo test --manifest-path ../engine/Cargo.toml -q"); // cwd=web/
  console.log(cargo.ok ? "ok" : "FAIL");
  if (!cargo.ok) fail(`cargo test 실패:\n${cargo.out.trim().split("\n").slice(-15).join("\n")}`);
}

// (구 §6 데모 해시 회귀 = TS CLI 골든 — TS 엔진 은퇴로 제거. 결정론 회귀 게이트 = 위 cargo test[differential·save-roundtrip 등].)

// ── 7) 문서 동기화(#5) — staged src 변경 시 CODE-MAP 갱신 확인 ────────────────
const staged = run("git diff --cached --name-only");
if (staged.ok && staged.out.trim()) {
  const names = staged.out.trim().split("\n");
  const srcChanged = names.some((n) => n.startsWith("web/src/") && n.endsWith(".ts") && !n.endsWith(".test.ts"));
  const mapChanged = names.includes("docs/CODE-MAP.md");
  if (srcChanged && !mapChanged) warn("src 변경됨 — docs/CODE-MAP.md 갱신 확인(새 파일/함수 매핑)");
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log("");
if (warns.length) { console.log(`⚠️  WARN ${warns.length}`); for (const w of warns) console.log("  - " + w); }
if (fails.length) { console.log(`\n❌ FAIL ${fails.length}`); for (const f of fails) console.log("  - " + f); }
if (!warns.length && !fails.length) console.log("✅ 전부 통과");
process.exit(fails.length ? 1 : 0);
