// 패시브/특성 룰 → 사람이 읽는 한 줄 (when · if → then). core 순수성 위해 web 전용.
import type { Condition, Effect, EffTarget, PassiveRule, Skill, Trigger } from "../../contract/types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { SKILLS } from "../../data/skills.ts";

const CMP: Record<string, string> = { lt: "<", lte: "≤", eq: "=", gte: "≥", gt: ">" };
const TGT: Record<EffTarget, string> = { self: "자신", subject: "상대", target: "대상", allAllies: "아군 전체", allEnemies: "적 전체", otherAllies: "아군(자신 제외)", otherEnemies: "적(대상 제외)", randomEnemy: "무작위 적", randomAlly: "무작위 아군" };
const STAT: Record<string, string> = { accuracy: "명중", evasion: "회피", critChance: "치명%", critMultiplier: "치명배수", speedMin: "속도하한", speedMax: "속도상한" };
const sName = (id: string) => STATUS_DEFS[id]?.name ?? id;
const who = (w: string) => (w === "self" ? "자신" : w === "subject" ? "상대" : "대상");
const NODE: Record<string, string> = { start: "시작", battle: "전투", elite: "정예", shop: "상점", encounter: "이벤트", rest: "휴식", boss: "보스" };
const node = (t?: string) => (t ? NODE[t] ?? t : "노드");

function whenText(t: Trigger): string {
  switch (t.on) {
    case "battleStart": return "전투 시작 시";
    case "roundStart": return "라운드 시작 시";
    case "roundEnd": return "라운드 종료 시";
    case "turnStart": return t.who && t.who !== "self" ? `${t.who === "ally" ? "아군" : t.who === "enemy" ? "적" : "누군가"} 턴 시작 시` : "내 턴 시작 시";
    case "turnEnd": return "내 턴 종료 시";
    case "everyNTurns": return `${t.n}턴마다`;
    case "interruptStart": return "끼어들기 시";
    case "speedRoll": return "주사위 굴릴 때";
    case "beforeAction": return "행동 직전";
    case "skillUsed": return t.skillId ? `「${SKILLS[t.skillId]?.name ?? t.skillId}」 사용 시` : "스킬 사용 시";
    case "onMove": return "이동 시";
    case "enterCell": return "특정 칸 진입 시";
    case "onHit": return `명중 시${t.crit ? "(치명타)" : ""}`;
    case "onMiss": return "빗나갈 때";
    case "dealtDamage": return "피해를 줄 때";
    case "damaged": return "피격 시";
    case "onHeal": return "회복 시";
    case "onShieldGain": return "쉴드 획득 시";
    case "statusApplied": return t.statusId ? `${sName(t.statusId)} 부여 시` : "상태이상 부여 시";
    case "statusTick": return t.statusId ? `${sName(t.statusId)} 지속 시` : "지속효과 발동 시";
    case "kill": return "적 처치 시";
    case "death": return t.who === "ally" ? "아군이 쓰러질 때" : t.who === "enemy" ? "적이 쓰러질 때" : "쓰러질 때";
    case "battleEnd": return t.result === "win" ? "승리 시" : t.result === "lose" ? "패배 시" : "전투 종료 시";
    case "nodeEnter": return `${node(t.nodeType)} 진입 시`;
    case "nodeClear": return `${node(t.nodeType)} 클리어 시`;
    case "actStart": return "액트 시작 시";
    case "goldGain": return "골드 획득 시";
    case "partyHpChange": return t.dir === "heal" ? "파티 회복 시" : t.dir === "hurt" ? "파티 피해 시" : "파티 HP 변화 시";
  }
}

