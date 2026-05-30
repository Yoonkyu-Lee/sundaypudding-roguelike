// ─────────────────────────────────────────────────────────────────────────
// 전투 코어 엔진 — 순수·결정론. 상태 + 행동 → 다음 상태. (8.1)
// 렌더링 의존 0. 모든 무작위는 state.rng(시드)에서만. (8.3)
// ─────────────────────────────────────────────────────────────────────────

import { Rng } from "./rng.ts";
import type {
  Action,
  AreaShape,
  FormationBonusKind,
  GameEvent,
  GameState,
  LegalAction,
  Pos,
  QueueEntry,
  Skill,
  StatusInstance,
  Unit,
} from "./types.ts";
import { CHARACTERS } from "../data/characters.ts";
import { SKILLS } from "../data/skills.ts";
import { STATUS_DEFS } from "../data/statuses.ts";
import { STANDARD_FORMATION } from "../data/formations.ts";
import type { Encounter, Placement } from "../data/encounters.ts";

const ACTION_CONST = 10000; // 행동 서열 = ACTION_CONST / SPD (2.2)

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

function unitById(state: GameState, uid: string): Unit {
  const u = state.units.find((x) => x.uid === uid);
  if (!u) throw new Error(`unit not found: ${uid}`);
  return u;
}

function aliveUnits(state: GameState, side?: "ally" | "enemy"): Unit[] {
  return state.units.filter((u) => u.alive && (side ? u.side === side : true));
}

function hasStatus(unit: Unit, defId: string): boolean {
  return unit.statuses.some((s) => s.defId === defId && s.stacks > 0);
}

function totalStacks(unit: Unit, defId: string): number {
  return unit.statuses
    .filter((s) => s.defId === defId)
    .reduce((sum, s) => sum + s.stacks, 0);
}

/** 상태이상 정의의 수치 필드를 스택 가중 합산 (dmgDealtFlat/critPctAdd/critMultAdd) */
function statusNumSum(unit: Unit, key: "dmgDealtFlat" | "critPctAdd" | "critMultAdd" | "spdDown"): number {
  let sum = 0;
  for (const s of unit.statuses) {
    const v = STATUS_DEFS[s.defId][key];
    if (typeof v === "number") sum += v * s.stacks;
  }
  return sum;
}

/** 불린 플래그 상태 보유 여부 (invincible/taunt 등) */
function statusFlag(unit: Unit, key: "invincible" | "taunt"): boolean {
  return unit.statuses.some((s) => STATUS_DEFS[s.defId][key] && s.stacks > 0);
}

function critPctOf(unit: Unit): number {
  return unit.critPct + statusNumSum(unit, "critPctAdd");
}

// ── 전투 생성 ────────────────────────────────────────────────────────────────

