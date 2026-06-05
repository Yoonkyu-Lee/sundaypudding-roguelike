// 코어 백엔드 어댑터 (P1-13 피처플래그) — 전투를 TS 코어 또는 Rust 코어(Tauri IPC) 어느 쪽으로 구동할지 선택.
// 목적: Rust 포팅의 differential을 **실제 데스크톱 앱에서 육안 검증**. Phase 1 범위 = 전투(데모). run/hub은 TS.
// 선택: URL `?core=rust` + Tauri 런타임(window.__TAURI__) 존재 시 Rust, 아니면 TS(브라우저 기본).
// 두 백엔드 모두 동일 인터페이스 { create(seed), step(action) } → { eventDelta, observation } 반환(Session과 동형).
import type { Action, GameEvent, GameState, Observation } from "../core/types.ts";
import { createBattle, step, buildObservation } from "../core/engine.ts";
import { DEMO_ENCOUNTER } from "../data/encounters.ts";

export interface StepResult {
  eventDelta: GameEvent[];
  observation: Observation;
}

/** 전투 백엔드 — create로 새 전투, step으로 행동 적용. 둘 다 델타+관측 반환(전체 상태 미전송). */
export interface BattleBackend {
  readonly kind: "ts" | "rust";
  create(seed: number): Promise<StepResult>;
  step(action: Action): Promise<StepResult>;
}

/** TS 코어 백엔드(브라우저 기본) — 인메모리 GameState. Session과 동일 의미. */
class TsBattleBackend implements BattleBackend {
  readonly kind = "ts" as const;
  private state: GameState | null = null;
  private delivered = 0;

  private collect(): StepResult {
    const s = this.state!;
    const delta = s.log.slice(this.delivered);
    this.delivered = s.log.length;
    return { eventDelta: delta, observation: buildObservation(s) };
  }

  async create(seed: number): Promise<StepResult> {
    this.state = createBattle(seed, DEMO_ENCOUNTER);
    this.delivered = 0;
    return this.collect();
  }

  async step(action: Action): Promise<StepResult> {
    if (!this.state) throw new Error("create 먼저");
    step(this.state, action);
    return this.collect();
  }
}

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
function tauriInvoke(): TauriInvoke | null {
  const t = (globalThis as { __TAURI__?: { core?: { invoke?: TauriInvoke } } }).__TAURI__;
  return t?.core?.invoke ?? null;
}

/** Rust 코어 백엔드(Tauri IPC) — spr-core 세션을 invoke로 구동. 이벤트는 TS와 바이트 동일(엔진 differential). */
class RustBattleBackend implements BattleBackend {
  readonly kind = "rust" as const;
  private invoke: TauriInvoke;
  constructor(invoke: TauriInvoke) {
    this.invoke = invoke;
  }
  async create(seed: number): Promise<StepResult> {
    return (await this.invoke("create_session", { seed })) as StepResult;
  }
  async step(action: Action): Promise<StepResult> {
    return (await this.invoke("battle_step", { action })) as StepResult;
  }
}

/** 피처플래그 해소: `?core=rust` + Tauri 런타임이면 Rust, 아니면 TS. */
export function selectBattleBackend(search: string = globalThis.location?.search ?? ""): BattleBackend {
  const wantRust = new URLSearchParams(search).get("core") === "rust";
  const invoke = tauriInvoke();
  if (wantRust && invoke) return new RustBattleBackend(invoke);
  return new TsBattleBackend();
}
