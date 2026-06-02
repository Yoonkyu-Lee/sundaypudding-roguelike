// 헥스 기하 단일 진실원(SoT) — 격자·노드·벽이 모두 이걸 공유해 완벽한 벌집을 보장.
// 순수(테스트 가능). pointy-top axial. 좌표는 필드 로컬 픽셀.
export const SIZE = 34;                  // 중심→꼭짓점(외접원)
export const W = Math.sqrt(3) * SIZE;    // 헥스 폭(평행변 간격)
export const R = 14;                     // 격자 반경(±R 셀)
export const OX = W * 1.5 * R + W;       // 원점 오프셋(모든 셀 양수)
export const OY = 1.5 * SIZE * R + 2 * SIZE;
export const FW = OX * 2, FH = OY * 2;   // 고정 격자(필드) 크기

export const ccx = (q: number, r: number) => OX + W * (q + r / 2); // 셀 중심 x
export const ccy = (r: number) => OY + 1.5 * SIZE * r;             // 셀 중심 y

/** 셀(q,r)의 6 꼭짓점(절대 좌표). 격자·노드 폴리곤·벽이 공유 → 인접 셀은 변(꼭짓점 2개)을 정확히 공유. */
export function hexCorners(q: number, r: number): { x: number; y: number }[] {
  const x = ccx(q, r), y = ccy(r), s2 = SIZE / 2;
  return [
    { x, y: y - SIZE },       // top
    { x: x + W / 2, y: y - s2 }, // upper-right
    { x: x + W / 2, y: y + s2 }, // lower-right
    { x, y: y + SIZE },       // bottom
    { x: x - W / 2, y: y + s2 }, // lower-left
    { x: x - W / 2, y: y - s2 }, // upper-left
  ];
}
export const hexPoints = (q: number, r: number): string =>
  hexCorners(q, r).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** 픽셀(필드 로컬)→axial 셀 (역변환 + 큐브 라운딩). */
export function pixelToAxial(fx: number, fy: number): { q: number; r: number } {
  const x = fx - OX, y = fy - OY;
  const r = y / (1.5 * SIZE);
  let xq = x / W - r / 2, z = r, yq = -xq - z;
  let rx = Math.round(xq), ry = Math.round(yq), rz = Math.round(z);
  const dx = Math.abs(rx - xq), dy = Math.abs(ry - yq), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}

let GRID = "";
/** 희미한 육각 격자 path(메모이즈). 셀마다 hexCorners로 닫힌 윤곽 → 격자=노드와 동일 기하. */
export function gridPathStr(): string {
  if (GRID) return GRID;
  const segs: string[] = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    const c = hexCorners(q, r);
    segs.push("M" + c.map((p, i) => `${i ? "L" : ""}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("") + "Z");
  }
  GRID = segs.join("");
  return GRID;
}