function makeUnit(
  p: Placement,
  side: "ally" | "enemy",
  idx: number,
  growth?: { hp?: number; maxHp?: number; skillDmgBonus?: Record<string, number> },
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
    spdMin: c.spdMin,
    spdMax: c.spdMax,
    dex: c.dex,
    accuracy: c.accuracy,
    critPct: c.critPct,
    critMult: c.critMult,
    activeSkillIds: c.skillIds.slice(0, 4), // 전투 활성 최대 4 (2.3)
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
  allyStates?: { charId: string; pos: Pos; hp: number; maxHp: number; skillDmgBonus: Record<string, number> }[],
): GameState {
  const allyUnits = allyStates
    ? allyStates.map((m, i) =>
        makeUnit({ charId: m.charId, pos: m.pos }, "ally", i, { hp: m.hp, maxHp: m.maxHp, skillDmgBonus: m.skillDmgBonus }),
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

/** 데미지 미리보기(비크리 기준, 결정론). 타겟팅 UI의 "깎일 양" 표시용. (0.2/2.7) */
export function previewDamage(state: GameState, actor: Unit, skill: Skill): number {
  let total = 0;
  for (const eff of skill.effects) {
    if (eff.kind === "damage") {
      const atk = getFormationBonus(state, actor, "attackPower");
      const up = actor.skillDmgBonus[skill.id] ?? 0;
      total += computeDamage(actor, eff.amount + atk + up, false);
    }
  }
  return total;
}

/** 포메이션 열보너스 — 총량보존(같은 열 유닛 수로 분배). (6.1) */
export function getFormationBonus(state: GameState, unit: Unit, kind: FormationBonusKind): number {
  const layout = unit.side === "ally" ? state.allyFormation : state.enemyFormation;
  if (!layout) return 0;
  const total = layout.columns[unit.pos.col]?.[kind] ?? 0;
  if (total === 0) return 0;
  const count = state.units.filter(
    (u) => u.alive && u.side === unit.side && u.pos.col === unit.pos.col,
  ).length;
  return count > 0 ? total / count : 0; // 분수 허용(4/3 등), 최종 적용 시 반올림
}

// ── 라운드 & 서열 (2.2 라운드제) ───────────────────────────────────────────

function startRound(state: GameState): void {
  state.round++;
  const entries: QueueEntry[] = aliveUnits(state).map((u) => ({
    uid: u.uid,
    kind: "normal" as const,
    // 라운드마다 SPD 주사위 (2.2) − 마비/둔화(spdDown)로 뒤로 밀림 (3.5)
    spd: Math.max(1, state.rng.int(u.spdMin, u.spdMax) - statusNumSum(u, "spdDown")),
  }));
  // 행동 서열 = ACTION_CONST / SPD 오름차순 → SPD 높을수록 먼저.
  // 동점은 uid로 결정론적 정렬.
  entries.sort((a, b) => {
    const av = ACTION_CONST / a.spd;
    const bv = ACTION_CONST / b.spd;
    if (av !== bv) return av - bv;
    return a.uid < b.uid ? -1 : 1;
  });
  state.roundOrder = entries;
  state.cursor = -1; // advance가 0으로 전진
  state.log.push({ t: "roundStart", round: state.round, order: [...entries] });
  advance(state);
}

/** 커서를 다음 칸으로 전진. 타임라인 끝이면 새 라운드. 죽은 유닛 칸은 건너뜀(타임라인엔 남음). */
function advance(state: GameState): void {
  if (state.phase !== "inProgress") return;
  while (true) {
    state.cursor++;
    if (state.cursor >= state.roundOrder.length) {
      startRound(state);
      return;
    }
    const next = state.roundOrder[state.cursor];
    const u = unitById(state, next.uid);
    if (!u.alive) continue; // 죽은 유닛 스킵 (칸은 타임라인에 남아 회색 표시)
    state.current = next;
    state.log.push({ t: "turnStart", uid: u.uid, kind: next.kind });
    if (next.kind === "normal") onNormalTurnStart(state, u);
    // 턴 시작 효과로 죽었으면 다음으로
    if (!u.alive) {
      state.current = null;
      if (checkWin(state)) return;
      continue;
    }
    return;
  }
}

/** 정규 턴 시작: 쿨타임 감소 + 중독(turnStart) 발동. 끼어들기는 호출 안 됨. (2.10/2.11) */
function onNormalTurnStart(state: GameState, u: Unit): void {
  for (const id of Object.keys(u.cooldowns)) {
    if (u.cooldowns[id] > 0) u.cooldowns[id]--;
  }
  tickPeriodic(state, u, "turnStart");
  checkWin(state);
}

/** 정규 턴 종료: 화상(turnEnd) 발동 + 상태이상 지속시간 차감. 끼어들기는 호출 안 됨. (2.11) */
function onNormalTurnEnd(state: GameState, u: Unit): void {
  if (u.alive) tickPeriodic(state, u, "turnEnd");
  // 지속시간 차감(정규 턴 기준) — 출혈 포함 모든 상태 (2.11)
  for (const s of u.statuses) s.duration--;
  u.statuses = u.statuses.filter((s) => s.duration > 0 && s.stacks > 0);
}

// ── DoT 처리 (3.5) ──────────────────────────────────────────────────────────

function tickPeriodic(state: GameState, u: Unit, trigger: "turnStart" | "turnEnd" | "onAction"): void {
  if (!u.alive) return;
  // 같은 트리거의 DoT/HoT를 defId별 합산
  const dmgByDef = new Map<string, number>();
  const healByDef = new Map<string, number>();
  for (const s of u.statuses) {
    const def = STATUS_DEFS[s.defId];
    if (def.dot && def.dot.trigger === trigger) {
      dmgByDef.set(s.defId, (dmgByDef.get(s.defId) ?? 0) + s.stacks * def.dot.dmgPerStack);
    }
    if (def.hot && def.hot.trigger === trigger) {
      healByDef.set(s.defId, (healByDef.get(s.defId) ?? 0) + s.stacks * def.hot.healPerStack);
    }
  }
  // 회복(재생) 먼저
  for (const [, amt] of healByDef) {
    if (amt <= 0) continue;
    const before = u.hp;
    u.hp = Math.min(u.hpMax, u.hp + amt);
    state.log.push({ t: "heal", targetUid: u.uid, amount: u.hp - before });
  }
  // 지속 피해
  for (const [defId, dmg] of dmgByDef) {
    if (dmg <= 0) continue;
    dealRawDamage(state, u, dmg);
    state.log.push({ t: "statusTick", targetUid: u.uid, statusId: defId, dmg });
    if (!u.alive) break;
  }
}

// ── 합법 행동 (8.2) ──────────────────────────────────────────────────────────

function isFrozen(u: Unit): boolean {
  return u.statuses.some((s) => STATUS_DEFS[s.defId].actionDenial && s.stacks > 0);
}

function validTargets(state: GameState, actor: Unit, skill: Skill): Unit[] {
  if (skill.target === "self") return [actor];
  const side = skill.target === "enemy" ? (actor.side === "ally" ? "enemy" : "ally") : actor.side;
  let cands = aliveUnits(state, side);
  if (skill.targetCells && skill.targetCells.length > 0) {
    cands = cands.filter((c) => skill.targetCells!.some((cell) => samePos(cell, c.pos)));
  }
  return cands;
}

/** 진영 그리드 크기(유닛 배치 기준, 최소 4×4) */
function sideDims(state: GameState, side: "ally" | "enemy"): { rows: number; cols: number } {
  let rows = 4;
  let cols = 4;
  for (const u of state.units) {
    if (u.side !== side) continue;
    rows = Math.max(rows, u.pos.row + 1);
    cols = Math.max(cols, u.pos.col + 1);
  }
  return { rows, cols };
}

/** 면적 모양 → 앵커 기준 영향 칸 목록. 엔진(효과 적용)과 웹(바닥 하이라이트)이 공유. */
export function computeAreaCells(anchor: Pos, area: AreaShape | undefined, rows: number, cols: number): Pos[] {
  const a = area ?? { kind: "single" as const };
  const cells: Pos[] = [];
  const push = (r: number, c: number) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) cells.push({ row: r, col: c });
  };
  switch (a.kind) {
    case "single": push(anchor.row, anchor.col); break;
    case "row": for (let c = 0; c < cols; c++) push(anchor.row, c); break;
    case "col": for (let r = 0; r < rows; r++) push(r, anchor.col); break;
    case "square": {
      const rad = a.radius ?? 1;
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) push(anchor.row + dr, anchor.col + dc);
      break;
    }
    case "cross": {
      const rad = a.radius ?? 1;
      push(anchor.row, anchor.col);
      for (let d = 1; d <= rad; d++) {
        push(anchor.row + d, anchor.col); push(anchor.row - d, anchor.col);
        push(anchor.row, anchor.col + d); push(anchor.row, anchor.col - d);
      }
      break;
    }
    case "all": for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) push(r, c); break;
  }
  return cells;
}

