// ─────────────────────────────────────────────────────────────────────────
// AI 행동결정 정책 스키마 (디자이너 작성). 우선순위 룰 리스트.
// 엔진(core/ai)이 "턴이 왔을 때 합법 행동 중 무엇을 고를지"를 해석.
// 반응형 패시브(when/if/then, types/passives.ts)와 별개의 *능동* 결정 프리미티브.
// 결정론: rng 미사용(조건에 chance 없음). 동점은 합법행동 인덱스. (8.3)
// ─────────────────────────────────────────────────────────────────────────
import type { Comparator } from "./passives.ts";

/** 스킬 분류 선호 — 합법 행동의 스킬 effects에 해당 종류가 있으면 매칭. any=무관. */
export type SkillKindPref = "damage" | "heal" | "shield" | "applyStatus" | "cleanse" | "any";

/** 타겟 선호 — 같은 prefer 후보 중 누구를 고를지. (생략 시 prefer 기본 선호로 해석) */
export type TargetPref =
  | "lowestHpEnemy"
  | "highestHpEnemy"
  | "lowestHpAlly"
  | "frontmostEnemy" // 가장 앞열(col 작음) 적
  | "backmostEnemy" // 가장 뒷열(col 큼) 적
  | "self"
  | "anyEnemy"
  | "anyAlly";

/** 동점 보정/성향 가중치 키 — 점수에 가산(양수=선호). */
export type AiWeightKey =
  | "backlineTarget" // 대상이 뒷열일수록 (col 클수록)
  | "frontlineTarget" // 대상이 앞열일수록 (col 작을수록)
  | "lowHpTarget" // 대상 HP 낮을수록
  | "hitChance" // 명중% 높을수록
  | "critChance"; // 대상 치명 확률 높을수록(시전자 기준)

/** AI 조건 (if). AND 결합, 비면 항상 참. 행동결정 시점의 보드 상태 평가. (self=룰 소유 행동자) */
export type AiCondition =
  | { c: "selfHpPct"; cmp: Comparator; v: number }
  | { c: "allyHpPctBelow"; v: number } // 자기편(소유자 진영) 중 하나라도 HP% < v
  | { c: "enemyHpPctBelow"; v: number } // 상대편 중 하나라도 HP% < v
  | { c: "selfHasStatus"; statusId: string }
  | { c: "selfMissingStatus"; statusId: string }
  | { c: "enemyHasStatus"; statusId: string } // 상대편 중 하나라도 보유
  | { c: "round"; cmp: Comparator; v: number }
  | { c: "outnumbered" } // 소유자 진영 살아있는 수 < 상대
  | { c: "allyCount"; cmp: Comparator; v: number }; // 소유자 진영 살아있는 수

/** 한 우선순위 룰: if 모두 참이면 prefer 종류의 합법 행동을 target/weight 선호로 고른다. */
export interface AiRule {
  if?: AiCondition[];
  prefer?: SkillKindPref; // 생략 = any
  target?: TargetPref; // 생략 = prefer 기본
  weight?: Partial<Record<AiWeightKey, number>>;
}

/** AI 프로파일 = 우선순위 룰 배열. 위→아래, 첫 적용가능(조건 참 AND 합법행동 존재) 룰이 행동 결정. */
export interface AiProfile {
  id: string;
  name?: string;
  desc?: string;
  rules: AiRule[];
}
