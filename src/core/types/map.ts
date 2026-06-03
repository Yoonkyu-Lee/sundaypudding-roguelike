// ─────────────────────────────────────────────────────────────────────────
// 자유 방향그래프 맵 스키마 (디자이너 데이터 계약, 7장). 에디터가 JSON으로 저작.
// 엔진(core/run/graph.ts)이 해석 — 좌표암시 간선(구 genMap) 폐기, 명시적 방향 간선.
// 이동=간선 방향, 복귀 불가. clear 노드 진입=층 종료. 런=층 그래프(clear.toFloor 링크, 분기 가능).
// ─────────────────────────────────────────────────────────────────────────
import type { NodeType, Pos } from "./content.ts";

/** 맵 노드 — q,r은 에디터 캔버스/렌더 좌표(위상 아님; 위상은 edges가 정의). */
export interface MapNode {
  id: string;
  type: NodeType; // start=입장, clear=목표 마커, 그 외=노드별 해소(전투/상점/휴식/인카운터)
  q: number;
  r: number;
  /** clear 노드 전용: 진입 시 갈 다음 층 id. 없으면 그 클리어 = 런 승리(종료). 여러 clear = 분기. */
  toFloor?: string;
}

/** 방향 있는 간선 — from에서 to로만 전진(복귀 불가). */
export interface MapEdge {
  from: string;
  to: string;
}

/** 한 층 = 방향그래프. entry에서 출발, 어느 clear 노드든 진입하면 층 종료. */
export interface FloorDef {
  id: string;
  name?: string;
  entryNodeId: string;
  nodes: MapNode[];
  edges: MapEdge[];
}

/** 런 = 층 그래프(floors 집합, clear.toFloor로 연결) + 시작 파티 + 모드 설정. (구 GameMode 흡수) */
export interface RunDef {
  id: string;
  name: string;
  desc?: string;
  useMastery: boolean;
  entryFloorId: string; // 시작 층 id
  roster: { charId: string; pos: Pos }[];
  floors: FloorDef[]; // 순서 무의미 — 탐색은 id(entryFloorId·clear.toFloor)로
}