/** 면적 스킬의 영향 유닛 (앵커=대상 위치). single/all 외 모양은 풋프린트 내 같은 진영 유닛 */
function areaTargets(state: GameState, actor: Unit, skill: Skill, anchor: Unit | null): Unit[] {
  const side = skill.target === "enemy" ? (actor.side === "ally" ? "enemy" : "ally") : actor.side;
  const area = skill.area;
  if (skill.target === "self") return [actor];
  if (!area || area.kind === "single") return [anchor ?? actor];
  if (area.kind === "all") return validTargets(state, actor, skill); // 마스크 존중
  const a = (anchor ?? actor).pos;
  const dims = sideDims(state, side);
  const cells = computeAreaCells(a, area, dims.rows, dims.cols);
  return state.units.filter((u) => u.alive && u.side === side && cells.some((c) => c.row === u.pos.row && c.col === u.pos.col));
}

export function computeHitChance(actor: Unit, skill: Skill, target: Unit): number {
  if (skill.alwaysHit || skill.target !== "enemy") return 100;
  return clamp(Math.round(actor.accuracy + skill.accuracy - target.dex), 0, 100);
}

export function getLegalActions(state: GameState): LegalAction[] {
  if (state.phase !== "inProgress" || !state.current) return [];
  const actor = unitById(state, state.current.uid);

  if (isFrozen(actor)) {
    return [{ action: { type: "skip" }, label: "스킵 (빙결)" }];
  }

  const out: LegalAction[] = [];
  for (const skillId of actor.activeSkillIds) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    if ((actor.cooldowns[skillId] ?? 0) > 0) continue; // 쿨다운 중 (2.10)
    if (skill.usableFrom && skill.usableFrom.length > 0) {
      if (!skill.usableFrom.some((c) => samePos(c, actor.pos))) continue;
    }
    const targets = validTargets(state, actor, skill);
    if (targets.length === 0) continue; // 사정권에 대상 없음 → 사용 불가
    for (const tgt of targets) {
      out.push({
        action: { type: "skill", skillId, targetUid: tgt.uid },
        label: `${skill.name} → ${tgt.name}`,
        skillName: skill.name,
        targetUid: tgt.uid,
        hitChance: computeHitChance(actor, skill, tgt),
      });
    }
  }

  // 쓸 수 있는 기술이 하나도 없으면 효과 없는 스킵 (2.10)
  if (out.length === 0) {
    return [{ action: { type: "skip" }, label: "스킵 (쓸 수 있는 기술 없음)" }];
  }
  return out;
}

