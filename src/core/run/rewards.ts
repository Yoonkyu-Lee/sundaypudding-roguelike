// 보상 생성 (4.5: 항상 3택1) — 순수 생성(적용/노드완료는 run.ts). 데미지는 스킬 강화로만(4.2).
import type { RewardOption, RunState } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";

/** 캐릭이 보유한 데미지 스킬 id 목록 (강화 보상/인카운터 대상 선정용) */
export function damagingSkills(charId: string): string[] {
  return CHARACTERS[charId].skillIds.filter((id) => SKILLS[id]?.effects.some((e) => e.kind === "damage"));
}

/** 보상 후보 풀: 살아있는 파티원의 (강화 가능 스킬 + 학습 가능 스킬). 데미지=스킬로만(4.2). */
export function genRewards(run: RunState): RewardOption[] {
  const living = run.party.filter((m) => m.hp > 0);
  let k = 0;
  const mk = () => `rw${run.visited.length}_${k++}`;
  const pool: RewardOption[] = [];

  for (const m of living) {
    const c = CHARACTERS[m.charId];
    // (a) 강화: 보유 스킬 중 다음 티어가 있는 것
    for (const sid of m.ownedSkillIds) {
      const sk = SKILLS[sid];
      const to = sk?.nextTierId ? SKILLS[sk.nextTierId] : undefined;
      if (sk && to) pool.push({ id: mk(), kind: "upgradeSkill", charId: m.charId, fromSkillId: sid, toSkillId: sk.nextTierId!, label: `${c.name}: 「${sk.name}」→「${to.name}」 강화` });
    }
    // (b) 새 스킬: 학습기 풀(캐릭 learnset) 중 아직 미보유
    for (const sid of c.skillIds) {
      if (!m.ownedSkillIds.includes(sid)) pool.push({ id: mk(), kind: "learnSkill", charId: m.charId, skillId: sid, label: `${c.name}: 새 스킬 「${SKILLS[sid].name}」 습득` });
    }
  }

  // 3택1 결정론 추첨
  const chosen: RewardOption[] = [];
  while (chosen.length < 3 && pool.length > 0) chosen.push(pool.splice(run.rng.int(0, pool.length - 1), 1)[0]);
  // 모자라면(전부 최종티어·풀 만보유) 회복으로 채움
  while (chosen.length < 3) chosen.push({ id: mk(), kind: "heal", pct: 0.3, label: "파티 30% 회복" });
  return chosen;
}
