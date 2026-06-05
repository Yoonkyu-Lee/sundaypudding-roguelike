// 데이터 ID 참조 무결성 (DATA-SERIALIZATION-CONTRACT §6) — 모든 id 참조가 실재(dangling 금지).
// Rust 로드 시 동일 검증. 디자이너가 오타·삭제로 끊은 참조를 게이트로 잡음.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SKILLS } from "../../data/skills.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { TRAITS } from "../../data/traits.ts";
import { AI_PROFILES } from "../../data/ai.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { NODE_ROSTERS, DEMO_ENCOUNTER } from "../../data/encounters.ts";
import type { PassiveRule } from "../types.ts";

test("data-refs: 모든 id 참조가 실재(dangling 금지) — DATA-SERIALIZATION-CONTRACT §6", () => {
  const errs: string[] = [];
  const has = (map: Record<string, unknown>, id: string) => Object.prototype.hasOwnProperty.call(map, id);
  const ref = (ok: boolean, label: string) => { if (!ok) errs.push(label); };

  const checkRule = (rule: PassiveRule, where: string) => {
    for (const c of rule.if ?? []) {
      if ((c.c === "hasStatus" || c.c === "missingStatus") && c.statusId) ref(has(STATUS_DEFS, c.statusId), `${where} if.statusId '${c.statusId}'`);
    }
    for (const e of rule.then) {
      if ((e.do === "applyStatus" || e.do === "grantRunStatus") && e.statusId) ref(has(STATUS_DEFS, e.statusId), `${where} then.statusId '${e.statusId}'`);
      if (e.do === "castSkill" && e.skillId) ref(has(SKILLS, e.skillId), `${where} castSkill '${e.skillId}'`);
    }
  };

  for (const [id, c] of Object.entries(CHARACTERS)) {
    for (const sid of c.skillIds) ref(has(SKILLS, sid), `char ${id} skillId '${sid}'`);
    for (const tid of c.traitIds ?? []) ref(has(TRAITS, tid), `char ${id} traitId '${tid}'`);
    if (c.aiProfileId) ref(has(AI_PROFILES, c.aiProfileId), `char ${id} aiProfileId '${c.aiProfileId}'`);
  }
  for (const [id, s] of Object.entries(SKILLS)) {
    if (s.nextTierId) ref(has(SKILLS, s.nextTierId), `skill ${id} nextTierId '${s.nextTierId}'`);
    if (s.exclusiveTo) ref(has(CHARACTERS, s.exclusiveTo), `skill ${id} exclusiveTo '${s.exclusiveTo}'`);
    for (const e of s.effects) {
      if ((e.kind === "applyStatus" || e.kind === "applyStatusSelf") && e.statusId) ref(has(STATUS_DEFS, e.statusId), `skill ${id} effect.statusId '${e.statusId}'`);
    }
    for (const r of s.passives ?? []) checkRule(r, `skill ${id}`);
  }
  for (const [id, t] of Object.entries(TRAITS)) for (const r of t.rules) checkRule(r, `trait ${id}`);
  for (const [id, p] of Object.entries(AI_PROFILES)) {
    for (const r of p.rules) for (const c of r.if ?? []) {
      if ((c.c === "selfHasStatus" || c.c === "selfMissingStatus" || c.c === "enemyHasStatus") && c.statusId) ref(has(STATUS_DEFS, c.statusId), `ai ${id} if.statusId '${c.statusId}'`);
    }
  }
  for (const [type, roster] of Object.entries(NODE_ROSTERS)) for (const p of roster) ref(has(CHARACTERS, p.charId), `nodeRoster ${type} charId '${p.charId}'`);
  for (const p of [...DEMO_ENCOUNTER.allies, ...DEMO_ENCOUNTER.enemies]) ref(has(CHARACTERS, p.charId), `demo charId '${p.charId}'`);

  assert.equal(errs.length, 0, `dangling 참조 ${errs.length}:\n${errs.join("\n")}`);
});