// ── 데미지/효과 적용 ────────────────────────────────────────────────────────

/** 쉴드 → HP 순으로 피해 적용 (2.9). 공포(쉴드 잠식)·관통(쉴드 무시)·불사(생존) 반영. */
function dealRawDamage(state: GameState, target: Unit, finalAmount: number, opts?: { ignoreShield?: boolean }): void {
  if (!target.alive || finalAmount <= 0) return;
  // 무적: 모든 피해 0 (백병원 등)
  if (statusFlag(target, "invincible")) {
    state.log.push({ t: "damage", targetUid: target.uid, base: finalAmount, final: 0, toShield: 0, toHp: 0 });
    return;
  }
  let remaining = finalAmount;
  let toShield = 0;

  if (!opts?.ignoreShield && target.shield > 0) {
    // 공포: 들어온 피해 1이 쉴드를 (스택)만큼 깎음 → 쉴드 실효 체력 = shield/mult (3.5)
    const fearN = totalStacks(target, "fear");
    const mult = Math.max(1, fearN);
    const absorbable = Math.floor(target.shield / mult); // 쉴드가 막을 수 있는 "피해량"
    const absorbedDmg = Math.min(remaining, absorbable);
    toShield = absorbedDmg * mult; // 실제 깎인 쉴드
    target.shield -= toShield;
    remaining -= absorbedDmg;
  }

  const toHp = remaining; // HP 깎는 효율은 불변 (관통이면 전부 여기로)
  target.hp = Math.max(0, target.hp - toHp);

  // 불사: HP 0 이하면 1로 버팀 (3.6)
  let saved = false;
  if (target.hp <= 0 && hasStatus(target, "undying")) {
    target.hp = 1;
    saved = true;
  }

  state.log.push({ t: "damage", targetUid: target.uid, base: finalAmount, final: finalAmount, toShield, toHp });
  if (target.hp <= 0 && !saved) {
    target.alive = false;
    state.log.push({ t: "death", uid: target.uid });
  }
}

/** 관통/쉴드 고려 HP 손실 미리보기. 타겟팅 UI용(0.2). */
export function previewHpLoss(state: GameState, attacker: Unit, skill: Skill, target: Unit): { hpLoss: number; shieldConsumed: number } {
  const dmg = previewDamage(state, attacker, skill);
  if (hasStatus(attacker, "pierce")) {
    return { hpLoss: Math.min(dmg, target.hp), shieldConsumed: 0 };
  }
  const mult = Math.max(1, totalStacks(target, "fear"));
  const absorbable = Math.floor(target.shield / mult);
  const absorbedDmg = Math.min(dmg, absorbable);
  return { hpLoss: Math.min(target.hp, dmg - absorbedDmg), shieldConsumed: absorbedDmg * mult };
}

/** 데미지 계산: (스킬상수 + 합연산보정[공위증/약화]) × 전역배율(동상) × crit. (3.7 순서) */
function computeDamage(actor: Unit, base: number, crit: boolean): number {
  let dmg = base + statusNumSum(actor, "dmgDealtFlat"); // 공위증(+)/약화(-) 합연산
  if (hasStatus(actor, "frost")) dmg *= STATUS_DEFS["frost"].damageDealtMult ?? 1; // 곱연산(전역)
  if (crit) dmg *= actor.critMult + statusNumSum(actor, "critMultAdd");
  return Math.max(0, Math.round(dmg));
}

