// 보상 생성 (4.5: 항상 3택1) — 순수 생성(적용/노드완료는 run.ts). 데미지는 스킬 강화로만(4.2).
import type { RewardOption, RunState } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";
import { itemRewardOptions } from "./items.ts";

/** 캐릭이 보유한 데미지 스킬 id 목록 (강화 보상/인카운터 대상 선정용) */
export function damagingSkills(charId: string): string[] {
  return CHARACTERS[charId].skillIds.filter((id) => SKILLS[id]?.effects.some((e) => e.kind === "damage"));
}

/** 숙련도 레벨 → 보상에 출현 가능한 최대 스킬 tier (4.4). 디자이너 튜닝 곡선. */
export function unlockedTier(level: number): number {
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

/** 그 스킬이 멤버의 숙련도로 보상에 출현 가능한가 (useMastery off면 항상 true). */
function tierOk(run: RunState, m: { masteryLevel: number }, skillId: string): boolean {
  if (!run.useMastery) return true;
  return (SKILLS[skillId]?.tier ?? 1) <= unlockedTier(m.masteryLevel);
}

/** 베이스 스킬의 강화 라인(nextTierId 체인) 중 하나라도 보유 중이면 true.
 *  강화로 베이스가 상위 티어로 교체된 뒤(예: 종로의 주먹→종로의 주먹+), 베이스가 '새 스킬'로 다시 학습 후보에 뜨는 다운그레이드 방지. */
export function ownsUpgradeLine(ownedSkillIds: string[], baseSkillId: string): boolean {
  let cur: string | undefined = baseSkillId;
  const seen = new Set<string>();
  while (cur && SKILLS[cur] && !seen.has(cur)) {
    if (ownedSkillIds.includes(cur)) return true;
    seen.add(cur);
    cur = SKILLS[cur].nextTierId;
  }
  return false;
}

/** 보상 후보 풀: 살아있는 파티원의 (강화 가능 스킬 + 학습 가능 스킬). 데미지=스킬로만(4.2).
 *  tier(노드 보상 등급, 기본 1): 선택지 수 = 3 + clamp(tier-1,0,2)(1→3·2→4·3→5), 아이템 후보 = clamp(tier,1,3). */
export function genRewards(run: RunState, tier = 1): RewardOption[] {
  const choiceCount = 3 + Math.max(0, Math.min(2, tier - 1));
  const itemCount = Math.max(1, Math.min(3, tier));
  const living = run.party.filter((m) => m.hp > 0);
  let k = 0;
  const mk = () => `rw${run.visited.length}_${k++}`;
  const pool: RewardOption[] = [];

  for (const m of living) {
    const c = CHARACTERS[m.charId];
    // (a) 강화: 보유 스킬 중 다음 티어가 있는 것 (숙련도가 그 tier 해금했을 때만, 4.4)
    for (const sid of m.ownedSkillIds) {
      const sk = SKILLS[sid];
      const to = sk?.nextTierId ? SKILLS[sk.nextTierId] : undefined;
      if (sk && to && tierOk(run, m, sk.nextTierId!)) pool.push({ id: mk(), kind: "upgradeSkill", charId: m.charId, fromSkillId: sid, toSkillId: sk.nextTierId!, label: `${c.name}: 「${sk.name}」→「${to.name}」 강화` });
    }
    // (b) 새 스킬: 학습기 풀(캐릭 learnset) 중 강화 라인 미보유 (숙련도 tier 내). 라인 보유 시 베이스 재출현 안 함(다운그레이드 방지)
    for (const sid of c.skillIds) {
      if (!ownsUpgradeLine(m.ownedSkillIds, sid) && tierOk(run, m, sid)) pool.push({ id: mk(), kind: "learnSkill", charId: m.charId, skillId: sid, label: `${c.name}: 새 스킬 「${SKILLS[sid].name}」 습득` });
    }
  }
  // (c) 장신구(4.5): 아이템 후보를 풀에 섞음(등급↑일수록 더 많이)
  pool.push(...itemRewardOptions(run, mk, itemCount));

  // 결정론 추첨 — choiceCount택1(등급별)
  const chosen: RewardOption[] = [];
  while (chosen.length < choiceCount && pool.length > 0) chosen.push(pool.splice(run.rng.int(0, pool.length - 1), 1)[0]);
  // 모자라면(전부 최종티어·풀 만보유) 회복으로 채움
  while (chosen.length < choiceCount) chosen.push({ id: mk(), kind: "heal", pct: 0.3, label: "파티 30% 회복" });
  return chosen;
}
