// 야인시대 드라마 캐릭터 초상화 파밍 — 나무위키 og:image → web/public/avatars/<id>.webp
// 파이프라인: curl(브라우저 UA)로 나무위키 페이지 HTML → <meta og:image> 추출 → 이미지 다운로드 → 검증.
// (배포용 아님 — 개인 팬게임 placeholder. 나무위키/SBS 저작물.)
// 사용: node farm-portraits.mjs   (아래 LIST 편집). 받은 뒤 Read 도구로 얼굴 육안 검증 권장.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, statSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const OUT = "D:/Engineering/sundaypudding-roguelike/web/public/avatars";
mkdirSync(OUT, { recursive: true });

// id|한글이름 맵(D:/tmp/charmap.txt, CHARACTER-LIST 파싱) → 각 id마다 "이름(야인시대)" 우선, 실패 시 "이름".
import { readFileSync as _read } from "node:fs";
const LIST = _read("D:/tmp/charmap.txt", "utf8").trim().split("\n").map((l) => {
  const [id, name] = l.split("|");
  return name.includes("(야인시대)") ? [id, name] : [id, `${name}(야인시대)`, name];
});

const curl = (url, out) => {
  const base = `curl -sL --max-time 30 -A "${UA}" -e "https://namu.wiki/"`;
  if (out) { execSync(`${base} "${url}" -o "${out}"`, { stdio: "ignore" }); return null; }
  return execSync(`${base} "${url}"`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
};

const ogImage = (title) => {
  const url = "https://namu.wiki/w/" + encodeURIComponent(title);
  let html;
  try { html = curl(url); } catch { return null; }
  const m = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!m) return null;
  let u = m[1];
  if (u.startsWith("//")) u = "https:" + u;
  return u;
};

let ok = 0;
for (const [id, ...titles] of LIST) {
  let done = false;
  for (const title of titles) {
    const img = ogImage(title);
    if (!img) { continue; }
    const dest = `${OUT}/${id}.webp`;
    try {
      curl(img, dest);
      const sz = statSync(dest).size;
      // og:image는 보통 .webp 썸네일. 너무 작으면 에러 페이지, 너무 크면(>1.5MB) 원본 오선택 → 스킵.
      if (sz > 2000 && sz < 1_500_000) { console.log(`✅ ${id.padEnd(12)} ← ${title}  (${sz}b)`); ok++; done = true; break; }
      console.log(`⚠️  ${id} ${title} 크기 이상 ${sz}b`);
    } catch (e) { console.log(`⚠️  ${id} ${title} 다운 실패`); }
  }
  if (!done) console.log(`❌ ${id.padEnd(12)} — 못 찾음 (후보: ${titles.join(", ")})`);
}
console.log(`\n완료: ${ok}/${LIST.length}`);
