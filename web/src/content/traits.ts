// 특성(trait) 데이터 — 캐릭터를 정의하는 상시 패시브 룰 묶음 (디자이너 작성).
// 캐릭터가 characters.ts의 traitIds로 참조. 룰 = when/if/then (core/types/passives.ts 스키마).
// 작성법·카탈로그: src/content/README.md "특성/패시브" 절.
import type { TraitDef } from "../contract/types.ts";

export const TRAITS: Record<string, TraitDef> = {
  // 전투 시작 시 최전열이면 명중 +10 (battleStart 1회 → statMod 안전).
  frontliner: {
    id: "frontliner", name: "선봉장", icon: "🛡", desc: "전투 시작 시 최전열에 있으면 명중 +10.",
    rules: [{ when: { on: "battleStart" }, if: [{ c: "isFrontline", who: "self" }], then: [{ do: "statMod", stat: "accuracy", delta: 10, target: "self" }] }],
  },
  // 적 처치 시 자가 회복 8.
  bloodlust: {
    id: "bloodlust", name: "피의 갈망", icon: "🩸", desc: "적을 쓰러뜨리면 체력 8 회복.",
    rules: [{ when: { on: "kill" }, then: [{ do: "heal", amount: 8, target: "self" }] }],
  },
  // 아군이 쓰러지면 공위증 1(전투 내내).
  vindictive: {
    id: "vindictive", name: "앙심", icon: "😤", desc: "아군이 쓰러질 때마다 공위증 1을 얻는다(전투 동안).",
    rules: [{ when: { on: "death", who: "ally" }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "self" }] }],
  },
  // 피격 시 50% 확률로 공격자에게 가시 피해(턴당 2회 한도 → 무한반사 방지).
  thorns: {
    id: "thorns", name: "가시", icon: "🌵", desc: "피격 시 50% 확률로 공격자에게 3 피해(턴당 2회).",
    rules: [{ when: { on: "damaged" }, if: [{ c: "chance", pct: 50 }], then: [{ do: "damage", amount: 3, target: "subject" }], maxPerTurn: 2 }],
  },
  // ── 모험(run) 스코프 특성 ──
  // 노드를 클리어할 때마다 골드 +3 (전투 밖 사건 반응).
  miser: {
    id: "miser", name: "수전노", icon: "💰", desc: "노드를 클리어할 때마다 골드 +3.",
    rules: [{ when: { on: "nodeClear" }, then: [{ do: "goldDelta", amount: 3 }] }],
  },
  // 보스 노드 진입 시 다음 전투에 파티 전원 공위증 1 계승.
  warspirit: {
    id: "warspirit", name: "전의", icon: "⚔", desc: "보스 노드 진입 시 다음 전투에 파티 전원 공위증.",
    rules: [{ when: { on: "nodeEnter", nodeType: "boss" }, then: [{ do: "grantRunStatus", statusId: "might", stacks: 1, duration: 99, target: "allAllies" }] }],
  },
  // ── 적 전용 특성(좌익) — 같은 엔진. 신규 어휘 시연 ──
  // 가한 피해의 30%를 흡혈.
  bloodfiend: {
    id: "bloodfiend", name: "흡혈귀", icon: "🦇", desc: "가한 피해의 30%만큼 체력 회복.",
    rules: [{ when: { on: "dealtDamage" }, then: [{ do: "healByDamage", pct: 30, target: "self" }] }],
  },
  // 전투 시작 시 아군 진영(=자기편) 전체에 공위증 1.
  rally: {
    id: "rally", name: "규합", icon: "📣", desc: "전투 시작 시 아군 전체에 공위증.",
    rules: [{ when: { on: "battleStart" }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "allAllies" }] }],
  },
  // 피격 시 받은 피해의 50%를 공격자에게 반사(턴당 2회).
  barbed: {
    id: "barbed", name: "가시갑주", icon: "🪖", desc: "피격 시 받은 피해의 50%를 공격자에게 반사(턴당 2회).",
    rules: [{ when: { on: "damaged" }, then: [{ do: "reflectByDamage", pct: 50, target: "subject" }], maxPerTurn: 2 }],
  },
  // 매 턴 자동으로 잽(액티브 스킬 u_jab)을 시전 — castSkill 시연. 명중·사정권은 u_jab 정의대로.
  reflexes: {
    id: "reflexes", name: "반사신경", icon: "🥊", desc: "매 턴 자동으로 잽(근접 3·명중 90)을 날린다.",
    rules: [{ when: { on: "turnStart", who: "self" }, then: [{ do: "castSkill", skillId: "u_jab" }], maxPerTurn: 1 }],
  },
  // ── 야인시대 런1(유년·성장) 특성 — 데이터-온리. 설계: docs/Yainsidae/gamedata/run01-youth.md ──
  // 불굴/근성 — 위기에 한 번 다시 일어선다(원작 왕초전 반복 기립). 1회 재기를 "치사 직전 1회 회복"으로 근사(전투당 1회).
  indomitable: {
    id: "indomitable", name: "불굴", icon: "🔥", desc: "위기(체력 30% 이하)에 피격되면 전투당 1회 체력 12 회복하며 다시 일어선다.",
    rules: [{ when: { on: "damaged" }, if: [{ c: "hpPct", who: "self", cmp: "lte", v: 30 }], then: [{ do: "heal", amount: 12, target: "self" }], maxPerBattle: 1 }],
  },
  // 기 집중 — 무도가 전직(유태권 입문) 부여 패시브. 매 턴 예리가 쌓여 일격이 날카로워짐(단전 일격 시너지).
  qi_focus: {
    id: "qi_focus", name: "기 집중", icon: "🧘", desc: "매 턴 시작 시 예리 1을 얻는다(턴당 1회).",
    rules: [{ when: { on: "turnStart", who: "self" }, then: [{ do: "applyStatus", statusId: "edge", stacks: 1, duration: 2, target: "self" }], maxPerTurn: 1 }],
  },

  // ── 전직(전직) 직업 패시브 (4.7) — 전직 시 부여(런 한정). 직업의 기계적 정체성. (엔진 적용=전직 슬라이스 S2) ──
  // 우미관 두목: 전투 시작 시 아군 전체 공위증(두목의 통솔). 팀/서포트 빌드와 시너지.
  kim_oyabun_will: {
    id: "kim_oyabun_will", name: "두목의 의리", icon: "🎖", desc: "전투 시작 시 아군 전체에 공위증.",
    rules: [{ when: { on: "battleStart" }, then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "allAllies" }] }],
  },
  // 협객: 적 처치 시 자신에게 예리(맹타). 단독 캐리·치명 빌드와 시너지.
  kim_relentless: {
    id: "kim_relentless", name: "맹타", icon: "🥊", desc: "적을 쓰러뜨리면 예리 1을 얻는다.",
    rules: [{ when: { on: "kill" }, then: [{ do: "applyStatus", statusId: "edge", stacks: 1, duration: 3, target: "self" }] }],
  },

  // ── 런2(종로 패권) 신규 특성 ──
  // 환영 부활(각성) — 김좌진 환영. 치사 직전 1회 대회복 + 투지 2(구마적전 2페이즈 역전 손맛). 민심 비례 강화는 노드 resourceMods로 별도.
  phantom_revival: {
    id: "phantom_revival", name: "환영 부활", icon: "👻", desc: "위기(체력 25% 이하)에 피격되면 전투당 1회 체력 20 회복 + 투지 2를 얻는다.",
    rules: [{ when: { on: "damaged" }, if: [{ c: "hpPct", who: "self", cmp: "lte", v: 25 }], then: [{ do: "heal", amount: 20, target: "self" }, { do: "applyStatus", statusId: "might", stacks: 2, duration: 99, target: "self" }], maxPerBattle: 1 }],
  },
  // 헌신 — 정진영. 전투 시작 시 도발(자신이 적 화력을 끌어 두한을 보호).
  devotion: {
    id: "devotion", name: "헌신", icon: "🛡", desc: "전투 시작 시 도발 상태가 되어 적의 화력을 끌어들인다.",
    rules: [{ when: { on: "battleStart" }, then: [{ do: "applyStatus", statusId: "taunt", stacks: 1, duration: 99, target: "self" }] }],
  },

  // ── 런3(일제말 항일) 신규 특성 ──
  // 1대다 각성 — 두한. 머릿수 열세일수록 강해진다(무산대중의 영웅).
  outnumbered_awakening: {
    id: "outnumbered_awakening", name: "1대다 각성", icon: "🔥", desc: "내 턴 시작 시 아군이 적보다 적으면 투지·예리를 얻는다(턴당 1회).",
    rules: [{ when: { on: "turnStart", who: "self" }, if: [{ c: "outnumbered" }], then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 1, target: "self" }, { do: "applyStatus", statusId: "edge", stacks: 1, duration: 1, target: "self" }], maxPerTurn: 1 }],
  },
  // 고문 항거 — 김영태. 정신 공격(공포)을 떨쳐낸다(의지).
  torture_resist: {
    id: "torture_resist", name: "고문 항거", icon: "✊", desc: "내 턴 시작 시 공포 상태면 떨쳐낸다(정신 공격 항거).",
    rules: [{ when: { on: "turnStart", who: "self" }, if: [{ c: "hasStatus", who: "self", statusId: "fear" }], then: [{ do: "cleanse", target: "self" }], maxPerTurn: 1 }],
  },

  // ── 런4(좌우 대결) 신규 특성 ──
  // 만취 광폭 — 시라소니. 취할(약화)수록 더 사나워진다.
  drunken_fury: {
    id: "drunken_fury", name: "만취 광폭", icon: "🍶", desc: "내 턴 시작 시 약화 상태면 투지를 얻는다(약할수록 사나워짐).",
    rules: [{ when: { on: "turnStart", who: "self" }, if: [{ c: "hasStatus", who: "self", statusId: "weaken" }], then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 1, target: "self" }], maxPerTurn: 1 }],
  },

  // ── 런7(자유당 몰락) 신규 특성 ──
  // 배수진(깡) — 오상사·명동. 머릿수 열세일수록 투지+쉴드(소수정예).
  last_stand: {
    id: "last_stand", name: "배수진", icon: "🩸", desc: "전투 시작 시 아군이 적보다 적으면 투지와 쉴드를 얻는다.",
    rules: [{ when: { on: "battleStart" }, if: [{ c: "outnumbered" }], then: [{ do: "applyStatus", statusId: "might", stacks: 1, duration: 99, target: "self" }, { do: "shield", amount: 8, target: "self" }] }],
  },
};
