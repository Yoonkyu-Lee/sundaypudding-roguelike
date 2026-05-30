// ─────────────────────────────────────────────────────────────────────────
// 전투 코어 엔진 — 순수·결정론. 상태 + 행동 → 다음 상태. (8.1)
// 렌더링 의존 0. 모든 무작위는 state.rng(시드)에서만. (8.3)
// ─────────────────────────────────────────────────────────────────────────

import { Rng } from "./rng.ts";
import type {
  Action,
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

// ── 전투 생성 ────────────────────────────────────────────────────────────────

function makeUnit(p: Placement, side: "ally" | "enemy", idx: number): Unit {
  const c = CHARACTERS[p.charId];
  if (!c) throw new Error(`character not found: ${p.charId}`);
  return {
    uid: `${side[0]}${idx}_${c.id}`,
    side,
    charId: c.id,
    name: c.name,
    pos: { ...p.pos },
    hpMax: c.hp,
    hp: c.hp,
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
  };
}

export function createBattle(seed: number, enc: Encounter): GameState {
  const units: Unit[] = [
    ...enc.allies.map((p, i) => makeUnit(p, "ally", i)),
    ...enc.enemies.map((p, i) => makeUnit(p, "enemy", i)),
  ];
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
      total += computeDamage(actor, eff.amount + atk, false);
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
    spd: state.rng.int(u.spdMin, u.spdMax), // 라운드마다 SPD 주사위 (2.2)
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

/** 데미지 계산: (스킬상수) × 전역배율(동상) × crit. (3.7 순서) */
function computeDamage(actor: Unit, base: number, crit: boolean): number {
  let dmg = base;
  if (hasStatus(actor, "frost")) dmg *= STATUS_DEFS["frost"].damageDealtMult ?? 1; // 곱연산(전역)
  if (crit) dmg *= actor.critMult;
  return Math.round(dmg);
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

  const primaryTarget =
    skill.target === "self" ? actor : targetUid ? unitById(state, targetUid) : actor;

  // 적 대상 스킬: 명중 판정 (2.7)
  if (skill.target === "enemy") {
    const chance = computeHitChance(actor, skill, primaryTarget);
    if (!skill.alwaysHit && !state.rng.chance(chance)) {
      state.log.push({ t: "miss", uid: actor.uid, targetUid: primaryTarget.uid, chance });
      return;
    }
    const crit = state.rng.chance(actor.critPct);
    state.log.push({ t: "hit", uid: actor.uid, targetUid: primaryTarget.uid, chance, crit });
    applyEffects(state, actor, skill, primaryTarget, crit);
  } else {
    // self/ally: 명중 판정 없음
    applyEffects(state, actor, skill, primaryTarget, false);
  }
}

function applyEffects(state: GameState, actor: Unit, skill: Skill, target: Unit, crit: boolean): void {
  for (const eff of skill.effects) {
    switch (eff.kind) {
      case "damage": {
        // 공격 스킬 위력 += 포메이션 attackPower (합연산, 6.1 → 3.7 순서)
        const atk = getFormationBonus(state, actor, "attackPower");
        const final = computeDamage(actor, eff.amount + atk, crit);
        // 관통: 공격자가 보유 시 쉴드 무시 (3.6)
        dealRawDamage(state, target, final, { ignoreShield: hasStatus(actor, "pierce") });
        break;
      }
      case "applyStatus":
        if (target.alive) applyStatusInstance(state, target, actor, eff.statusId, eff.stacks, eff.duration);
        break;
      case "shield": {
        // 방어 스킬 위력 += 포메이션 defensePower (합연산)
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
      case "move": {
        const who = eff.who === "self" ? actor : target;
        if (who.alive) moveUnit(state, who, eff.deltaCol);
        break;
      }
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
