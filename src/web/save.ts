// 런 이어하기 영속화 (localStorage, 슬라이스3). 순수 — run을 인자로 받음(main 상태 비참조).
// 스키마 변경 시 SAVE_KEY 버전 bump → 구세이브 자연 폐기.
import { serializeRun, deserializeRun, type RunState } from "../core/run.ts";

const SAVE_KEY = "spr_save_v1";

export function saveRun(run: RunState): void {
  try { localStorage.setItem(SAVE_KEY, serializeRun(run)); } catch { /* 용량/비활성 무시 */ }
}
export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* */ }
}
export function loadRun(): RunState | null {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? deserializeRun(s) : null; } catch { return null; }
}