function applyStatusInstance(
  state: GameState,
  target: Unit,
  source: Unit,
  defId: string,
  stacks: number,
  duration: number,
): void {
  const inst: StatusInstance = { defId, stacks, duration, sourceUid: source.uid };
  target.statuses.push(inst); // 인스턴스 합치지 않고 추가 (3.1 원장)
  state.log.push({ t: "statusApplied", targetUid: target.uid, statusId: defId, stacks, duration });
}

function moveUnit(state: GameState, u: Unit, deltaCol: number): void {
  const newCol = clamp(u.pos.col + deltaCol, 0, 3);
  if (newCol === u.pos.col) return;
  const dest: Pos = { row: u.pos.row, col: newCol };
  // 목적지에 살아있는 같은 편 유닛 있으면 이동 취소(막힘)
  const blocked = state.units.some((o) => o.alive && o.side === u.side && o !== u && samePos(o.pos, dest));
  if (blocked) return;
  const from = { ...u.pos };
  u.pos = dest;
  state.log.push({ t: "move", uid: u.uid, from, to: { ...dest } });
}

function resolveSkill(state: GameState, actor: Unit, skill: Skill, targetUid?: string): void {
  state.log.push({ t: "skillUsed", uid: actor.uid, skillId: skill.id, targetUid });

  // 시전자 자기 효과 1회 (광역 중복 방지)
  applySelfEffects(state, actor, skill);

  // 타겟 목록 결정 — 면적 모양 기반 (앵커 = 선택 대상)
  const anchor = skill.target !== "self" && targetUid ? unitById(state, targetUid) : null;
  const targets = areaTargets(state, actor, skill, anchor);

  for (const tgt of targets) {
    if (!tgt.alive) continue;
    if (skill.target === "enemy") {
      const chance = computeHitChance(actor, skill, tgt);
      if (!skill.alwaysHit && !state.rng.chance(chance)) {
        state.log.push({ t: "miss", uid: actor.uid, targetUid: tgt.uid, chance });
        continue;
      }
      const crit = state.rng.chance(critPctOf(actor));
      state.log.push({ t: "hit", uid: actor.uid, targetUid: tgt.uid, chance, crit });
      applyTargetEffects(state, actor, skill, tgt, crit);
    } else {
      applyTargetEffects(state, actor, skill, tgt, false); // self/ally: 명중 판정 없음
    }
  }
}

/** 시전자 자신에게 1회만 적용되는 효과 (광역 중복 방지): applyStatusSelf, move(self). */
function applySelfEffects(state: GameState, actor: Unit, skill: Skill): void {
  for (const eff of skill.effects) {
    if (eff.kind === "applyStatusSelf" && actor.alive) {
      applyStatusInstance(state, actor, actor, eff.statusId, eff.stacks, eff.duration);
    } else if (eff.kind === "move" && eff.who === "self" && actor.alive) {
      moveUnit(state, actor, eff.deltaCol);
    }
  }
}

/** 대상별 효과 (광역이면 타겟마다 호출). self 전용 효과는 건너뜀(applySelfEffects가 처리). */
function applyTargetEffects(state: GameState, actor: Unit, skill: Skill, target: Unit, crit: boolean): void {
  for (const eff of skill.effects) {
    switch (eff.kind) {
      case "damage": {
        const atk = getFormationBonus(state, actor, "attackPower");
        const up = actor.skillDmgBonus[skill.id] ?? 0;
        const final = computeDamage(actor, eff.amount + atk + up, crit);
        dealRawDamage(state, target, final, { ignoreShield: hasStatus(actor, "pierce") });
        break;
      }
      case "applyStatus":
        if (target.alive) applyStatusInstance(state, target, actor, eff.statusId, eff.stacks, eff.duration);
        break;
      case "cleanse": {
        const before = target.statuses.length;
        target.statuses = target.statuses.filter((s) => STATUS_DEFS[s.defId].buff);
        if (target.statuses.length !== before) state.log.push({ t: "cleanse", targetUid: target.uid });
        break;
      }
      case "shield": {
        const def = getFormationBonus(state, actor, "defensePower");
        const amt = Math.round(eff.amount + def);
        target.shield += amt;
        state.log.push({ t: "shieldGain", targetUid: target.uid, amount: amt });
        break;
      }
      case "heal": {
        const def = getFormationBonus(state, actor, "defensePower");
        const before = target.hp;
        target.hp = Math.min(target.hpMax, target.hp + Math.round(eff.amount + def));
        state.log.push({ t: "heal", targetUid: target.uid, amount: target.hp - before });
        break;
      }
      case "move":
        if (eff.who === "target" && target.alive) moveUnit(state, target, eff.deltaCol);
        break;
      // applyStatusSelf, move(self) → applySelfEffects에서 1회 처리
    }
  }
}

