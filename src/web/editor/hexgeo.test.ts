// 헥스 기하 검증 — "완벽한 벌집"의 수학적 증명: 인접 셀은 변(꼭짓점 2개)을 정확히 공유, 비인접은 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hexCorners, pixelToAxial, ccx, ccy } from "./hexgeo.ts";

const EPS = 0.01;
function sharedCorners(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const ca = hexCorners(a.q, a.r), cb = hexCorners(b.q, b.r);
  let n = 0;
  for (const p of ca) if (cb.some((qd) => Math.abs(qd.x - p.x) < EPS && Math.abs(qd.y - p.y) < EPS)) n++;
  return n;
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

test("인접 6방향 셀은 변(꼭짓점 2개)을 정확히 공유 = 완벽한 벌집", () => {
  for (const [dq, dr] of NEIGHBORS) {
    assert.equal(sharedCorners({ q: 0, r: 0 }, { q: dq, r: dr }), 2, `(${dq},${dr}) 이웃은 변 공유`);
  }
});

test("비인접 셀은 꼭짓점을 공유하지 않음", () => {
  for (const [dq, dr] of [[2, 0], [0, 2], [2, -2], [-2, 1], [1, 1]]) {
    assert.equal(sharedCorners({ q: 0, r: 0 }, { q: dq, r: dr }), 0, `(${dq},${dr})은 비인접`);
  }
});

test("모든 변 길이가 동일(정육각형) = 균일", () => {
  const c = hexCorners(3, -2);
  const lens = c.map((p, i) => { const n = c[(i + 1) % 6]; return Math.hypot(n.x - p.x, n.y - p.y); });
  for (const l of lens) assert.ok(Math.abs(l - lens[0]) < EPS, `변 길이 균일: ${lens.join(",")}`);
});

test("pixelToAxial ∘ 셀중심 = 항등(라운드트립)", () => {
  for (const [q, r] of [[0, 0], [3, -1], [-2, 4], [5, 5], [-6, 2]]) {
    const back = pixelToAxial(ccx(q, r), ccy(r));
    assert.deepEqual(back, { q, r }, `(${q},${r}) 라운드트립`);
  }
});
