// 런 공개 API 배럴. 소비자(web/cli/test)는 여기(또는 core/run.ts 파사드)에서만 import.
export type { NodeType, RunNode } from "./map.ts";
export type { RunPhase, RewardOption, ShopOffer, RunState, NodeStatus, RunView } from "./types.ts";
export { createRun, enterNode, resolveBattleEnd, chooseReward, setActiveSkill, movePartyMember, buyShopOffer, leaveShop, chooseEncounterOption } from "./run.ts";
export { equipItem, unequipItem } from "./items.ts";
export { serializeRun, deserializeRun } from "./save.ts";
export { unlockedTier, genRewards, ownsUpgradeLine } from "./rewards.ts";
export { getRunView } from "./view.ts";
export { fireRunTrigger, type RunTriggerCtx } from "./passives.ts";
