// 데미지/피해 적용 (2.5/2.9/3.7) — 스킬 상수 데미지, 쉴드·공포·관통·불사, 미리보기.
import type { GameState, Skill, Unit } from "../types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { hasStatus, statusFlag, statusNumSum, totalStacks } from "../util.ts";
import { getFormationBonus } from "./formation.ts";

/** 데미지 계산: (스킬상수 + 합연산보정[공위증/약화]) × 전역배율(동상) × crit. (3.7 순서) */
export function computeDamage(actor: Unit, base: number, crit: boolean): number {
  let dmg = base + statusNumSum(actor, "dmgDealtFlat"); // 공위증(+)/약화(-) 합연산
  if (hasStatus(actor, "frost")) dmg *= STATUS_DEFS["frost"].damageDealtMult ?? 1; // 곱연산(전역)
  if (crit) dmg *= actor.critMult + statusNumSum(actor, "critMultAdd");
  return Math.max(0, Math.round(dmg));
}

/** 쉴드 → HP 순으로 피해 적용 (2.9). 공포(쉴드 잠식)·관통(쉴드 무시)·불사(생존) 반영. */
export function dealRawDamage(state: GameState, target: Unit, finalAmount: number, opts?: { ignoreShield?: boolean }): void {
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
