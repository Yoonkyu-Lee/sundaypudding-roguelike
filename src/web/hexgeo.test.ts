// 헥스 기하 검증 — "완벽한 벌집"의 수학적 증명: 인접 셀은 변(꼭짓점 2개)을 정확히 공유, 비인접은 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hexCorners, pixelToAxial, ccx, ccy, cornerOffsets, edgeDirIndex, EDGE_DIRS } from "./hexgeo.ts";
import { hexAdjacent } from "../core/run.ts";
import type { MapNode } from "../core/types.ts";

const hx = (q: number, r: number): MapNode => ({ id: `${q},${r}`, type: "battle", q, r });

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

test("edgeDirIndex + cornerOffsets = 그 방향 이웃과의 공유 변 (플레이어 맵 벽 기하 SoT)", () => {
  // 이웃 b를 향한 변(edgeDirIndex)의 두 끝점(cornerOffsets)이, 두 셀이 실제로 공유하는 꼭짓점 2개와 일치해야 한다.
  const S = 46; // 플레이어 맵 SIZE(에디터 34와 다른 스케일에서도 동일 기하)
  const co = cornerOffsets(S);
  for (const [dq, dr] of NEIGHBORS) {
    const ei = edgeDirIndex(dq, dr);
    assert.ok(ei >= 0, `(${dq},${dr})은 이웃 방향`);
    // a 중심(원점 가정) + 변 끝점 == b 중심 기준 같은 점(스케일 S에서 인접 중심 거리 = W)
    const W = Math.sqrt(3) * S;
    const bx = W * (dq + dr / 2), by = 1.5 * S * dr; // b 중심(a 기준 상대)
    const cb = co.map((o) => ({ x: bx + o.x, y: by + o.y }));
    const e1 = co[ei], e2 = co[(ei + 1) % 6];
    for (const e of [e1, e2]) assert.ok(cb.some((p) => Math.abs(p.x - e.x) < EPS && Math.abs(p.y - e.y) < EPS), `변 끝점이 이웃과 공유됨 dir(${dq},${dr})`);
  }
});

test("V2 edgeDirIndex는 EDGE_DIRS의 역함수 — edgeDirIndex(EDGE_DIRS[i])=i, 비방향=-1", () => {
  for (let i = 0; i < EDGE_DIRS.length; i++) {
    const [dq, dr] = EDGE_DIRS[i];
    assert.equal(edgeDirIndex(dq, dr), i, `EDGE_DIRS[${i}] 역함수`);
  }
  for (const [dq, dr] of [[2, 0], [0, 0], [1, 1], [-2, 3]]) assert.equal(edgeDirIndex(dq, dr), -1, `(${dq},${dr}) 비방향`);
});

test("V3 EDGE_DIRS(에디터 벽) ↔ 엔진 hexAdjacent 동치 — 같은 헥스 모델(교차 모듈 회귀가드)", () => {
  // 에디터가 벽/인접을 그리는 6방향이 곧 엔진(graph.ts hexAdjacent)이 인정하는 인접이어야 한다.
  assert.equal(EDGE_DIRS.length, 6, "정확히 6방향");
  for (const [dq, dr] of EDGE_DIRS) {
    assert.ok(hexAdjacent(hx(0, 0), hx(dq, dr)), `EDGE_DIRS (${dq},${dr})는 엔진 인접`);
  }
  // 비-EDGE_DIRS 방향은 엔진도 비인접 (벽 방향이 인접 정의와 정확히 일치)
  for (const [dq, dr] of [[2, 0], [0, 2], [1, 1], [2, -2], [-1, -1]]) {
    assert.equal(hexAdjacent(hx(0, 0), hx(dq, dr)), false, `(${dq},${dr})은 비인접인데 엔진이 인접 판정`);
  }
});

test("pixelToAxial ∘ 셀중심 = 항등(라운드트립)", () => {
  for (const [q, r] of [[0, 0], [3, -1], [-2, 4], [5, 5], [-6, 2]]) {
    const back = pixelToAxial(ccx(q, r), ccy(r));
    assert.deepEqual(back, { q, r }, `(${q},${r}) 라운드트립`);
  }
});
