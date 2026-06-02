// 빌드 후처리 — public/avatars의 webp를 base64로 dist/index.html에 인라인 → 완전 단일 파일.
// viteSingleFile이 JS/CSS는 이미 인라인함. 아바타는 런타임 문자열 경로(/avatars/x.webp)라 여기서 처리.
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const htmlPath = join(dist, "index.html");
let html = readFileSync(htmlPath, "utf8");

// 1) 아바타 base64 치환
const avDir = join(dist, "avatars");
if (existsSync(avDir)) {
  for (const f of readdirSync(avDir)) {
    const b64 = readFileSync(join(avDir, f)).toString("base64");
    html = html.split(`/avatars/${f}`).join(`data:image/webp;base64,${b64}`);
  }
  rmSync(avDir, { recursive: true, force: true });
}

// 2) 외부 참조가 남아있지 않은지 검증(있으면 단일 파일이 아님 → 중단)
const leftover = /(src|href)=["']\/(assets|avatars)\//.exec(html);
if (leftover) {
  console.error(`❌ 외부 참조가 남음: ${leftover[0]} — viteSingleFile 인라인 실패. dist/ 유지.`);
  process.exit(1);
}

// 3) 인라인 끝났으니 빈 assets 폴더 정리
const assets = join(dist, "assets");
if (existsSync(assets)) rmSync(assets, { recursive: true, force: true });

writeFileSync(htmlPath, html);
const kb = (statSync(htmlPath).size / 1024).toFixed(0);
console.log(`✓ 단일 파일 완성: dist/index.html (${kb} KB) — 더블클릭으로 브라우저에서 실행, 오프라인 동작`);
