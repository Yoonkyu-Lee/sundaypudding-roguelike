// 스킬 데이터 (데이터 주도). 위치 마스크·쿨타임·명중·효과 전부 데이터로. (2.4~2.10)
// 근접 스킬은 `reach`(동적 도달 열) 사용 — 정적 전방 마스크(FRONT2) 폐지(후열만 남는 교착 방지, 2.4).
import type { Skill } from "../contract/types.ts";

export const SKILLS: Record<string, Skill> = {
  // ══ 우익(대한민청) — 플레이어 ══
  // 김두한 (브루저/딜러, 높은 치명)
  kim_punch: { id: "kim_punch", name: "종로의 주먹", exclusiveTo: "kim", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 1, nextTierId: "kim_punch2", effects: [{ kind: "damage", amount: 14 }], passives: [{ when: { on: "onHit", as: "attacker", crit: true }, then: [{ do: "applyStatus", statusId: "bleed", stacks: 1, duration: 2, target: "subject" }] }] }, // 하이브리드: 능동 강타 + 크리 시 출혈 패시브
  kim_kick: { id: "kim_kick", name: "공중 이단 발차기", exclusiveTo: "kim", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "move", who: "self", deltaCol: -3 }, { kind: "damage", amount: 12 }] },
  kim_oyabun: { id: "kim_oyabun", name: "오야붕의 위엄", exclusiveTo: "kim", target: "self", cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "cleanse" }, { kind: "applyStatus", statusId: "might", stacks: 1, duration: 3 }, { kind: "applyStatus", statusId: "edge", stacks: 1, duration: 3 }] },
  kim_4dollar: { id: "kim_4dollar", name: "4달러", exclusiveTo: "kim", target: "ally", cooldown: 5, accuracy: 0, alwaysHit: true, grantsInterrupt: 1, grantsInterruptTo: "target", effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },

  // 상하이 조 (원거리 디버퍼)
  sh_pistol: { id: "sh_pistol", name: "권총 사격", exclusiveTo: "shanghai", target: "enemy", cooldown: 0, accuracy: 90, tier: 1, nextTierId: "sh_pistol2", effects: [{ kind: "damage", amount: 10 }] },
  sh_leg: { id: "sh_leg", name: "다리 조준 사격", exclusiveTo: "shanghai", target: "enemy", cooldown: 2, accuracy: 90, effects: [{ kind: "damage", amount: 4 }, { kind: "applyStatus", statusId: "paralyze", stacks: 2, duration: 2 }] },
  sh_grenade: { id: "sh_grenade", name: "수류탄 투척", exclusiveTo: "shanghai", target: "enemy", area: { kind: "square", radius: 1 }, cooldown: 3, accuracy: 85, effects: [{ kind: "damage", amount: 7 }, { kind: "applyStatus", statusId: "burn", stacks: 1, duration: 2 }] },
  sh_ult: { id: "sh_ult", name: "안 되겠소, 쏩니다!", exclusiveTo: "shanghai", target: "enemy", cooldown: 5, accuracy: 90, effects: [{ kind: "damage", amount: 16 }, { kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 }] },

  // 신영균 (광전사)
  shin_axe: { id: "shin_axe", name: "도끼 휘두르기", exclusiveTo: "shin", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 1, nextTierId: "shin_axe2", effects: [{ kind: "damage", amount: 12 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 3 }] },
  shin_charge: { id: "shin_charge", name: "분노의 돌격", exclusiveTo: "shin", target: "enemy", cooldown: 3, accuracy: 90, reach: 1, effects: [{ kind: "move", who: "self", deltaCol: -3 }, { kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }, { kind: "applyStatusSelf", statusId: "weaken", stacks: 1, duration: 1 }] },
  shin_awaken: { id: "shin_awaken", name: "야수성 각성", exclusiveTo: "shin", target: "self", cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 3 }, { kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }] },
  shin_ult: { id: "shin_ult", name: "에이잇! 할아버지!", exclusiveTo: "shin", target: "enemy", area: { kind: "free", count: 4 }, cooldown: 4, accuracy: 85, effects: [{ kind: "damage", amount: 9 }, { kind: "applyStatus", statusId: "bleed", stacks: 1, duration: 2 }] },

  // 조병옥 (지휘관/서포터)
  cho_warn: { id: "cho_warn", name: "경무부장의 경고", exclusiveTo: "cho", target: "enemy", cooldown: 0, accuracy: 90, tier: 1, nextTierId: "cho_warn2", effects: [{ kind: "damage", amount: 3 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },
  cho_martial: { id: "cho_martial", name: "비상계엄령", exclusiveTo: "cho", target: "ally", area: { kind: "all" }, cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 10 }] },
  cho_police: { id: "cho_police", name: "경찰 병력 호출", exclusiveTo: "cho", target: "enemy", area: { kind: "row" }, cooldown: 4, accuracy: 85, effects: [{ kind: "damage", amount: 6 }, { kind: "applyStatus", statusId: "paralyze", stacks: 1, duration: 2 }] },
  cho_ult: { id: "cho_ult", name: "당장 그만두시오!", exclusiveTo: "cho", target: "enemy", area: { kind: "all" }, cooldown: 5, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "fear", stacks: 3, duration: 2 }] },

  // ══ 좌익(조선공산당) — 적 ══
  // 정진영 (밸런스 딜러)
  jung_shot: { id: "jung_shot", name: "냉철한 사격", target: "enemy", cooldown: 0, accuracy: 90, effects: [{ kind: "applyStatusSelf", statusId: "pierce", stacks: 1, duration: 1 }, { kind: "damage", amount: 9 }] },
  jung_retreat: { id: "jung_retreat", name: "전술적 후퇴", target: "self", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "move", who: "self", deltaCol: 3 }, { kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },
  jung_charge: { id: "jung_charge", name: "전위대 돌격 명령", target: "enemy", area: { kind: "all" }, cooldown: 3, accuracy: 85, effects: [{ kind: "damage", amount: 6 }] },
  // target:"ally" = 시전자 자기 진영(적 유닛 기준의 아군). grantsInterruptTo:"self" = 시전자 본인 끼어들기 — 정확함(읽기 주의).
  jung_ult: { id: "jung_ult", name: "이념의 이름으로", target: "ally", area: { kind: "all" }, cooldown: 5, accuracy: 0, alwaysHit: true, grantsInterrupt: 1, grantsInterruptTo: "self", effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },

  // 김천호 (암살자)
  chunho_stab: { id: "chunho_stab", name: "암습", target: "enemy", cooldown: 0, accuracy: 95, reach: 1, effects: [{ kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 3 }] },
  chunho_shadow: { id: "chunho_shadow", name: "그림자 걸음", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "move", who: "self", deltaCol: 3 }, { kind: "applyStatus", statusId: "ambush", stacks: 1, duration: 2 }] },
  chunho_dagger: { id: "chunho_dagger", name: "독바른 단검 투척", target: "enemy", cooldown: 3, accuracy: 90, effects: [{ kind: "damage", amount: 6 }, { kind: "applyStatus", statusId: "poison", stacks: 2, duration: 3 }] },
  chunho_ult: { id: "chunho_ult", name: "잔인한 처단", target: "enemy", cooldown: 4, accuracy: 90, effects: [{ kind: "damage", amount: 18 }] },

  // 심영 (탱커/도발)
  shim_speech: { id: "shim_speech", name: "사회주의 찬양 연설", target: "enemy", area: { kind: "all" }, cooldown: 2, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }, { kind: "applyStatusSelf", statusId: "taunt", stacks: 1, duration: 2 }] },
  shim_mother: { id: "shim_mother", name: "어머니...", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 14 }, { kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }] },
  shim_flag: { id: "shim_flag", name: "님을 위한 전진", target: "ally", area: { kind: "all" }, cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 8 }] },
  shim_ult: { id: "shim_ult", name: "내가 고자라니!", target: "enemy", area: { kind: "all" }, cooldown: 5, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 }] },

  // 의사양반 (힐러)
  doc_tap: { id: "doc_tap", name: "청진기 찰싹", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 3 }] },
  doc_heal: { id: "doc_heal", name: "안심하세요", target: "ally", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "heal", amount: 16 }, { kind: "applyStatus", statusId: "regen", stacks: 2, duration: 3 }] },
  doc_cleanse: { id: "doc_cleanse", name: "치료", target: "ally", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "cleanse" }] },
  doc_ult: { id: "doc_ult", name: "백병원 강제 입원", target: "ally", cooldown: 5, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "invincible", stacks: 1, duration: 1 }] },

  // ══ 잡몹(깡패) ══
  thug_punch: { id: "thug_punch", name: "주먹질", target: "enemy", cooldown: 0, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 6 }] },
  thug_kick: { id: "thug_kick", name: "발길질", target: "enemy", cooldown: 1, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 5 }] },
  thug_club: { id: "thug_club", name: "각목 후려치기", target: "enemy", cooldown: 0, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 8 }] },
  thug_throw: { id: "thug_throw", name: "벽돌 던지기", target: "enemy", cooldown: 2, accuracy: 80, effects: [{ kind: "damage", amount: 6 }, { kind: "move", who: "target", deltaCol: 1 }] }, // 넉백(대상 뒤로, 6.4)

  // ══ 육성: 강화 티어 체인 (4.6) — 전용기 강화. 보상 "강화"로 nextTierId 교체. 보유 풀엔 직접 안 들어감 ══
  kim_punch2: { id: "kim_punch2", name: "종로의 주먹+", exclusiveTo: "kim", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 2, nextTierId: "kim_punch3", effects: [{ kind: "damage", amount: 18 }] },
  kim_punch3: { id: "kim_punch3", name: "종로의 주먹++", exclusiveTo: "kim", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 3, effects: [{ kind: "damage", amount: 22 }, { kind: "applyStatus", statusId: "bleed", stacks: 1, duration: 2 }] },
  sh_pistol2: { id: "sh_pistol2", name: "권총 속사", exclusiveTo: "shanghai", target: "enemy", cooldown: 0, accuracy: 90, tier: 2, nextTierId: "sh_pistol3", effects: [{ kind: "damage", amount: 13 }] },
  sh_pistol3: { id: "sh_pistol3", name: "권총 난사", exclusiveTo: "shanghai", target: "enemy", cooldown: 0, accuracy: 90, tier: 3, effects: [{ kind: "damage", amount: 16 }, { kind: "applyStatus", statusId: "paralyze", stacks: 1, duration: 1 }] },
  shin_axe2: { id: "shin_axe2", name: "도끼 강타", exclusiveTo: "shin", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 2, nextTierId: "shin_axe3", effects: [{ kind: "damage", amount: 15 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 3 }] },
  shin_axe3: { id: "shin_axe3", name: "도끼 분쇄", exclusiveTo: "shin", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 3, effects: [{ kind: "damage", amount: 18 }, { kind: "applyStatus", statusId: "bleed", stacks: 3, duration: 3 }] },
  cho_warn2: { id: "cho_warn2", name: "엄중 경고", exclusiveTo: "cho", target: "enemy", cooldown: 0, accuracy: 90, tier: 2, effects: [{ kind: "damage", amount: 6 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },

  // ══ 범용기 (4.6) — exclusiveTo 없음 = 여러 캐릭이 learnset에 가질 수 있는 공유 스킬. 중립 네이밍 ══
  u_guard: { id: "u_guard", name: "철벽 방어", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 10 }] },
  u_war_cry: { id: "u_war_cry", name: "전투 함성", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 3 }] },
  u_aimed_shot: { id: "u_aimed_shot", name: "조준 사격", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "damage", amount: 8 }] },
  u_snare: { id: "u_snare", name: "올가미", target: "enemy", cooldown: 3, accuracy: 85, effects: [{ kind: "damage", amount: 5 }, { kind: "applyStatus", statusId: "paralyze", stacks: 2, duration: 2 }] },
  u_first_aid: { id: "u_first_aid", name: "응급 처치", target: "ally", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "heal", amount: 12 }] },
  u_jab: { id: "u_jab", name: "잽", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 3 }] }, // leaf(무-passive) — castSkill 자동발동 대상용

  // ══ 순수 패시브 스킬 (active:false) — 보유 시 상시 효과, 전투 스킬창엔 안 뜸 ══
  u_toughness: { id: "u_toughness", name: "강인함", active: false, target: "self", cooldown: 0, accuracy: 0, effects: [], passives: [{ when: { on: "battleStart" }, then: [{ do: "shield", amount: 6, target: "self" }] }] },
};
