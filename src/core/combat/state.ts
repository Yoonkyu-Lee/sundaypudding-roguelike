// 전투 상태 생성 — 인코딩(Encounter) → GameState. 유닛 빌드, 포메이션 배정.
import { Rng } from "../rng.ts";
import type { GameState, Pos, Unit } from "../types.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { STANDARD_FORMATION } from "../../data/formations.ts";
import type { Encounter, Placement } from "../../data/encounters.ts";
import { startRound } from "./turnOrder.ts";

function makeUnit(
  p: Placement,
  side: "ally" | "enemy",
  idx: number,
  growth?: { hp?: number; maxHp?: number; skillDmgBonus?: Record<string, number>; activeSkillIds?: string[] },
): Unit {
  const c = CHARACTERS[p.charId];
  if (!c) throw new Error(`character not found: ${p.charId}`);
  const maxHp = growth?.maxHp ?? c.hp;
  return {
    uid: `${side[0]}${idx}_${c.id}`,
    side,
    charId: c.id,
    name: c.name,
    pos: { ...p.pos },
    hpMax: maxHp,
    hp: growth?.hp ?? maxHp,
    shield: 0,
    speedMin: c.speedMin,
    speedMax: c.speedMax,
    evasion: c.evasion,
    accuracy: c.accuracy,
    critChance: c.critChance,
    critMultiplier: c.critMultiplier,
    activeSkillIds: growth?.activeSkillIds ?? c.skillIds.slice(0, 4), // 런 선택 활성 4 (없으면 기본 앞 4)
    cooldowns: {},
    statuses: [],
    alive: true,
    skillDmgBonus: { ...(growth?.skillDmgBonus ?? {}) },
  };
}

/** allyStates 주어지면 아군을 그 상태(런 성장)로 빌드, 아니면 encounter.allies 기본값. */
export function createBattle(
  seed: number,
  enc: Encounter,
  allyStates?: { charId: string; pos: Pos; hp: number; maxHp: number; skillDmgBonus: Record<string, number>; activeSkillIds?: string[] }[],
): GameState {
  const allyUnits = allyStates
    ? allyStates.map((m, i) =>
        makeUnit({ charId: m.charId, pos: m.pos }, "ally", i, { hp: m.hp, maxHp: m.maxHp, skillDmgBonus: m.skillDmgBonus, activeSkillIds: m.activeSkillIds }),
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
  startRound(state);
  return state;
}
