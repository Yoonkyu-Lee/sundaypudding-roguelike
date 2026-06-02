// ─────────────────────────────────────────────────────────────────────────
// 데이터 계약 (디자이너 작성 스키마). src/data 가 이 타입들로 콘텐츠를 작성한다.
// 엔진은 이걸 "해석"만 한다. (GAME-DESIGN 8.6 / 8.8 데이터·엔진 경계)
// ─────────────────────────────────────────────────────────────────────────

import type { PassiveRule } from "./passives.ts";

export type Side = "ally" | "enemy";

/** 그리드 좌표 (행, 열). 열 0 = 최전방. (2.1) */
export interface Pos {
  row: number;
  col: number;
}

// ── 상태이상 정의 (3장) ────────────────────────────────────────────────────

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
  /** 이로운 효과인가(버프). 표시 구분용. 기본 false=디버프 */
  buff?: boolean;
  /** 지속 피해(DoT): 발동 시점 + 스택당 피해 */
  dot?: { trigger: StatusTrigger; dmgPerStack: number };
  /** 지속 회복(HoT, 재생): 발동 시점 + 스택당 회복 (3.6) */
  hot?: { trigger: StatusTrigger; healPerStack: number };
  /** 행동 봉쇄(빙결): 정규 턴 행동 불가 */
  actionDenial?: boolean;
  /** 주는 데미지 곱연산 배율(동상 0.5). 표준 전역효과만 곱연산 허용(3.7) */
  damageDealtMult?: number;
  /** 쉴드 잠식 배율(공포): 들어온 피해 1이 쉴드를 (스택)만큼 깎음. HP 효율 불변 (3.5) */
  shieldShred?: boolean;
  /** 쉴드 무시(관통): 보유 시 그 유닛의 공격이 쉴드를 무시하고 HP 직접 (3.6) */
  pierce?: boolean;
  /** 사망 방지(불사): HP 0 이하로 안 죽음 (3.6) */
  undying?: boolean;
  /** 보유 유닛이 정규 턴에 행동하면 끼어들기 발생 (신속 등 버프). 끼어들기 출처가 스킬에 국한되지 않음 (2.11) */
  grantsInterrupt?: boolean;
  /** 주는 데미지 합연산 보정(공위증=+, 약화=-). (3.6/3.7) */
  dmgDealtFlat?: number;
  /** 치명타 확률 가산(%) */
  critChanceAdd?: number;
  /** 치명타 배수 가산 */
  critMultiplierAdd?: number;
  /** 무적: 모든 피해 0 (백병원 등) */
  invincible?: boolean;
  /** 도발: 보유 유닛(아군)에게 적 공격이 집중됨 (AI가 참조) */
  taunt?: boolean;
  /** SPD 보정(부호 있음): 양수=상승(서열 앞으로), 음수=하락(서열 뒤로). 가속/마비 등 (3.5) */
  speedMod?: number;
}

// ── 스킬 (2.3~2.10) ────────────────────────────────────────────────────────

/** 스킬 효과 프리미티브 (3.9). 한 스킬은 effects[]의 조합. */
export type SkillEffect =
  | { kind: "damage"; amount: number } // 스킬 상수 데미지 (2.5)
  | { kind: "applyStatus"; statusId: StatusDefId; stacks: number; duration: number }
  | { kind: "applyStatusSelf"; statusId: StatusDefId; stacks: number; duration: number } // 대상과 별개로 시전자에게
  | { kind: "shield"; amount: number } // 쉴드(덤 HP) 부여 (2.9)
  | { kind: "heal"; amount: number }
  | { kind: "cleanse" } // 디버프 정화 (대상의 비버프 상태 제거)
  | { kind: "move"; who: "target" | "self"; deltaCol: number }; // 동적 재배치 (6.4)

/**
 * 면적(풋프린트) 모양 — 선택한 앵커 칸 기준으로 영향 칸을 정의. 바닥에 표시(2.4 확장).
 * single=앵커만 / row=앵커 행 전체 / col=앵커 열 전체 / square=앵커 중심 (2·radius+1)² /
 * cross=앵커+직교 인접(radius) / all=대상 진영 전체 / free=자유 인접 N칸.
 */
export type AreaShape =
  | { kind: "single" | "row" | "col" | "square" | "cross" | "all"; radius?: number }
  | { kind: "free"; count: number }; // 자유 인접 N칸 선택 (인터랙티브)

