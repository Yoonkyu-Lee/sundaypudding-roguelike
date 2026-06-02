// 특성(trait) 데이터 — 캐릭터를 정의하는 상시 패시브 룰 묶음 (디자이너 작성).
// 캐릭터가 characters.ts의 traitIds로 참조. 룰 = when/if/then (core/types/passives.ts 스키마).
// 작성법·카탈로그: src/data/README.md "특성/패시브" 절.
import type { TraitDef } from "../core/types.ts";

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
};
