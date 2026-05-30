// ─────────────────────────────────────────────────────────────────────────
// 타입 스키마 = 명세서 (docs/GAME-DESIGN.md 8.6)
// 이 파일의 타입들이 곧 게임 시스템의 기계 가독 명세다.
// ─────────────────────────────────────────────────────────────────────────

import type { Rng } from "./rng.ts";

export type Side = "ally" | "enemy";

/** 그리드 좌표 (행, 열). 열 0 = 최전방. (2.1) */
export interface Pos {
  row: number;
  col: number;
}

// ── 상태이상 (3장) ────────────────────────────────────────────────────────

export type StatusDefId = string;

/** 상태이상 발동 시점 (2.11 끼어들기와의 상호작용 포함) */
export type StatusTrigger =
  | "turnStart" // 중독: 정규 턴 시작 시
  | "turnEnd" // 화상: 정규 턴 종료 시
  | "onAction"; // 출혈: 정규 + 끼어들기 모든 행동 시

/**
 * 상태이상 "정의" — 표준화된 거동(데이터 주도). 3.9 프리미티브의 데이터 표현.
 * 개별 효과는 이 정의 + 인스턴스(스택/지속)의 조합.
 */
export interface StatusDef {
  id: StatusDefId;
  name: string;
  icon: string;
  /** 지속 피해(DoT): 발동 시점 + 스택당 피해 */
  dot?: { trigger: StatusTrigger; dmgPerStack: number };
  /** 행동 봉쇄(빙결): 정규 턴 행동 불가 */
  actionDenial?: boolean;
  /** 주는 데미지 곱연산 배율(동상 0.5). 표준 전역효과만 곱연산 허용(3.7) */
  damageDealtMult?: number;
}

/** 상태이상 인스턴스(원장 1건) — 출처/만료 보존 (3.1) */
export interface StatusInstance {
  defId: StatusDefId;
  stacks: number;
  duration: number; // 잔여 정규 턴 수
  sourceUid: string; // 누가 걸었나
}

// ── 스킬 (2.3~2.10) ────────────────────────────────────────────────────────

/** 스킬 효과 프리미티브 (3.9). 한 스킬은 effects[]의 조합. */
export type SkillEffect =
  | { kind: "damage"; amount: number } // 스킬 상수 데미지 (2.5)
  | { kind: "applyStatus"; statusId: StatusDefId; stacks: number; duration: number }
  | { kind: "shield"; amount: number } // 쉴드(덤 HP) 부여 (2.9)
  | { kind: "heal"; amount: number }
  | { kind: "move"; who: "target" | "self"; deltaCol: number } // 동적 재배치 (6.4)
  | { kind: "interruptSelf" }; // 끼어들기 1회 부여 (2.11)

export type SkillTarget = "enemy" | "ally" | "self";

// ── 포메이션 (6장) ─────────────────────────────────────────────────────────

/** 열 보너스 종류. 합연산(3.7 준수). */
export type FormationBonusKind = "attackPower" | "defensePower";

/** 한 열이 제공하는 보너스 "총량"(그 열의 유닛들에게 분배 = 총량보존, 6.1) */
export type ColumnBonus = Partial<Record<FormationBonusKind, number>>;

/** 포메이션 배치 = 열별 보너스 총량. 인덱스 = 열(0~3). */
export interface FormationLayout {
  id: string;
  columns: ColumnBonus[];
}

export interface Skill {
  id: string;
  name: string;
  target: SkillTarget;
  /** 쿨타임(그 유닛의 턴 수). 0 = 매 턴 사용 가능 (2.10) */
  cooldown: number;
  /** 스킬 내장 명중률 (2.7). 최종 명중 = 공격자 명중률 + 이 값 − 타겟 DEX */
  accuracy: number;
  /** 필중: 명중 공식 무시 (2.7) */
  alwaysHit?: boolean;
  /** 사용 가능 칸 마스크 (자기 그리드). 비어있으면 어디서나 (2.4) */
  usableFrom?: Pos[];
  /** 타겟 가능 칸 마스크 (대상 그리드). 비어있으면 점유된 아무 칸 (2.4) */
  targetCells?: Pos[];
  effects: SkillEffect[];
}

// ── 캐릭터(본체 템플릿) & 유닛(전투 인스턴스) (4장) ─────────────────────────

