// 야인시대 대본 추출기 — docs/*.xlsx(통합대본) → docs/Yainsidae/_raw/epNNN.md (회차별 텍스트).
// _raw는 gitignore(파생물). 재생성 절차:
//   1) PowerShell: 각 xlsx를 .zip으로 복사 후 Expand-Archive
//      Copy-Item "docs/야인시대 1부 (1~50) 통합대본.xlsx" D:/tmp/yain1.zip; Expand-Archive D:/tmp/yain1.zip D:/tmp/yain1 -Force
//      Copy-Item "docs/야인시대 2부(51~124) 통합대본.xlsx" D:/tmp/yain2.zip; Expand-Archive D:/tmp/yain2.zip D:/tmp/yain2 -Force
//   2) node docs/Yainsidae/_tools/parse-script.mjs
// 시트 구조: sheet1(통합대본) 열 A=회차 B=시간(분窓) C=인물(나레이션/# 상황·장소·사물/캐릭터) D=대사.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = "D:/Engineering/sundaypudding-roguelike/docs/Yainsidae/_raw";
mkdirSync(OUT, { recursive: true });
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#10;/g, "\n").replace(/&#9;/g, "\t").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function sharedStrings(dir) {
  const ss = readFileSync(`${dir}/xl/sharedStrings.xml`, "utf8");
  return ss.split("<si>").slice(1).map((si) => [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join(""));
}
function rows(dir, strings) {
  const sh = readFileSync(`${dir}/xl/worksheets/sheet1.xml`, "utf8");
  const result = [];
  for (const rm of sh.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"((?:[^>]*))(?:\/>|>(?:<v>([\s\S]*?)<\/v>)?(?:<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>)/g)) {
      const [, col, attrs = "", v, inline] = cm;
      cells[col] = inline != null ? decode(inline) : v != null ? (/t="s"/.test(attrs) ? strings[Number(v)] ?? "" : decode(v)) : "";
    }
    result.push(cells);
  }
  return result;
}

const all = new Map();
for (const dir of ["D:/tmp/yain1", "D:/tmp/yain2"]) {
  const strings = sharedStrings(dir);
  let curEp = null, curTime = "";
  for (const c of rows(dir, strings)) {
    const a = (c.A ?? "").trim();
    if (a === "회차") continue;
    if (a) curEp = a;
    if ((c.B ?? "").trim()) curTime = c.B.trim();
    const who = (c.C ?? "").trim(), line = (c.D ?? "").trim();
    const ep = Number(curEp);
    if (!Number.isFinite(ep) || (!who && !line)) continue;
    if (!all.has(ep)) all.set(ep, []);
    all.get(ep).push({ time: curTime, who, line });
  }
}

const eps = [...all.keys()].sort((a, b) => a - b);
for (const ep of eps) {
  const buf = [`# 야인시대 ${ep}화`, ""];
  let lastTime = null;
  for (const { time, who, line } of all.get(ep)) {
    if (time !== lastTime) { buf.push("", `## [${time || "?"}분]`, ""); lastTime = time; }
    if (who.startsWith("#")) buf.push(`(${who.replace(/^#\s*/, "")}) ${line}`);
    else if (who === "나레이션") buf.push(`나레이션: ${line}`);
    else if (who) buf.push(`${who}: ${line}`);
    else buf.push(line);
  }
  writeFileSync(`${OUT}/ep${String(ep).padStart(3, "0")}.md`, buf.join("\n") + "\n");
}
console.log(`에피소드 ${eps.length}개 (${eps[0]}~${eps[eps.length - 1]}) 생성`);
