// 전투 상태 생성 — 인코딩(Encounter) → GameState. 유닛 빌드, 포메이션 배정.
import { Rng } from "../rng.ts";
import type { Equipped, GameState, Pos, Unit } from "../types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { ITEMS } from "../../data/items.ts";
import { STANDARD_FORMATION } from "../../data/formations.ts";
import type { Encounter, Placement } from "../../data/encounters.ts";
import { startRound } from "./turnOrder.ts";
import { compileRules, fireTrigger } from "./passives/index.ts";

/** 장착 3칸의 비-HP 스탯 보정 + 무기 dmgFlat·방어구 쉴드획득 합산 (4.3). HP는 maxHp에 이미 반영(equipItem). */
function equipBonus(eq?: Equipped) {
  const b = { evasion: 0, accuracy: 0, critChance: 0, critMultiplier: 0, speedMin: 0, speedMax: 0, dmgFlat: 0, shieldGainAdd: 0 };
  if (!eq) return b;
  for (const id of [eq.weapon, eq.armor, eq.held]) {
    const it = id ? ITEMS[id] : undefined;
    if (!it) continue;
    const m = it.mods;
    if (m) { b.evasion += m.evasion ?? 0; b.accuracy += m.accuracy ?? 0; b.critChance += m.critChance ?? 0; b.critMultiplier += m.critMultiplier ?? 0; b.speedMin += m.speedMin ?? 0; b.speedMax += m.speedMax ?? 0; }
    b.dmgFlat += it.dmgFlat ?? 0;
    b.shieldGainAdd += it.shieldGainAdd ?? 0;
  }
  return b;
}

function makeUnit(
  p: Placement,
  side: "ally" | "enemy",
  idx: number,
  growth?: { hp?: number; maxHp?: number; skillDmgBonus?: Record<string, number>; activeSkillIds?: string[]; ownedSkillIds?: string[]; equipped?: Equipped; startStatuses?: { statusId: string; stacks: number; duration: number }[] },
): Unit {
  const c = CHARACTERS[p.charId];
  if (!c) throw new Error(`character not found: ${p.charId}`);
  const maxHp = growth?.maxHp ?? c.hp; // party.maxHp가 방어구 HP 보정을 이미 포함
  const eb = equipBonus(growth?.equipped);
  // 패시브 = 보유 기준. 아군=ownedSkillIds, 적/기본=캐릭터 skillIds 전체. + 캐릭 특성(traitIds).
  const owned = growth?.ownedSkillIds ?? c.skillIds;
  const uid = `${side[0]}${idx}_${c.id}`;
  // 모험 패시브 계승 상태(pendingStatuses) — 전투 시작 전 부여(라운드1부터 반영)
  const startStatuses = (growth?.startStatuses ?? []).map((s) => ({ defId: s.statusId, stacks: s.stacks, duration: s.duration, sourceUid: uid }));
  return {
    uid,
    side,
    charId: c.id,
    name: c.name,
    pos: { ...p.pos },
    hpMax: maxHp,
    hp: growth?.hp ?? maxHp,
    shield: 0,
    speedMin: c.speedMin + eb.speedMin,
    speedMax: c.speedMax + eb.speedMax,
    evasion: c.evasion + eb.evasion,
    accuracy: c.accuracy + eb.accuracy,
    critChance: c.critChance + eb.critChance,
    critMultiplier: c.critMultiplier + eb.critMultiplier,
    activeSkillIds: growth?.activeSkillIds ?? c.skillIds.slice(0, 4), // 런 선택 활성 4 (없으면 기본 앞 4)
    cooldowns: {},
    statuses: startStatuses,
    alive: true,
    skillDmgBonus: { ...(growth?.skillDmgBonus ?? {}) },
    equipDmgFlat: eb.dmgFlat,
    equipShieldGainAdd: eb.shieldGainAdd,
    rules: compileRules(c.id, owned),
    statMods: {},
    turnCount: 0,
  };
}

/** allyStates 주어지면 아군을 그 상태(런 성장)로 빌드, 아니면 encounter.allies 기본값. */
export function createBattle(
  seed: number,
  enc: Encounter,
  allyStates?: { charId: string; pos: Pos; hp: number; maxHp: number; skillDmgBonus: Record<string, number>; activeSkillIds?: string[]; ownedSkillIds?: string[]; equipped?: Equipped; startStatuses?: { statusId: string; stacks: number; duration: number }[] }[],
): GameState {
  const allyUnits = allyStates
    ? allyStates.map((m, i) =>
        makeUnit({ charId: m.charId, pos: m.pos }, "ally", i, { hp: m.hp, maxHp: m.maxHp, skillDmgBonus: m.skillDmgBonus, activeSkillIds: m.activeSkillIds, ownedSkillIds: m.ownedSkillIds, equipped: m.equipped, startStatuses: m.startStatuses }),
      )
    : enc.allies.map((p, i) => makeUnit(p, "ally", i));
  const units: Unit[] = [...allyUnits, ...enc.enemies.map((p, i) => makeUnit(p, "enemy", i))];
  const state: GameState = {
    rng: new Rng(seed),
    round: 0,
    units,
    roundOrder: [],
    cursor: -1,
    current: null,
    phase: "inProgress",
    log: [],
    // 아군=표준(또는 override), 적=보스전만 적용 (6.3)
    allyFormation: enc.allyFormation ?? STANDARD_FORMATION,
    enemyFormation: enc.boss ? (enc.enemyFormation ?? STANDARD_FORMATION) : null,
  };
  fireTrigger(state, { on: "battleStart" });
  startRound(state);
  return state;
}