/**
 * 이 행동이 발생시킬 끼어들기의 **주체 uid 목록** — 모든 출처 종합 (2.11).
 * 출처: ① 스킬 grantsInterrupt(주체=self 또는 대상 아군) ② 보유 버프/상태(grantsInterrupt, 주체=보유자) ③ 향후 특성.
 * 주체가 행동자 본인이 아닐 수 있음(서포트가 다른 아군을 끼어들기시킴).
 * 실행(step)과 미리보기(웹)가 이 함수를 공유 → 분기 없음.
 */
export function predictInterruptSubjects(state: GameState, actor: Unit, skill: Skill | null, targetUid?: string): string[] {
  const subjects: string[] = [];
  if (skill?.grantsInterrupt) {
    const subj = skill.grantsInterruptTo === "target" ? targetUid : actor.uid;
    if (subj) for (let i = 0; i < skill.grantsInterrupt; i++) subjects.push(subj);
  }
  for (const s of actor.statuses) {
    if (STATUS_DEFS[s.defId].grantsInterrupt && s.stacks > 0) subjects.push(actor.uid); // 버프 1건당 1회(보유자)
  }
  return subjects;
}

/** 끼어들기 칸(주체별)을 현재 칸 바로 뒤에 동적 삽입 (2.11). */
function insertInterrupts(state: GameState, subjects: string[]): void {
  // 역순 삽입으로 subjects 순서가 보존되도록 (모두 cursor+1에 꽂음)
  for (let i = subjects.length - 1; i >= 0; i--) {
    state.roundOrder.splice(state.cursor + 1, 0, { uid: subjects[i], kind: "interrupt", spd: 0 });
    state.log.push({ t: "interrupt", uid: subjects[i] });
  }
}

// ── 스텝(행동 1회 처리) ──────────────────────────────────────────────────────

export function step(state: GameState, action: Action): GameState {
  if (state.phase !== "inProgress" || !state.current) return state;
  const entry = state.current;
  const actor = unitById(state, entry.uid);

  if (action.type === "skip") {
    const reason = isFrozen(actor) ? "frozen" : "noUsableSkill";
    state.log.push({ t: "skip", uid: actor.uid, reason });
  } else {
    const skill = SKILLS[action.skillId];
    if (!skill) throw new Error(`unknown skill: ${action.skillId}`);
    // 합법성 최소 검증
    if ((actor.cooldowns[action.skillId] ?? 0) > 0 || isFrozen(actor)) {
      throw new Error(`illegal action: ${action.skillId} (cooldown/frozen)`);
    }
    // 출혈: 행동 시 발동 (정규 + 끼어들기 모두, 2.11)
    tickPeriodic(state, actor, "onAction");
    if (actor.alive) {
      // 쿨타임은 사용 즉시 설정(끼어들기에서도 설정됨; 단 '감소'만 끼어들기서 안 됨)
      actor.cooldowns[action.skillId] = skill.cooldown;
      resolveSkill(state, actor, skill, action.targetUid);
      // 끼어들기: 정규 턴에서만, 모든 출처(스킬+버프) 종합. 주체는 self/대상아군 (2.11). 끼어들기 턴은 연쇄 방지로 제외.
      if (entry.kind === "normal") insertInterrupts(state, predictInterruptSubjects(state, actor, skill, action.targetUid));
    }
  }

  // 턴 종료 처리 — 정규 턴만 (끼어들기는 차감/주기효과 없음, 2.11)
  if (entry.kind === "normal" && actor.alive) onNormalTurnEnd(state, actor);

  state.current = null;
  if (checkWin(state)) return state;
  advance(state);
  return state;
}

// ── 승패 (7.3) ───────────────────────────────────────────────────────────────

function checkWin(state: GameState): boolean {
  if (state.phase !== "inProgress") return true;
  const alliesAlive = aliveUnits(state, "ally").length;
  const enemiesAlive = aliveUnits(state, "enemy").length;
  if (enemiesAlive === 0) {
    state.phase = "allyWin";
    state.log.push({ t: "battleEnd", phase: "allyWin" });
    return true;
  }
  if (alliesAlive === 0) {
    state.phase = "enemyWin";
    state.log.push({ t: "battleEnd", phase: "enemyWin" });
    return true;
  }
  return false;
}

// 내부 헬퍼 export (관측/AI에서 사용)
export { unitById, totalStacks, isFrozen };
