// 룰 컴파일 — 보유 스킬의 passives + 캐릭터 traitIds → CompiledRule[] (전투 시작 시 makeUnit이 호출).
import type { CompiledRule, PassiveRule } from "../../types.ts";
import { SKILLS } from "../../../data/skills.ts";
import { CHARACTERS } from "../../../data/characters.ts";
import { TRAITS } from "../../../data/traits.ts";

function mk(rule: PassiveRule, via: { kind: "skill" | "trait"; id: string }, idx: number): CompiledRule {
  return { rule, via, idx, firedThisTurn: 0, firedThisBattle: 0 };
}

/** 패시브 = 보유 기준. 적은 ownedSkillIds 미제공 시 캐릭터 skillIds 전체를 보유로 간주. 특성은 항상 적용. */
export function compileRules(charId: string, ownedSkillIds: string[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  let idx = 0;
  for (const sid of ownedSkillIds) {
    const sk = SKILLS[sid];
    if (!sk?.passives) continue;
    for (const rule of sk.passives) out.push(mk(rule, { kind: "skill", id: sid }, idx++));
  }
  for (const tid of CHARACTERS[charId]?.traitIds ?? []) {
    const t = TRAITS[tid];
    if (!t) continue;
    for (const rule of t.rules) out.push(mk(rule, { kind: "trait", id: tid }, idx++));
  }
  return out;
}
