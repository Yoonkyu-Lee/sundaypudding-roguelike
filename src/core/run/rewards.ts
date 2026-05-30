// 보상 생성 (4.5: 항상 3택1) — 순수 생성(적용/노드완료는 run.ts). 데미지는 스킬 강화로만(4.2).
import type { RewardOption, RunState } from "./types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { SKILLS } from "../../data/skills.ts";

/** 캐릭이 보유한 데미지 스킬 id 목록 (강화 보상/인카운터 대상 선정용) */
export function damagingSkills(charId: string): string[] {
  return CHARACTERS[charId].skillIds.filter((id) => SKILLS[id]?.effects.some((e) => e.kind === "damage"));
}

export function genRewards(run: RunState): RewardOption[] {
  const living = run.party.filter((m) => m.hp > 0);
  const opts: RewardOption[] = [];
  let k = 0;
  const mk = () => `rw${run.visited.length}_${k++}`;

  // 1) 스킬 강화 (데미지는 스킬 강화로만, 4.2)
  for (const m of living) {
    const sk = damagingSkills(m.charId);
    if (sk.length) {
      const skillId = sk[run.rng.int(0, sk.length - 1)];
      opts.push({ id: mk(), kind: "skillUp", charId: m.charId, skillId, amount: 3, label: `${CHARACTERS[m.charId].name} 「${SKILLS[skillId].name}」 +3 피해` });
      break;
    }
  }
  // 2) 최대 HP
  if (living.length) {
    const m = living[run.rng.int(0, living.length - 1)];
    opts.push({ id: mk(), kind: "maxhp", charId: m.charId, amount: 6, label: `${CHARACTERS[m.charId].name} 최대 HP +6` });
  }
  // 3) 전체 회복
  opts.push({ id: mk(), kind: "heal", pct: 0.4, label: "파티 전체 40% 회복" });
  return opts;
}
