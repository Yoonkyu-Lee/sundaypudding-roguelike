//! 룰 컴파일 (TS `passives/compile.ts`) — 스킬 passives(활성) + 캐릭터 traitIds → CompiledRule[].
use spr_types::combat::CompiledRule;
use spr_types::data::Character;
use spr_types::passives::{PassiveRule, TraitDef};
use spr_types::skills::Skill;
use std::collections::HashMap;

fn mk(rule: PassiveRule, via_kind: &str, via_id: &str, idx: i64) -> CompiledRule {
    CompiledRule { rule, via_kind: via_kind.to_string(), via_id: via_id.to_string(), idx, fired_this_turn: 0, fired_this_battle: 0 }
}

/// 스킬 패시브(활성 기준) + 특성(항상) + 전직 부여 패시브(extra_trait_ids, 4.7). TS compileRules.
/// extra_trait_ids = 런 중 전직으로 부여된 trait id(`PartyMemberState.job_trait_ids`). 캐릭 traitIds 뒤에 이어 컴파일. 비전투/적은 &[].
pub fn compile_rules(
    char_id: &str,
    skill_ids: &[String],
    extra_trait_ids: &[String],
    chars: &HashMap<String, Character>,
    skills: &HashMap<String, Skill>,
    traits: &HashMap<String, TraitDef>,
) -> Vec<CompiledRule> {
    let mut out = Vec::new();
    let mut idx = 0i64;
    for sid in skill_ids {
        if let Some(sk) = skills.get(sid) {
            if let Some(ps) = &sk.passives {
                for rule in ps {
                    out.push(mk(rule.clone(), "skill", sid, idx));
                    idx += 1;
                }
            }
        }
    }
    if let Some(c) = chars.get(char_id) {
        for tid in &c.trait_ids {
            if let Some(t) = traits.get(tid) {
                for rule in &t.rules {
                    out.push(mk(rule.clone(), "trait", tid, idx));
                    idx += 1;
                }
            }
        }
    }
    // 전직 부여 패시브(런 한정) — 캐릭 특성 뒤에 결정론적 순서로.
    for tid in extra_trait_ids {
        if let Some(t) = traits.get(tid) {
            for rule in &t.rules {
                out.push(mk(rule.clone(), "trait", tid, idx));
                idx += 1;
            }
        }
    }
    out
}

/// 노드 트리거 룰(인라인) → CompiledRule[]. TS compileInline.
pub fn compile_inline(rules: &[PassiveRule]) -> Vec<CompiledRule> {
    rules.iter().enumerate().map(|(i, r)| mk(r.clone(), "node", "node", i as i64)).collect()
}
