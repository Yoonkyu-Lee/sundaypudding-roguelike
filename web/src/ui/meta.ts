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
export interface MetaState {
  mastery: Record<string, MasteryEntry>;
  roster?: string[];
  unlocked?: string[]; // 해금 캐릭터 charId(관련 런 클리어로 해금) — 도감·일반모드 풀(CDX)
  seenSkills?: string[]; // 런에서 보유/획득해본 스킬 id(도감 스킬트리 '?'→스펙 공개)
}

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

// ── 캐릭터 해금 + 스킬 도감(CDX) — 런 클리어로 캐릭 해금, 런에서 본 스킬은 도감 공개 ──
/** 해금 캐릭터 집합(도감 밝게 표시·일반모드 풀). */
export function unlockedCharSet(): Set<string> { return new Set(meta.unlocked ?? []); }
/** 캐릭터 해금(관련 런 클리어). 새로 해금된 게 있으면 true. */
export function unlockChars(charIds: string[]): string[] {
  const set = new Set(meta.unlocked ?? []);
  const fresh: string[] = [];
  for (const id of charIds) if (!set.has(id)) { set.add(id); fresh.push(id); }
  if (fresh.length) { meta.unlocked = [...set]; saveMeta(); }
  return fresh;
}
/** 도감에서 스펙 공개된 스킬 집합(런에서 보유/획득해봄). */
export function seenSkillSet(): Set<string> { return new Set(meta.seenSkills ?? []); }
/** 스킬을 '본 것'으로 기록(런 보유/획득) → 도감 '?'→스펙. */
export function markSkillsSeen(skillIds: string[]): void {
  const set = new Set(meta.seenSkills ?? []);
  let changed = false;
  for (const id of skillIds) if (id && !set.has(id)) { set.add(id); changed = true; }
  if (changed) { meta.seenSkills = [...set]; saveMeta(); }
}