function ifText(c: Condition): string {
  switch (c.c) {
    case "hpPct": return `${who(c.who)} 체력 ${CMP[c.cmp]}${c.v}%`;
    case "round": return `라운드 ${CMP[c.cmp]}${c.v}`;
    case "selfTurnCount": return `내 턴수 ${CMP[c.cmp]}${c.v}`;
    case "everyN": return `${c.of === "round" ? "라운드" : "내 턴"} ${c.n}의 배수`;
    case "firstTurn": return "첫 턴";
    case "hasStatus": return `${who(c.who)} ${sName(c.statusId)} 보유`;
    case "missingStatus": return `${who(c.who)} ${sName(c.statusId)} 없음`;
    case "atColumn": return `${who(c.who)} 열 ${CMP[c.cmp]}${c.v}`;
    case "atRow": return `${who(c.who)} 행 ${CMP[c.cmp]}${c.v}`;
    case "atCell": return `${who(c.who)} (${c.row},${c.col})`;
    case "isFrontline": return `${who(c.who)} 최전열`;
    case "sideCount": return `${c.side === "ally" ? "아군" : "적"} 수 ${CMP[c.cmp]}${c.v}`;
    case "outnumbered": return "수적 열세";
    case "subjectCharId": return `상대=${c.charId}`;
    case "subjectSide": return `상대 ${c.side === "ally" ? "아군" : "적"}`;
    case "wasCrit": return "치명타였음";
    case "damageAtLeast": return `피해 ≥${c.v}`;
    case "skillIs": return `「${SKILLS[c.skillId]?.name ?? c.skillId}」`;
    case "chance": return `${c.pct}% 확률`;
    case "nodeTypeIs": return `${node(c.nodeType)} 노드`;
    case "goldAtLeast": return `골드 ≥${c.v}`;
  }
}

function thenText(e: Effect): string {
  switch (e.do) {
    case "damage": return `${TGT[e.target]}에 ${e.amount} 피해`;
    case "heal": return `${TGT[e.target]} ${e.amount} 회복`;
    case "shield": return `${TGT[e.target]} 쉴드 +${e.amount}`;
    case "applyStatus": return `${TGT[e.target]}에 ${sName(e.statusId)} ${e.stacks}×${e.duration}턴`;
    case "cleanse": return `${TGT[e.target]} 정화`;
    case "move": return `${TGT[e.target]} ${e.deltaCol < 0 ? "전진" : "후퇴"}`;
    case "grantInterrupt": return `${TGT[e.target]} 끼어들기${e.count > 1 ? ` ×${e.count}` : ""}`;
    case "statMod": return `${TGT[e.target]} ${STAT[e.stat] ?? e.stat} ${e.delta >= 0 ? "+" : ""}${e.delta}`;
    case "modCooldown": return `${TGT[e.target]} 쿨다운 ${e.delta >= 0 ? "+" : ""}${e.delta}`;
    case "modSpeedRoll": return `주사위 ${e.delta >= 0 ? "+" : ""}${e.delta}`;
    case "rerollSpeed": return "주사위 재굴림";
    case "goldDelta": return `골드 ${e.amount >= 0 ? "+" : ""}${e.amount}`;
    case "healParty": return `파티 ${Math.round(e.pct * 100)}% 회복`;
    case "grantRunStatus": return `${TGT[e.target]} ${sName(e.statusId)} ${e.stacks}×${e.duration}턴(다음 전투)`;
    case "healByDamage": return `${TGT[e.target]} 가한 피해 ${e.pct}% 흡혈`;
    case "reflectByDamage": return `${TGT[e.target]}에 받은 피해 ${e.pct}% 반사`;
    case "removeStatus": return `${TGT[e.target]} ${sName(e.statusId)} 제거`;
    case "castSkill": return `「${SKILLS[e.skillId]?.name ?? e.skillId}」 자동 시전`;
    case "showDialog": return `대사: ${e.speaker ? `${e.speaker} — ` : ""}"${e.text}"`;
  }
}

/** 한 룰 → "when · if → then" 한 줄. */
export function describeRule(rule: PassiveRule): string {
  const head = [whenText(rule.when), ...(rule.if ?? []).map(ifText)].join(" · ");
  return `${head} → ${rule.then.map(thenText).join(", ")}`;
}

/** 스킬의 패시브 파트 설명들(없으면 빈 배열). */
export function describeSkillPassives(sk: Skill): string[] {
  return (sk.passives ?? []).map(describeRule);
}
