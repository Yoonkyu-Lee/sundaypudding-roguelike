// 런 공개 API 배럴. 소비자(web/cli/test)는 여기(또는 core/run.ts 파사드)에서만 import.
export type { NodeType, MapNode, MapEdge, FloorDef, RunDef } from "../types.ts";
export type { RunPhase, RewardOption, ShopOffer, RunState, NodeStatus, RunView } from "./types.ts";
export { createRun, enterNode, resolveBattleEnd, chooseReward, setActiveSkill, movePartyMember } from "./run.ts";
export { buyShopOffer, leaveShop } from "./shop.ts";
export { chooseEncounterOption } from "./encounter.ts";
export { equipItem, unequipItem } from "./items.ts";
export { serializeRun, deserializeRun } from "./save.ts";
export { unlockedTier, genRewards, ownsUpgradeLine } from "./rewards.ts";
export { getRunView } from "./view.ts";
export { fireRunTrigger, type RunTriggerCtx } from "./passives.ts";
export { mapNode, hexAdjacent, neighborIds, clearNodeIds, reachableFromEntry, canReachClear, liveReachable, validateFloor, validateRun, type FloorValidation, type RunValidation } from "./graph.ts";
export { curFloor } from "./helpers.ts";
