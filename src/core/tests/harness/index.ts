// 검증 harness 배럴 — 무작위 캠페인 러너 + self-consistency.
export { runCampaign, type CampaignResult, type CampaignOpts, type Outcome, type ActionPolicy } from "./campaign.ts";
export { campaignTrace, tracesMatch, battleTrace } from "./selfConsistency.ts";
