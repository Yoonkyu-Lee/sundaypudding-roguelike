// castSkill 재귀 방지 검증 — castSkill 대상은 passives 없는 leaf(순수 액티브) 스킬만 허용.
// 데이터만 참조(엔진 무관) → scripts/check.ts가 가볍게 호출해 커밋 게이트에서 차단.
import type { PassiveRule } from "../../types.ts";
import { SKILLS } from "../../../data/skills.ts";
import { TRAITS } from "../../../data/traits.ts";

/** 위반 메시지 목록(빈 배열 = 통과). */
export function validateCastSkill(): string[] {
  const errs: string[] = [];
  const scan = (src: string, rules: PassiveRule[]) => {
    for (const r of rules) for (const e of r.then) {
      if (e.do !== "castSkill") continue;
      const t = SKILLS[e.skillId];
      if (!t) errs.push(`${src} → castSkill 대상 '${e.skillId}' 없음`);
      else if (t.passives && t.passives.length) errs.push(`${src} → castSkill 대상 '${e.skillId}'에 passives 있음(재귀 위험; leaf 스킬만 허용)`);
    }
  };
  for (const id in SKILLS) { const p = SKILLS[id].passives; if (p) scan(`skill '${id}'`, p); }
  for (const id in TRAITS) scan(`trait '${id}'`, TRAITS[id].rules);
  return errs;
}
