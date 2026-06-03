// 룰 컴파일 — 보유 스킬의 passives + 캐릭터 traitIds → CompiledRule[] (전투 시작 시 makeUnit이 호출).
import type { CompiledRule, PassiveRule } from "../../types.ts";
import { SKILLS } from "../../../data/skills.ts";
import { CHARACTERS } from "../../../data/characters.ts";
import { TRAITS } from "../../../data/traits.ts";

function mk(rule: PassiveRule, via: { kind: "skill" | "trait" | "node"; id: string }, idx: number): CompiledRule {
  return { rule, via, idx, firedThisTurn: 0, firedThisBattle: 0 };
}

/** 스킬 패시브 = 활성(출전) 기준 — `skillIds`는 그 유닛의 활성 스킬. 특성(traitIds)은 항상 적용. */
export function compileRules(charId: string, skillIds: string[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  let idx = 0;
  for (const sid of skillIds) {
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

/** 노드 트리거 룰(인라인 PassiveRule[]) → CompiledRule[] (Phase C — createBattle가 한 유닛에 주입). */
export function compileInline(rules: PassiveRule[]): CompiledRule[] {
  return rules.map((rule, i) => mk(rule, { kind: "node", id: "node" }, i));
}
