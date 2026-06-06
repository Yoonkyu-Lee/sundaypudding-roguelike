// 런 공개 API 배럴 (TS 엔진 은퇴 후 = 계약 타입 + 그래프 유틸만). 엔진 로직은 Rust(spr-core).
// 소비자(web 에디터/런화면)는 여기(또는 core/run.ts 파사드)에서만 import.
export type { NodeType, MapNode, MapEdge, FloorDef, RunDef, Layer, LayerKind, NodeLayers } from "../types.ts";
export type { RunPhase, RewardOption, ShopOffer, RunState, NodeStatus, RunView } from "./types.ts";
export { mapNode, hexAdjacent, neighborIds, clearNodeIds, reachableFromEntry, canReachClear, liveReachable, validateFloor, validateRun, type FloorValidation, type RunValidation } from "./graph.ts";