/** 캐릭터 = 포켓몬式 고유 디자인. 스탯은 보정 가능한 기본값(0.2) */
export interface Character {
  id: string;
  name: string;
  hp: number;
  spdMin: number; // SPD 범위 (2.2)
  spdMax: number;
  dex: number; // 회피 (2.6)
  accuracy: number; // 기본 0 (2.7)
  critPct: number; // 기본 10 (2.6)
  critMult: number; // 기본 1.5 (2.6)
  skillIds: string[]; // 보유 풀. 슬라이스에선 앞 4개를 활성으로 사용
}

/** 전투 중 유닛 인스턴스 */
export interface Unit {
  uid: string;
  side: Side;
  charId: string;
  name: string;
  pos: Pos;
  hpMax: number;
  hp: number;
  shield: number;
  spdMin: number;
  spdMax: number;
  dex: number;
  accuracy: number;
  critPct: number;
  critMult: number;
  activeSkillIds: string[]; // ≤4 (2.3)
  cooldowns: Record<string, number>; // skillId → 잔여 쿨타임
  statuses: StatusInstance[]; // 상태이상 원장 (3.1)
  alive: boolean;
}

// ── 턴 서열 & 행동 (2.2, 2.11) ─────────────────────────────────────────────

export type TurnKind = "normal" | "interrupt";

/** 행동 서열 1칸 */
export interface QueueEntry {
  uid: string;
  kind: TurnKind; // interrupt = 끼어들기(차감 무시) (2.11)
  spd: number; // 이번 라운드 굴린 SPD (normal만 의미)
}

export type Action =
  | { type: "skill"; skillId: string; targetUid?: string }
  | { type: "skip" }; // 쓸 기술 없음 → 효과 없는 스킵 (2.10)

export type Phase = "inProgress" | "allyWin" | "enemyWin";

// ── 이벤트 로그 (8.3, 8.5: 애니메이션 구동원) ──────────────────────────────

export type GameEvent =
  | { t: "roundStart"; round: number; order: QueueEntry[] }
  | { t: "turnStart"; uid: string; kind: TurnKind }
  | { t: "skillUsed"; uid: string; skillId: string; targetUid?: string }
  | { t: "miss"; uid: string; targetUid: string; chance: number }
  | { t: "hit"; uid: string; targetUid: string; chance: number; crit: boolean }
  | { t: "damage"; targetUid: string; base: number; final: number; toShield: number; toHp: number }
  | { t: "heal"; targetUid: string; amount: number }
  | { t: "shieldGain"; targetUid: string; amount: number }
  | { t: "statusApplied"; targetUid: string; statusId: string; stacks: number; duration: number }
  | { t: "statusTick"; targetUid: string; statusId: string; dmg: number }
  | { t: "move"; uid: string; from: Pos; to: Pos }
  | { t: "interrupt"; uid: string } // 끼어들기 삽입
  | { t: "skip"; uid: string; reason: "noUsableSkill" | "frozen" | "chosen" }
  | { t: "death"; uid: string }
  | { t: "battleEnd"; phase: Phase };

// ── 게임 상태 ───────────────────────────────────────────────────────────────

export interface GameState {
  rng: Rng;
  round: number;
  units: Unit[];
  queue: QueueEntry[]; // 이번 라운드 남은 서열
  current: QueueEntry | null; // 지금 행동할 차례
  phase: Phase;
  log: GameEvent[];
  allyFormation: FormationLayout | null; // 아군 열보너스 (6.3: 일반전투=표준)
  enemyFormation: FormationLayout | null; // 적 열보너스 (6.3: 보스전만, 아니면 null)
}

// ── 관측(Observation) — AI·모니터링 1급 인터페이스 (8.2) ────────────────────
// 결정에 필요한 모든 정보가 여기에 (픽셀에 숨은 정보 0).

export interface UnitView {
  uid: string;
  side: Side;
  name: string;
  pos: Pos;
  hp: number;
  hpMax: number;
  shield: number;
  alive: boolean;
  statuses: { id: string; icon: string; stacks: number; duration: number; nextChange: number }[];
  cooldowns: Record<string, number>;
  /** 현재 위치에서 받는 포메이션 보너스(총량보존 적용 후 실제값, 6.1). 수치 투명성(0.2) */
  formation: { attackPower: number; defensePower: number };
}

export interface LegalAction {
  action: Action;
  label: string;
  skillName?: string;
  /** 대상별 실제 명중% (2.7: 머리 위 표시용) */
  hitChance?: number;
  targetUid?: string;
}

export interface Observation {
  round: number;
  phase: Phase;
  current: { uid: string; name: string; side: Side; kind: TurnKind } | null;
  order: QueueEntry[];
  allies: UnitView[];
  enemies: UnitView[];
  legalActions: LegalAction[];
}
