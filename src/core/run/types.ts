// 런 도메인 타입 (전투 위 레이어). 사이클 방지를 위해 leaf 타입 모듈로 분리.
import type { GameState, MapEdge, MapNode, NodeType, PartyMemberState, RunDef } from "../types.ts";
import type { Rng } from "../rng.ts";

export type RunPhase = "map" | "battle" | "reward" | "shop" | "encounter" | "won" | "lost";

export type RewardOption =
  | { id: string; kind: "upgradeSkill"; charId: string; fromSkillId: string; toSkillId: string; label: string }
  | { id: string; kind: "learnSkill"; charId: string; skillId: string; label: string }
  | { id: string; kind: "item"; itemId: string; label: string } // 장신구(4.5) — 인벤토리에 추가
  | { id: string; kind: "heal"; pct: number; label: string };

/** 상점 판매 항목(7.2) — 골드로 구매. 강화권은 상점에서만(4.6). */
export type ShopOffer =
  | { id: string; kind: "upgrade"; cost: number; charId: string; fromSkillId: string; toSkillId: string; label: string }
  | { id: string; kind: "learn"; cost: number; charId: string; skillId: string; label: string }
  | { id: string; kind: "buyItem"; cost: number; itemId: string; label: string } // 장착 아이템 → 인벤토리
  | { id: string; kind: "heal"; cost: number; pct: number; label: string };

export interface RunState {
  rng: Rng;
  seed: number;
  runDef: RunDef; // 저작 런(직렬화 가능). 현재 층 그래프 = runDef.floors[floor] (helpers.curFloor)
  floor: number; // 0-base 현재 층 인덱스 (선형 체인)
  useMastery: boolean; // 숙련도 보상 게이팅 사용(4.4) — 모드 설정에서 옴
  party: PartyMemberState[];
  visited: string[];
  reachable: string[]; // 지금 선택 가능한 노드 (다음 선택지)
  currentNodeId: string; // 지금 서 있는(클리어한) 위치
  activeNodeId: string | null; // 전투/보상 중인 노드
  coreCursor: number | null; // 코어 레이어 시퀀스 진행 인덱스(Phase A2). null=레거시 타입 노드
  phase: RunPhase;
  battle: GameState | null;
  rewards: RewardOption[] | null;
  gold: number; // 런 내부 통화(7.2): 전투 승리·인카운터로 획득, 상점서 소비. 메타 재화와 별개(380행)
  inventory: string[]; // 미장착 보유 장착 아이템 id (4.3, 파티 공유 — 시트에서 장착)
  shop: ShopOffer[] | null; // 상점 진열(방문 시 생성, 구매하면 제거)
  encounterId: string | null; // 진행 중 인카운터 이벤트 id (data/events)
  /** 모험 패시브 grantRunStatus 계승분 — charId별, 다음 전투 시작 시 1회 주입 후 비움 */
  pendingStatuses: Record<string, { statusId: string; stacks: number; duration: number }[]>;
  log: string[];
}

export type NodeStatus = "current" | "visited" | "active" | "reachable" | "locked";

export interface RunView {
  phase: RunPhase;
  floor: number; // 현재 층 (1-base)
  totalFloors: number; // 총 층 수
  nodes: { id: string; q: number; r: number; type: NodeType; status: NodeStatus; label?: string }[];
  edges: MapEdge[]; // 현재 층 방향 간선 (웹 화살표 렌더용)
  party: {
    name: string;
    charId: string;
    avatar?: string;
    pos: { row: number; col: number }; // 진형 위치 (6장)
    hp: number;
    maxHp: number;
    alive: boolean;
    // 로드아웃(4.2): 보유 스킬 + 활성 여부 + 티어/강화가능 + 전용기 여부(4.6)
    skills: { id: string; name: string; tier: number; active: boolean; canUpgrade: boolean; signature: boolean }[];
    activeCount: number;
  }[];
  rewards: RewardOption[] | null;
  gold: number;
  shop: ShopOffer[] | null;
  encounter: { id: string; title: string; text: string; choices: { id: string; label: string }[] } | null;
  log: string[];
}
