// 상태이상 적용 + 주기 틱 (3.1/3.5/3.6). 쿼리는 util.ts, 여기는 변경(적용/틱).
import type { GameState, StatusInstance, Unit } from "../types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { dealRawDamage } from "./damage.ts";

export function applyStatusInstance(
  state: GameState,
  target: Unit,
  source: Unit,
  defId: string,
  stacks: number,
  duration: number,
  sourceSkillId?: string, // 부여 출처 스킬 (3.1 원장 — 팝오버 "유닛 — 스킬" 표시용)
): void {
  const inst: StatusInstance = { defId, stacks, duration, sourceUid: source.uid, sourceSkillId };
  target.statuses.push(inst); // 인스턴스 합치지 않고 추가 (3.1 원장)
  state.log.push({ t: "statusApplied", targetUid: target.uid, statusId: defId, stacks, duration });
}

/** 같은 트리거의 DoT/HoT를 defId별 합산해 적용 (3.5). */
export function tickPeriodic(state: GameState, u: Unit, trigger: "turnStart" | "turnEnd" | "onAction"): void {
  if (!u.alive) return;
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
