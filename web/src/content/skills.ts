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

  // ══ 야인시대 런1(유년·성장) — 데이터-온리. 설계: docs/Yainsidae/gamedata/run01-youth.md ══
  // 소년두한(kim_young) — 맨주먹 깡다구 브루저. blind는 근사로 weaken 사용.
  young_punch: { id: "young_punch", name: "종로의 주먹", exclusiveTo: "kim_young", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 1, nextTierId: "young_punch2", effects: [{ kind: "damage", amount: 10 }] },
  young_punch2: { id: "young_punch2", name: "종로의 주먹+", exclusiveTo: "kim_young", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 2, effects: [{ kind: "damage", amount: 14 }] },
  young_kick: { id: "young_kick", name: "발차기 역전", exclusiveTo: "kim_young", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 14 }], passives: [{ when: { on: "onHit", as: "attacker", crit: true }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 2, target: "self" }] }] }, // 크리 시 투지(역전 모티프)
  // 전직 보상 스킬(무도가 1차 해금) — exclusiveTo + classReq 1. learnset 밖, 전직 후 보상 풀 편입(4.7).
  young_dash_kick: { id: "young_dash_kick", name: "날라차기", exclusiveTo: "kim_young", classReq: 1, target: "enemy", cooldown: 3, accuracy: 90, reach: 1, effects: [{ kind: "move", who: "self", deltaCol: -3 }, { kind: "damage", amount: 13 }] },
  young_dantian: { id: "young_dantian", name: "단전 일격", exclusiveTo: "kim_young", classReq: 1, target: "enemy", cooldown: 5, accuracy: 90, reach: 1, effects: [{ kind: "applyStatusSelf", statusId: "edge", stacks: 1, duration: 1 }, { kind: "damage", amount: 20 }] }, // 차징(예리 선행)→강타

  // 개코(gaekko) — 후열 교란/디버퍼
  gaekko_dung: { id: "gaekko_dung", name: "오물 투척", exclusiveTo: "gaekko", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "damage", amount: 2 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] }, // blind 근사=weaken
  gaekko_taryeong: { id: "gaekko_taryeong", name: "장타령 기만", exclusiveTo: "gaekko", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatusSelf", statusId: "taunt", stacks: 1, duration: 2 }] }, // 어그로 분산=자기 도발

  // 정진영 소년(jin) — 중열 보조딜(원작 좌익 정진영과 별개 id)
  jin_stab: { id: "jin_stab", name: "침착한 일격", exclusiveTo: "jin", target: "enemy", cooldown: 0, accuracy: 95, reach: 1, effects: [{ kind: "damage", amount: 8 }] },
  jin_aid: { id: "jin_aid", name: "응급 보조", exclusiveTo: "jin", target: "ally", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "heal", amount: 10 }, { kind: "applyStatus", statusId: "regen", stacks: 1, duration: 2 }] },

  // 왕초(wangcho) — 1층 보스(거지촌 두목)
  wangcho_stone: { id: "wangcho_stone", name: "돌 던지기", exclusiveTo: "wangcho", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "damage", amount: 9 }] },
  wangcho_branch: { id: "wangcho_branch", name: "나뭇가지 후리기", exclusiveTo: "wangcho", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 2 }] },
  wangcho_rule: { id: "wangcho_rule", name: "군림", exclusiveTo: "wangcho", target: "self", cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatusSelf", statusId: "might", stacks: 1, duration: 3 }] },

  // 일본 학생(jp_student) — 떼거리 엘리트. 집단 구타=배틀시작 자버프(인원수↑ 위협, summon 미사용)
  jp_gang_beat: { id: "jp_gang_beat", name: "집단 구타", exclusiveTo: "jp_student", target: "enemy", cooldown: 0, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 5 }], passives: [{ when: { on: "battleStart" }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "self" }] }] },

  // 미와(miwa) — 고등계, 추격/고문(런1은 엘리트·텍스트)
  miwa_torture: { id: "miwa_torture", name: "고문", exclusiveTo: "miwa", target: "enemy", cooldown: 3, accuracy: 90, effects: [{ kind: "damage", amount: 12 }, { kind: "applyStatus", statusId: "paralyze", stacks: 2, duration: 2 }] },
  miwa_pursuit: { id: "miwa_pursuit", name: "추격 명령", exclusiveTo: "miwa", target: "enemy", area: { kind: "all" }, cooldown: 4, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },

  // 형사(detective) — 미와 부하
  det_cuff: { id: "det_cuff", name: "수갑", exclusiveTo: "detective", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 4 }, { kind: "applyStatus", statusId: "paralyze", stacks: 1, duration: 2 }] },
  det_baton: { id: "det_baton", name: "곤봉", exclusiveTo: "detective", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 7 }] },

  // 가네야마(kaneyama) — 개성 악덕 지주(겁쟁이). 하인 호출=노드 로스터 사전배치로 근사(summon 미사용)
  kane_greed: { id: "kane_greed", name: "탐욕", exclusiveTo: "kaneyama", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 12 }] },
  kane_slap: { id: "kane_slap", name: "손찌검", exclusiveTo: "kaneyama", target: "enemy", cooldown: 0, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 5 }] },

  // ══ 전직 보상 스킬 (4.7) — 1차 전직 후 보상 풀 편입(classReq 1, exclusiveTo kim). masteryReq=숙련도 게이트. ══
  // learnset/보유 풀엔 없음(보상으로만 획득). 두 분기(두목/협객) 모두에게 출현 가능 — 배제 없음(운이 정함). 엔진 게이트=전직 슬라이스(S4, 현재 휴면).
  // 박치기: 큰 단타 + 약한 공포. 단독 딜(협객 "맹타") 의도 — 단, 두목이 뽑아도 됨.
  kim_headbutt: { id: "kim_headbutt", name: "박치기", exclusiveTo: "kim", masteryReq: 1, classReq: 1, target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 20 }, { kind: "applyStatus", statusId: "fear", stacks: 1, duration: 1 }] },
  // 종로 호령: 아군 전체 강화(공위증+쉴드). 팀(두목 "의리") 의도 — 단, 협객이 뽑아도 됨.
  kim_command: { id: "kim_command", name: "종로 호령", exclusiveTo: "kim", masteryReq: 1, classReq: 1, target: "ally", area: { kind: "all" }, cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }, { kind: "shield", amount: 8 }] },

  // ══ 야인시대 런2(종로 패권) — 스킬 ══ (gamedata/run02)
  // 두한(청년) — 맨손 격투 에이스
  duhan_kick: { id: "duhan_kick", name: "발차기 콤보", exclusiveTo: "duhan", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, tier: 1, effects: [{ kind: "damage", amount: 11 }] },
  duhan_headbutt: { id: "duhan_headbutt", name: "박치기", exclusiveTo: "duhan", target: "enemy", cooldown: 2, accuracy: 95, reach: 1, effects: [{ kind: "damage", amount: 16 }], passives: [{ when: { on: "onHit", as: "attacker", crit: true }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 2, target: "self" }] }] }, // 카운터 — 크리 시 투지
  // 개코(왕초) — 거지패 소환 + 그래플
  gaekko_summon: { id: "gaekko_summon", name: "거지패 동원", exclusiveTo: "gaekko_b", target: "self", cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "summon", charId: "beggar_ally", count: 2, duration: 3 }] },
  gaekko_grapple: { id: "gaekko_grapple", name: "고간 잡기", exclusiveTo: "gaekko_b", target: "enemy", cooldown: 3, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "paralyze", stacks: 1, duration: 1 }] },
  // 정진영 — 헌신/방패
  jin_guard: { id: "jin_guard", name: "헌신 방패", exclusiveTo: "jin_b", target: "self", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatusSelf", statusId: "taunt", stacks: 1, duration: 2 }, { kind: "shield", amount: 10 }] },
  jin_aid2: { id: "jin_aid2", name: "응급 처치", exclusiveTo: "jin_b", target: "ally", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "heal", amount: 14 }] },
  // 김영태 — 버프 참모
  kimyt_buff: { id: "kimyt_buff", name: "책사의 묘책", exclusiveTo: "kimyt", target: "ally", area: { kind: "all" }, cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },
  kimyt_expose: { id: "kimyt_expose", name: "약점 노출", exclusiveTo: "kimyt", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },
  // 문영철 — 권투 딜러(thorns 카운터)
  moon_combo: { id: "moon_combo", name: "연타", exclusiveTo: "moon", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 9 }] },
  moon_jab: { id: "moon_jab", name: "정타", exclusiveTo: "moon", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 14 }] },
  // 김무옥 — 탱커
  mook_taunt: { id: "mook_taunt", name: "도발", exclusiveTo: "mook", target: "self", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatusSelf", statusId: "taunt", stacks: 1, duration: 2 }, { kind: "shield", amount: 8 }] },
  mook_guard: { id: "mook_guard", name: "버티기", exclusiveTo: "mook", target: "self", cooldown: 1, accuracy: 0, alwaysHit: true, effects: [{ kind: "shield", amount: 12 }] },
  // 거지패(소환 토큰)
  beggar_swing: { id: "beggar_swing", name: "막대 휘두르기", exclusiveTo: "beggar_ally", target: "enemy", cooldown: 0, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 4 }] },
  // 적
  kitano_slash: { id: "kitano_slash", name: "일본도 베기", exclusiveTo: "kitano", target: "enemy", cooldown: 1, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 14 }], passives: [{ when: { on: "battleStart" }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "self" }] }] }, // 무기 보너스
  shin_choke: { id: "shin_choke", name: "목 조르기", exclusiveTo: "shinmajeok", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 8 }, { kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 }] },
  guma_headbutt: { id: "guma_headbutt", name: "박치기", exclusiveTo: "gumajeok", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 20 }] },
  guma_axe: { id: "guma_axe", name: "손도끼", exclusiveTo: "gumajeok", target: "enemy", cooldown: 1, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 12 }], passives: [{ when: { on: "battleStart" }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "self" }] }] },
  jakdu_chop: { id: "jakdu_chop", name: "작두질", exclusiveTo: "jakdu", target: "enemy", cooldown: 1, accuracy: 88, reach: 1, effects: [{ kind: "damage", amount: 13 }] },
  wangbal_gun: { id: "wangbal_gun", name: "권총", exclusiveTo: "wangbal", target: "enemy", cooldown: 3, accuracy: 95, effects: [{ kind: "damage", amount: 28 }] }, // 단일 즉사급
  tanaka_opium: { id: "tanaka_opium", name: "아편 살포", exclusiveTo: "tanaka", target: "enemy", cooldown: 2, accuracy: 90, effects: [{ kind: "damage", amount: 4 }, { kind: "applyStatus", statusId: "poison", stacks: 2, duration: 3 }] },
  tanaka_jab: { id: "tanaka_jab", name: "주먹", exclusiveTo: "tanaka", target: "enemy", cooldown: 0, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 8 }] },

  // ══ 야인시대 런3(일제말 항일) — 스킬 ══ (gamedata/run03)
  // 두한 전직 보상기(협객 1차 — 무산대중의 영웅). 날아차기=피니셔(기절), 풍차=광역.
  duhan_flykick: { id: "duhan_flykick", name: "날아 차기", exclusiveTo: "duhan", classReq: 1, target: "enemy", cooldown: 3, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 18 }, { kind: "applyStatus", statusId: "freeze", stacks: 1, duration: 1 }] },
  duhan_windmill: { id: "duhan_windmill", name: "풍차 돌려차기", exclusiveTo: "duhan", classReq: 1, target: "enemy", area: { kind: "cross" }, cooldown: 3, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 11 }] },
  // 번개 — 속공
  beolgae_dash: { id: "beolgae_dash", name: "번개 연타", exclusiveTo: "beolgae", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 7 }] },
  // 마루오까 — 유도(엎어치기·조르기)
  maruoka_throw: { id: "maruoka_throw", name: "엎어치기", exclusiveTo: "maruoka", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "move", who: "target", deltaCol: 2 }, { kind: "damage", amount: 10 }] },
  maruoka_choke: { id: "maruoka_choke", name: "조르기", exclusiveTo: "maruoka", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 6 }, { kind: "applyStatus", statusId: "paralyze", stacks: 1, duration: 1 }] },
  // 가미소리 — 진검 암수(출혈)
  kamisori_ambush: { id: "kamisori_ambush", name: "암수", exclusiveTo: "kamisori", target: "enemy", cooldown: 1, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 10 }, { kind: "applyStatus", statusId: "bleed", stacks: 2, duration: 2 }] },
  // 헌병 — 고문(공포·정신 잠식)
  gendarme_torture: { id: "gendarme_torture", name: "고문", exclusiveTo: "gendarme", target: "enemy", cooldown: 1, accuracy: 95, effects: [{ kind: "applyStatus", statusId: "fear", stacks: 1, duration: 2 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },
  // 하야시 — 혼마찌 오야붕(지휘·증원은 노드 적 구성으로 근사)
  hayashi_order: { id: "hayashi_order", name: "지휘", exclusiveTo: "hayashi", target: "ally", area: { kind: "all" }, cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },
  hayashi_jab: { id: "hayashi_jab", name: "지팡이", exclusiveTo: "hayashi", target: "enemy", cooldown: 1, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 9 }] },

  // ══ 야인시대 런4(해방·좌우 대결) — 스킬 ══ (gamedata/run04)
  duhan_dynamite: { id: "duhan_dynamite", name: "다이너마이트 기습", exclusiveTo: "duhan", classReq: 1, target: "enemy", area: { kind: "square" }, cooldown: 4, accuracy: 85, effects: [{ kind: "damage", amount: 14 }] }, // 거점 광역(전향 후 해금)
  sirasoni_rampage: { id: "sirasoni_rampage", name: "광폭난타", exclusiveTo: "sirasoni", target: "enemy", cooldown: 1, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 13 }] },
  sirasoni_headbutt: { id: "sirasoni_headbutt", name: "들이받기", exclusiveTo: "sirasoni", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 17 }] },
  geumgang_smash: { id: "geumgang_smash", name: "곰의 강타", exclusiveTo: "geumgang", target: "enemy", cooldown: 1, accuracy: 85, reach: 1, effects: [{ kind: "damage", amount: 22 }] },
  geumgang_push: { id: "geumgang_push", name: "밀어 추락", exclusiveTo: "geumgang", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "move", who: "target", deltaCol: 2 }, { kind: "damage", amount: 9 }] },
  ihwaryong_strike: { id: "ihwaryong_strike", name: "명동 일격", exclusiveTo: "ihwaryong", target: "enemy", cooldown: 1, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 13 }] },
  kimcheonho_ambush: { id: "kimcheonho_ambush", name: "차량 폭탄", exclusiveTo: "kimcheonho", target: "enemy", cooldown: 2, accuracy: 80, effects: [{ kind: "damage", amount: 12 }, { kind: "applyStatus", statusId: "bleed", stacks: 1, duration: 2 }] },
  jeong_command: { id: "jeong_command", name: "전위대 지휘", exclusiveTo: "jeongjinyoung", target: "ally", area: { kind: "all" }, cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },
  jeong_pistol: { id: "jeong_pistol", name: "권총", exclusiveTo: "jeongjinyoung", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "damage", amount: 13 }] },

  // ══ 야인시대 런5(사형·전쟁기) — 스킬 ══ (gamedata/run05)
  duhan_command: { id: "duhan_command", name: "지휘", exclusiveTo: "duhan", classReq: 1, target: "ally", area: { kind: "all" }, cooldown: 4, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }, { kind: "shield", amount: 6 }] }, // 학도병 사기 진작
  michael_box: { id: "michael_box", name: "정통 복싱", exclusiveTo: "michael", target: "enemy", cooldown: 1, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 14 }], passives: [{ when: { on: "battleStart" }, then: [{ do: "shield", amount: 20, target: "self" }] }] }, // 챔피언의 가드
  nodeoksul_assassin: { id: "nodeoksul_assassin", name: "암살 의뢰", exclusiveTo: "nodeoksul", target: "enemy", cooldown: 1, accuracy: 95, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }, { kind: "damage", amount: 5 }] },
  gosaimachi_pistol: { id: "gosaimachi_pistol", name: "부두 권총", exclusiveTo: "gosaimachi", target: "enemy", cooldown: 2, accuracy: 95, effects: [{ kind: "damage", amount: 26 }] }, // 권총 글래스캐논(즉사급)
  ijeongjae_order: { id: "ijeongjae_order", name: "회장의 규율", exclusiveTo: "ijeongjae", target: "ally", area: { kind: "all" }, cooldown: 3, accuracy: 0, alwaysHit: true, effects: [{ kind: "applyStatus", statusId: "might", stacks: 1, duration: 2 }] },
  ijeongjae_pistol: { id: "ijeongjae_pistol", name: "권총", exclusiveTo: "ijeongjae", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "damage", amount: 13 }] },
  iseokjae_shot: { id: "iseokjae_shot", name: "8발 전탄 명중", exclusiveTo: "iseokjae", target: "enemy", cooldown: 2, accuracy: 0, alwaysHit: true, effects: [{ kind: "damage", amount: 18 }] }, // 명사수(반드시 명중)

  // ══ 야인시대 런6(동대문 패권·정치) — 스킬 ══ (gamedata/run06)
  yujikwang_duel: { id: "yujikwang_duel", name: "결투", exclusiveTo: "yujikwang", target: "enemy", cooldown: 0, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 12 }] },
  yujikwang_challenge: { id: "yujikwang_challenge", name: "도전장", exclusiveTo: "yujikwang", target: "enemy", cooldown: 2, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 9 }, { kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }] },
  aomasu_strike: { id: "aomasu_strike", name: "신세대 검", exclusiveTo: "aomasu", target: "enemy", cooldown: 1, accuracy: 90, reach: 1, effects: [{ kind: "damage", amount: 13 }], passives: [{ when: { on: "onHit", as: "attacker" }, then: [{ do: "applyStatus", statusId: "edge", stacks: 1, duration: 2, target: "self" }] }] },
  doksa_powder: { id: "doksa_powder", name: "분말 가루", exclusiveTo: "doksa", target: "enemy", cooldown: 1, accuracy: 95, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 2, duration: 2 }, { kind: "applyStatus", statusId: "bleed", stacks: 1, duration: 2 }] }, // blind 근사=weaken(명중 무력화)
  imhwasu_trap: { id: "imhwasu_trap", name: "함정 유인", exclusiveTo: "imhwasu", target: "enemy", cooldown: 1, accuracy: 90, effects: [{ kind: "applyStatus", statusId: "weaken", stacks: 1, duration: 2 }, { kind: "damage", amount: 5 }] },
};
