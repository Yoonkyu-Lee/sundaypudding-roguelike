// 스킬 해소 + 효과 디스패치 (2.5~3.9). 시전자 자기효과 1회 / 대상별 효과 / 동적 재배치.
import type { GameState, Pos, Skill, Unit } from "../types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { clamp, critPctOf, hasStatus, samePos, unitById } from "../util.ts";
import { computeDamage, dealRawDamage } from "./damage.ts";
import { applyStatusInstance } from "./status.ts";
import { getFormationBonus } from "./formation.ts";
import { areaTargets, computeHitChance } from "./targeting.ts";

/** 앵커(주 대상) 유닛 uid 해소 — targetUid > targetCell/cells[0]의 대상 진영 유닛. 끼어들기 주체 해소에 공유(2.11). */
export function resolveAnchorUid(
  state: GameState,
  actor: Unit,
  skill: Skill,
  sel: { targetUid?: string; targetCell?: Pos; cells?: Pos[] },
): string | undefined {
  if (sel.targetUid) return sel.targetUid;
  if (skill.target === "self") return actor.uid;
  const pos = sel.targetCell ?? sel.cells?.[0];
  if (!pos) return undefined;
  const side = skill.target === "enemy" ? (actor.side === "ally" ? "enemy" : "ally") : actor.side;
  return state.units.find((u) => u.alive && u.side === side && samePos(u.pos, pos))?.uid;
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

/** 시전자 자신에게 1회만 적용되는 효과 (광역 중복 방지): applyStatusSelf, move(self). */
function applySelfEffects(state: GameState, actor: Unit, skill: Skill): void {
  for (const eff of skill.effects) {
    if (eff.kind === "applyStatusSelf" && actor.alive) {
      applyStatusInstance(state, actor, actor, eff.statusId, eff.stacks, eff.duration, skill.id);
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
        if (target.alive) applyStatusInstance(state, target, actor, eff.statusId, eff.stacks, eff.duration, skill.id);
        break;
      case "cleanse": {
        const before = target.statuses.length;
        target.statuses = target.statuses.filter((s) => STATUS_DEFS[s.defId].buff);
        if (target.statuses.length !== before) state.log.push({ t: "cleanse", targetUid: target.uid });
        break;
      }
      case "shield": {
        const def = getFormationBonus(state, actor, "defensePower");
        const amt = Math.round(eff.amount + def) + target.equipShieldGainAdd; // 방어구 쉴드 획득량 보정(받는 쪽, 4.3)
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

export function resolveSkill(
  state: GameState,
  actor: Unit,
  skill: Skill,
  sel: { targetUid?: string; targetCell?: Pos; cells?: Pos[] },
): void {
  state.log.push({ t: "skillUsed", uid: actor.uid, skillId: skill.id, targetUid: sel.targetUid });

  // 시전자 자기 효과 1회 (광역 중복 방지)
  applySelfEffects(state, actor, skill);

  // 앵커 칸: 명시 칸 > 대상 유닛 위치 > 시전자 위치
  const anchor: Pos = sel.targetCell ?? (sel.targetUid ? unitById(state, sel.targetUid).pos : actor.pos);
  const targets = areaTargets(state, actor, skill, anchor, sel.cells);

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
