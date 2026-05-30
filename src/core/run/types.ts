// 런 도메인 타입 (전투 위 레이어). 사이클 방지를 위해 leaf 타입 모듈로 분리.
import type { GameState, PartyMemberState } from "../types.ts";
import type { Rng } from "../rng.ts";
import type { NodeType, RunNode } from "./map.ts";

export type RunPhase = "map" | "battle" | "reward" | "won" | "lost";

export type RewardOption =
  | { id: string; kind: "skillUp"; charId: string; skillId: string; amount: number; label: string }
  | { id: string; kind: "heal"; pct: number; label: string }
  | { id: string; kind: "maxhp"; charId: string; amount: number; label: string };

export interface RunState {
  rng: Rng;
  seed: number;
  rows: number; // 보스 제외 선택 층 수 (기본 3, parameterizable 7.3)
  nodes: RunNode[];
  party: PartyMemberState[];
  visited: string[];
  reachable: string[]; // 지금 선택 가능한 노드 (다음 선택지)
  currentNodeId: string; // 지금 서 있는(클리어한) 위치
  activeNodeId: string | null; // 전투/보상 중인 노드
  phase: RunPhase;
  battle: GameState | null;
  rewards: RewardOption[] | null;
  log: string[];
}

export type NodeStatus = "current" | "visited" | "active" | "reachable" | "locked";

export interface RunView {
  phase: RunPhase;
  rows: number;
  nodes: { id: string; q: number; r: number; type: NodeType; status: NodeStatus }[];
  party: { name: string; charId: string; avatar?: string; hp: number; maxHp: number; alive: boolean }[];
  rewards: RewardOption[] | null;
  log: string[];
}
