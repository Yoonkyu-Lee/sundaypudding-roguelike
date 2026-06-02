// 런 이어하기 영속화 (localStorage, 슬라이스3). 순수 — run을 인자로 받음(main 상태 비참조).
// 호환 안 되는 세이브(콘텐츠/스키마 변경)는 로드 시 자동 폐기 → 크래시 없이 새로 시작(디자이너 자가치유).
import { serializeRun, deserializeRun, type RunState } from "../core/run.ts";
import { CHARACTERS } from "../data/characters.ts";

const SAVE_KEY = "spr_save_v1";

/** 현재 데이터/스키마와 호환되는 세이브인가. 안 맞으면 폐기 대상. */
function loadable(run: RunState | null): run is RunState {
  if (!run || !Array.isArray(run.party) || run.party.length === 0) return false;
  if (!run.party.every((m) => CHARACTERS[m.charId])) return false; // 삭제/개명된 캐릭 참조 → 호환 불가
  if (run.battle && Array.isArray(run.battle.units) && run.battle.units.some((u) => !Array.isArray(u.rules))) return false; // 구 전투 스키마(패시브 룰 이전)
  return true;
}

export function saveRun(run: RunState): void {
  try { localStorage.setItem(SAVE_KEY, serializeRun(run)); } catch { /* 용량/비활성 무시 */ }
}
export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* */ }
}
export function loadRun(): RunState | null {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    const run = deserializeRun(s);
    if (!loadable(run)) { clearSave(); return null; } // 호환 불가 → 폐기 후 새로 시작
    return run;
  } catch {
    clearSave();
    return null;
  }
}