export type SkillTarget = "enemy" | "ally" | "self";

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
  /** 도달 깊이(근접 사정권, 2.4): **최전열(살아있는 적의 최소 열)부터 연속 n칸**만 타격 가능.
   *  정적 targetCells와 달리 동적 — 전열이 비면 다음 최전열로 전진(후열만 남는 교착 방지). 빈 열을 건너뛰지 않음(근접=인접). targetCells보다 우선. */
  reach?: number;
  /** 이 스킬 사용 시 부여하는 끼어들기 횟수 (2.11). 끼어들기 출처의 하나일 뿐 — 버프 등 다른 출처도 있음 */
  grantsInterrupt?: number;
  /** 끼어들기 주체: "self"=시전자 본인 / "target"=대상 아군(서포트). 기본 self (2.11) */
  grantsInterruptTo?: "self" | "target";
  /** 면적 모양(기본 single). 앵커(선택 대상) 기준으로 영향 칸 결정 (바닥에 표시) */
  area?: AreaShape;
  effects: SkillEffect[];
  /** 강화 티어(4.6). 표시용 단계, 기본 1. */
  tier?: number;
  /** 다음 티어 스킬 id(4.6). 보상 "강화" 시 이 id로 교체. 없으면 최종 티어. 런이 해석(전투 엔진 무관) */
  nextTierId?: string;
  /** 전용기 소유 charId(4.6). 있으면 그 캐릭 고유기, 없으면 범용기(여러 learnset 공유). 학습 가능 여부는 learnset이 결정 — 이 필드는 UI/의미용(전투 엔진 무관) */
  exclusiveTo?: string;
  /** 능동기 여부. 기본 true(=플레이어가 전투 스킬창에서 발동). false=순수 패시브 → 스킬창 비노출, passives만 작동 */
  active?: boolean;
  /** 출전(활성 4)해야 작동하는 패시브 룰. 능동 effects와 공존 가능(하이브리드). 특성(traits)은 편성 무관 항상 */
  passives?: PassiveRule[];
}

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

// ── 캐릭터(본체 템플릿) (4장) ──────────────────────────────────────────────

/** 캐릭터 = 포켓몬式 고유 디자인. 스탯은 보정 가능한 기본값(0.2) */
export interface Character {
  id: string;
  name: string;
  /** 프로필(아바타). 이모지 또는 이미지 경로. 저작권 안전한 플레이스홀더 → 후일 교체 */
  avatar?: string;
  hp: number;
  speedMin: number; // SPD 범위 (2.2)
  speedMax: number;
  evasion: number; // 회피 — 명중에서 차감 (2.6)
  accuracy: number; // 명중 가산, 기본 0 (2.7)
  critChance: number; // 치명 확률 %, 기본 10 (2.6)
  critMultiplier: number; // 치명 배수, 기본 1.5 (2.6)
  skillIds: string[]; // 보유 풀. 슬라이스에선 앞 4개를 활성으로 사용
  /** 플레이어가 본거지에서 편성 가능한 아군 후보인가. 적/잡몹은 false/미설정. (엔진 미해석 — 허브 선택 풀 카테고리화) */
  playable?: boolean;
  /** 이 캐릭터를 정의하는 특성(상시 패시브). data/traits.ts의 TraitDef id 참조. 여러 개 가능 */
  traitIds?: string[];
  /** 적/자동플레이 시 행동결정 정책. data/ai.ts의 AiProfile id 참조. 없으면 공유 그리디 fallback */
  aiProfileId?: string;
}

// ── 장착 아이템 (4.3) ──────────────────────────────────────────────────────
// 스탯은 오직 장착으로만 변동(4.2). 무기=공격 측, 방어구=생존 측, 지닌물건=후속.
export type EquipSlot = "weapon" | "armor" | "held";

/** 장착 아이템 = 능력치/데미지/쉴드획득 보정 묶음 (디자이너 데이터). */
export interface ItemDef {
  id: string;
  name: string;
  slot: EquipSlot;
  icon?: string;
  /** 기본 능력치 합산 보정 (장착/해제 시 적용). HP는 maxHp에 합산 */
  mods?: Partial<{
    hp: number;
    evasion: number;
    accuracy: number;
    critChance: number;
    critMultiplier: number;
    speedMin: number;
    speedMax: number;
  }>;
  dmgFlat?: number; // 무기: 데미지 스킬에 공격 상수 +N (合연산, 4.3)
  shieldGainAdd?: number; // 방어구: 쉴드 획득량 +N (받는 쪽, 4.3)
  tier?: number;
  nextTierId?: string; // 강화 체인 (스킬 nextTierId와 동형)
}

// ── 런 맵 생성 (7장, 데이터 주도) ──────────────────────────────────────────
// 노드 종류 (7.2). start/boss는 생성기가 자동 배치, 나머지는 nodeWeights로 추첨.
export type NodeType = "start" | "battle" | "elite" | "shop" | "encounter" | "rest" | "boss";

/** 맵 생성 설정 — 디자이너 편집. 메커니즘(genMap)=엔진, 값=여기. (다층은 후속: 이 형태의 배열로 확장) */
export interface MapGenConfig {
  rows: number; // 선택 층(보스 제외) 깊이 (7.3 parameterizable)
  startWidth: [number, number]; // 시작 행 너비 범위(min,max)
  firstRowType: NodeType; // 첫 행 고정 타입(안전 시작, 보통 battle)
  nodeWeights: Partial<Record<NodeType, number>>; // 행1+ 노드 타입 가중치 추첨
  /** 자식 분기 확률(%) — 각 부모가 다음 행에 만드는 자식 */
  branch: { keepQChance: number; extraSameChance: number; extraLeftChance: number };
}

// ── 게임 모드 (0.1/7.4) — 모드 = 런 베이스의 설정. 디자이너가 데이터로 캠페인/일반/챌린지 추가 ──
export interface GameMode {
  id: string;
  name: string;
  desc?: string;
  roster: { charId: string; pos: Pos }[]; // 시작 파티
  acts: MapGenConfig[]; // 액트별 맵 (다층 7.3)
  useMastery: boolean; // 숙련도 보상 게이팅 사용 여부(4.4) — false면 전 tier 개방
}
