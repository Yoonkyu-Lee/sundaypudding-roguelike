// ─────────────────────────────────────────────────────────────────────────
// 자유 방향그래프 맵 스키마 (디자이너 데이터 계약, 7장). 에디터가 JSON으로 저작.
// 엔진(core/run/graph.ts)이 해석 — 좌표암시 간선(구 genMap) 폐기, 명시적 방향 간선.
// 이동=간선 방향, 복귀 불가. clear 노드 진입=층 종료. 런=층 그래프(clear.toFloor 링크, 분기 가능).
// ─────────────────────────────────────────────────────────────────────────
import type { NodeType, Pos } from "./content.ts";
import type { PassiveRule } from "./passives.ts";

// ── 노드 레이어 (NODE-DESIGN Phase A) ─────────────────────────────────────
// 노드 = 타입 코어 + 부착 레이어. 레이어 = 진입/완료 슬롯에 순서 실행하는 효과.
// Phase A 슬라이스1 = 즉시(데코레이터) 레이어만. 상호작용 모듈(combat 등)은 A2~.
// 레이어 = 데코레이터(즉시 실행) + 상호작용 모듈(완료까지 블록). 해석: 데코=helpers.runInstantLayers, 상호작용=run/layers.ts 시퀀서.
/** 즉시 실행 데코레이터 레이어 — 어느 노드든 부착 가능(전역). */
export type DecoratorLayer =
  | { kind: "gold"; amount: number } // 골드 ±(0 미만 클램프)
  | { kind: "heal"; pct: number; revive?: boolean } // 파티 회복(maxHp 비율, revive=전투불능 부활)
  | { kind: "grantStatus"; charId?: string; statusId: string; stacks: number; duration: number } // 다음 전투 계승(charId 없으면 전원)
  | { kind: "text"; text: string }; // 로그/대사(컷신 뷰 강화는 Phase C)
/** 상호작용 레이어 — 완료까지 블록(phase 전환). combat·reward(B). shop/event는 후속. */
export type InteractiveLayer =
  | { kind: "combat"; roster?: { charId: string; pos: Pos }[]; rosterPreset?: string; boss?: boolean; rules?: PassiveRule[] } // 적: roster>rosterPreset>battle. 보스=진형보너스. rules=이 전투의 트리거 룰(페이즈별 대사·개입, Phase C/E4)
  | { kind: "reward" } // 보상 3택1(genRewards) — 플레이어 선택까지 블록. treasure 노드 = core:[reward]
  | { kind: "shop" } // 상점 진열(generateShop) — leaveShop까지 블록. 스타터는 DI 등록(run.ts)
  | { kind: "event" }; // 인카운터 추첨(랜덤) — chooseEncounterOption까지 블록. 노드별 저작은 Phase D
/** 노드 레이어 — onEnter/onResolve는 데코만(즉시), core는 데코+상호작용 혼합(순서 실행). */
export type Layer = DecoratorLayer | InteractiveLayer;
export type LayerKind = Layer["kind"];
/** 노드의 부착 레이어 — 슬롯별 순서 리스트. onEnter=진입 직후, onResolve=노드 완료 시. */
export interface NodeLayers {
  onEnter?: DecoratorLayer[];
  onResolve?: DecoratorLayer[];
}

/** 맵 노드 — q,r은 에디터 캔버스/렌더 좌표(위상 아님; 위상은 edges가 정의). */
export interface MapNode {
  id: string;
  type: NodeType; // start=입장, clear=목표 마커, 그 외=노드별 해소(전투/상점/휴식/인카운터)
  q: number;
  r: number;
  /** clear 노드 전용: 진입 시 갈 다음 층 id. 없으면 그 클리어 = 런 승리(종료). 여러 clear = 분기. */
  toFloor?: string;
  /** 전투 노드 전용: 적 구성 override. 없으면 타입 기본(NODE_ROSTERS[type])을 쓴다. */
  roster?: { charId: string; pos: Pos }[];
  /** 표시 라벨(선택). 노드 위에 표기 — 같은 타입 노드를 구분(예: "두목 호위대"). */
  label?: string;
  /** 부착 레이어(선택, Phase A). 없으면 순수 타입 코어 동작(기존과 동일). */
  layers?: NodeLayers;
  /** 코어 시퀀스(선택, Phase A2). 있으면 타입 분기 대신 이 레이어들을 순서 실행(combat 웨이브 등). 트리거 룰은 각 combat 레이어가 소유. */
  core?: Layer[];
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
