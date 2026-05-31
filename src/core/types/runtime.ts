// ─────────────────────────────────────────────────────────────────────────
// 엔진 런타임 상태 (엔지니어 영역). 전투/관측 실행 중의 가변 상태.
// 데이터 계약(content.ts)을 참조하지만, 그 역은 없다. (8.6 / 8.8)
// ─────────────────────────────────────────────────────────────────────────

import type { Rng } from "../rng.ts";
import type { Side, Pos, StatusDefId, FormationLayout } from "./content.ts";

/** 상태이상 인스턴스(원장 1건) — 출처/만료 보존 (3.1) */
export interface StatusInstance {
  defId: StatusDefId;
  stacks: number;
  duration: number; // 잔여 정규 턴 수
  sourceUid: string; // 누가 걸었나
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
  /** 런 보상으로 누적된 스킬별 데미지 보너스 (4.2: 데미지는 스킬 강화로만) */
  skillDmgBonus: Record<string, number>;
}

/** 런 중 파티원 상태(전투 사이 유지: HP·성장). core/run 에서 사용 */
export interface PartyMemberState {
  charId: string;
  pos: Pos;
  hp: number;
  maxHp: number;
  skillDmgBonus: Record<string, number>;
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
  | { type: "skill"; skillId: string; targetUid?: string; targetCell?: Pos; cells?: Pos[] } // 앵커=유닛/칸, 또는 자유선택 cells
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
  | { t: "cleanse"; targetUid: string }
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
  /** 이번 라운드 전체 타임라인: 행동완료 + 현재 + 예정 + 끼어들기(동적 삽입). 라운드 끝까지 유지 (2.11) */
  roundOrder: QueueEntry[];
  /** 현재 행동 중인 인덱스 (roundOrder 기준). 이전=완료, 이후=예정 */
  cursor: number;
  current: QueueEntry | null; // 지금 행동할 차례 (= roundOrder[cursor])
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
  avatar?: string;
  pos: Pos;
  hp: number;
  hpMax: number;
  shield: number;
  alive: boolean;
  statuses: { id: string; icon: string; stacks: number; duration: number; nextChange: number; sources: string[] }[];
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
  order: QueueEntry[]; // = roundOrder (전체 타임라인)
  cursorIndex: number; // 현재 칸 인덱스 (▶ 위치)
  allies: UnitView[];
  enemies: UnitView[];
  legalActions: LegalAction[];
}
