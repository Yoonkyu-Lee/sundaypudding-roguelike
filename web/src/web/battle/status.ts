// 상태이상 칩 + 상세 팝오버 (3.1 원장: 스택/지속/다음변화/출처). 호버·포커스(클릭)로 펼침 — JS 불필요.
// 거동 설명은 STATUS_DEFS(데이터)에서 생성. 출처는 관측(UnitView.statuses.sources)에서.
import type { StatusDef, UnitView } from "../../contract/types.ts";
import { STATUS_DEFS } from "../../data/statuses.ts";
import { esc } from "./shared.ts";

const TRIG: Record<string, string> = { turnStart: "턴 시작 시", turnEnd: "턴 종료 시", onAction: "행동 시" };

/** StatusDef 거동 필드 → 사람 가독 효과 설명 (프리미티브를 텍스트로). */
export function describeStatus(def: StatusDef | undefined): string {
  if (!def) return "특수 효과";
  const p: string[] = [];
  if (def.dot) p.push(`${TRIG[def.dot.trigger]} 스택당 ${def.dot.dmgPerStack} 피해`);
  if (def.hot) p.push(`${TRIG[def.hot.trigger]} 스택당 ${def.hot.healPerStack} 회복`);
  if (def.actionDenial) p.push("이번 턴 행동 불가");
  if (def.damageDealtMult !== undefined) p.push(`주는 피해 ×${def.damageDealtMult / 100}`); // 정수 퍼센트(50=×0.5)
  if (def.shieldShred) p.push("받는 피해가 쉴드를 스택만큼 가속 잠식 (HP 효율 불변)");
  if (def.pierce) p.push("공격이 쉴드를 무시하고 HP 직접");
  if (def.undying) p.push("HP 0 이하로 안 죽음 (1턴 생존)");
  if (def.grantsInterrupt) p.push("정규 턴 행동 시 끼어들기 발생");
  if (def.dmgDealtFlat !== undefined) p.push(`주는 피해 ${def.dmgDealtFlat > 0 ? "+" : ""}${def.dmgDealtFlat} (합연산)`);
  if (def.critChanceAdd) p.push(`치명 확률 +${def.critChanceAdd}%`);
  if (def.critMultiplierAdd) p.push(`치명 배수 +${def.critMultiplierAdd / 100}`); // 정수 퍼센트(50=+0.5)
  if (def.invincible) p.push("모든 피해 0");
  if (def.taunt) p.push("적 공격이 이 유닛에 집중");
  if (def.speedMod) p.push(`SPD ${def.speedMod > 0 ? "+" : ""}${def.speedMod} → 서열 ${def.speedMod > 0 ? "당김" : "밀림"}`);
  return p.join(" · ") || "특수 효과";
}

/** 한 상태이상 칩 + 펼침 팝오버. 칩=버튼(호버/클릭 펼침), sup=스택 sub=남은턴. */
function chip(s: UnitView["statuses"][number]): string {
  const def = STATUS_DEFS[s.id];
  const cls = def?.buff ? "buff" : "debuff";
  const srcRow = s.sources.length
    ? `<span class="poprow src"><span>출처</span><b>${s.sources.map((x) => `${esc(x.unit)}${x.via ? ` — 「${esc(x.via)}」` : ""}`).join(", ")}</b></span>`
    : "";
  const changeRow = s.nextChange !== s.duration
    ? `<span class="poprow"><span>다음 변화</span><b>${s.nextChange}턴 후</b></span>`
    : "";
  const pop = `<span class="statuspop ${cls}">
      <span class="poptitle">${s.icon} ${esc(def?.name ?? s.id)}<em>${def?.buff ? "버프" : "디버프"}</em></span>
      <span class="popdesc">${esc(describeStatus(def))}</span>
      <span class="poprow"><span>스택</span><b>${s.stacks}</b></span>
      <span class="poprow"><span>남은 턴</span><b>${s.duration}</b></span>
      ${changeRow}${srcRow}
    </span>`;
  return `<button class="chip ${cls}" type="button" aria-label="${esc(def?.name ?? s.id)}">${s.icon}<sup>${s.stacks}</sup><sub>${s.duration}</sub>${pop}</button>`;
}

/** 상태 칩 묶음 — 분해된 statuses 배열에서 (유닛카드·캐릭터 시트 공용). */
export function statusChipsList(statuses: UnitView["statuses"]): string {
  return statuses.map(chip).join("");
}
export function statusChips(u: UnitView): string {
  return statusChipsList(u.statuses);
}
