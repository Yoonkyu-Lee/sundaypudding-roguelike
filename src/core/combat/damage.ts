// 데미지/피해 적용 (2.5/2.9/3.7) — 스킬 상수 데미지, 쉴드·공포·관통·불사, 미리보기.
import type { GameState, Skill, Unit } from "../types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { hasStatus, statMod, statusFlag, statusNumSum, totalStacks } from "../util.ts";
import { getFormationBonus } from "./formation.ts";
import { fireTrigger } from "./passives/index.ts";

/** 데미지 계산: (스킬상수 + 무기보정 + 합연산보정[공위증/약화]) × 전역배율(동상) × crit. (3.7 순서) */
export function computeDamage(actor: Unit, base: number, crit: boolean): number {
  let dmg = base + actor.equipDmgFlat + statusNumSum(actor, "dmgDealtFlat"); // 무기 dmgFlat(4.3) + 공위증(+)/약화(-)
  if (hasStatus(actor, "frost")) dmg *= STATUS_DEFS["frost"].damageDealtMult ?? 1; // 곱연산(전역)
  if (crit) dmg *= actor.critMultiplier + statMod(actor, "critMultiplier") + statusNumSum(actor, "critMultiplierAdd");
  return Math.max(0, Math.round(dmg));
}

/** 쉴드 → HP 순으로 피해 적용 (2.9). 공포(쉴드 잠식)·관통(쉴드 무시)·불사(생존) 반영. */
export function dealRawDamage(state: GameState, target: Unit, finalAmount: number, opts?: { ignoreShield?: boolean; attackerUid?: string; crit?: boolean }): void {
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
  const died = target.hp <= 0 && !saved;
  if (died) {
    target.alive = false;
    state.log.push({ t: "death", uid: target.uid });
  }
  // 패시브 훅: 피격(피해자 관점) / 가해(가해자 관점) / 처치 / 사망
  const a = opts?.attackerUid;
  fireTrigger(state, { on: "damaged", subjectUid: target.uid, attackerUid: a, damage: finalAmount, crit: opts?.crit });
  if (a) fireTrigger(state, { on: "dealtDamage", attackerUid: a, subjectUid: target.uid, damage: finalAmount, crit: opts?.crit });
  if (died) {
    fireTrigger(state, { on: "death", subjectUid: target.uid, attackerUid: a });
    if (a) fireTrigger(state, { on: "kill", attackerUid: a, subjectUid: target.uid });
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

/** 데미지 분해(자세히 보기용): 기본(스킬상수)·포메이션·강화·무기·공위증/약화 등 원인별 기여 + 최종. 데미지 스킬 아니면 null. */
export function previewDamageParts(state: GameState, actor: Unit, skill: Skill): { total: number; parts: { label: string; amount: number }[] } | null {
  const dmgEffs = skill.effects.filter((e) => e.kind === "damage");
  if (!dmgEffs.length) return null;
  const n = dmgEffs.length;
  const base = dmgEffs.reduce((s, e) => s + (e.kind === "damage" ? e.amount : 0), 0);
  const atk = getFormationBonus(state, actor, "attackPower") * n;
  const up = (actor.skillDmgBonus[skill.id] ?? 0) * n;
  const weapon = actor.equipDmgFlat * n;
  const status = statusNumSum(actor, "dmgDealtFlat") * n; // 공위증(+)/약화(−)
  const parts: { label: string; amount: number }[] = [{ label: "기본", amount: base }];
  if (atk) parts.push({ label: "포메이션", amount: atk });
  if (up) parts.push({ label: "강화", amount: up });
  if (weapon) parts.push({ label: "무기", amount: weapon });
  if (status) parts.push({ label: status > 0 ? "공위증" : "약화", amount: status });
  if (hasStatus(actor, "frost")) parts.push({ label: "동상", amount: 0 }); // ×배율(곱연산) — 라벨만, 최종에 반영됨
  return { total: previewDamage(state, actor, skill), parts };
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
