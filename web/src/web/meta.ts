// 영구 메타 — 숙련도(캐릭별 레벨/XP). 런 세이브와 분리(spr_meta_v1) → 런 포기·실패해도 유지(5.1).
// XP는 전투 승리마다 소량(5.3 "소량") → 레벨↑ → 보상 스킬 tier 해금(4.4).

/** 숙련도 레벨 → 보상 출현 가능 최대 스킬 tier (4.4). 디자이너 튜닝 곡선. (구 core/run/rewards.unlockedTier — 코어 은퇴로 프론트 인라인) */
function unlockedTier(level: number): number {
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

const META_KEY = "spr_meta_v1";
const XP_PER_WIN = 2; // 전투 승리당 생존 아군 1인 XP
const XP_PER_LEVEL = 8; // 레벨업당 누적 XP (≈ 4승/레벨, 천천히)

export interface MasteryEntry { level: number; xp: number; }
export interface MetaState { mastery: Record<string, MasteryEntry>; roster?: string[]; }

const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL);

function loadMeta(): MetaState {
  try {
    const s = localStorage.getItem(META_KEY);
    if (s) { const o = JSON.parse(s); if (o && typeof o === "object" && o.mastery) return o as MetaState; }
  } catch { /* 무시 */ }
  return { mastery: {} };
}
let meta: MetaState = loadMeta();
function saveMeta(): void { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* */ } }

/** 런 시작용 — 캐릭별 숙련도 레벨 맵(createRun opts.mastery). */
export function masteryMap(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const id in meta.mastery) m[id] = meta.mastery[id].level;
  return m;
}

/** 전투 승리 — 생존 아군에 소량 XP, 레벨 재계산, 저장. */
export function grantWin(charIds: string[]): void {
  for (const id of charIds) {
    const e = meta.mastery[id] ?? { level: 0, xp: 0 };
    e.xp += XP_PER_WIN;
    e.level = levelOf(e.xp);
    meta.mastery[id] = e;
  }
  saveMeta();
}

/** 허브 표시용: 레벨·레벨 내 진행·해금 tier. */
export function masteryInfo(charId: string): { level: number; xpInLevel: number; xpPerLevel: number; tier: number } {
  const e = meta.mastery[charId] ?? { level: 0, xp: 0 };
  return { level: e.level, xpInLevel: e.xp % XP_PER_LEVEL, xpPerLevel: XP_PER_LEVEL, tier: unlockedTier(e.level) };
}

/** 본거지 편성: 저장된 선택 로스터(없으면 fallback). 다음 세션·런에도 기억. */
export function getRoster(fallback: string[]): string[] {
  return meta.roster && meta.roster.length > 0 ? meta.roster : fallback;
}
export function setRoster(charIds: string[]): void { meta.roster = [...charIds]; saveMeta(); }
