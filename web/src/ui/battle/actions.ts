// 행동 패널: 스킬 선택 모드(균일 카드 4개) vs 타겟팅 모드. 스킬 설명은 skillDesc(데이터).
// GameState 비의존 — 현재 행동자의 활성 스킬 바(SkillBarEntry[]: 순서·쿨·피해미리보기)를 받음(TS=state 계산, Rust=battle_view IPC).
import type { Observation } from "../../contract/types.ts";
import { SKILLS } from "../../content/skills.ts";
import { esc, type SkillBarEntry, type Ui } from "./shared.ts";
import { skillCardBody, skillInline, skillType } from "./skillDesc.ts";

/** 자세히 보기: 피해 원인 분해 한 줄 (기본 12 · 무기 +3 · 포메이션 +2 = 17). */
function breakdownLine(parts?: SkillBarEntry["parts"]): string {
  if (!parts) return "";
  const ps = parts.parts.map((p) => (p.label === "기본" ? `기본 ${p.amount}` : p.label === "동상" ? "동상 ×" : `${p.label} ${p.amount >= 0 ? "+" : ""}${p.amount}`)).join(" · ");
  return `<span class="skbreak">${ps} = <b>${parts.total}</b></span>`;
}

export function actionPanel(obs: Observation, bar: SkillBarEntry[], ui: Ui): string {
  if (obs.phase !== "inProgress") {
    return `<div class="actions"><div class="result">${obs.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}</div></div>`;
  }
  if (obs.current?.side !== "ally") {
    return `<div class="actions"><div class="enemyturn">적(${esc(obs.current?.name ?? "")}) 행동 중…</div></div>`;
  }
  const onlySkip = obs.legalActions.length === 1 && obs.legalActions[0].action.type === "skip";
  if (onlySkip) {
    return `<div class="actions"><div class="prompt">▶ ${esc(obs.current.name)}</div><button class="act skip" id="skipbtn">${esc(obs.legalActions[0].label)}</button></div>`;
  }

  const usable = new Set<string>();
  for (const la of obs.legalActions) if (la.action.type === "skill") usable.add(la.action.skillId);
  const dmgOf = (id: string) => bar.find((e) => e.skillId === id)?.effDmg;

  if (ui.selectedSkillId) {
    const sk = SKILLS[ui.selectedSkillId];
    return `<div class="actions targeting">
      <div class="prompt">🎯 「${esc(sk.name)}」 대상 선택 — 칸 클릭 <span class="skinline">${esc(skillInline(sk, dmgOf(ui.selectedSkillId)))}</span></div>
      <button class="act cancel" id="cancelbtn">취소 (Esc)</button>
    </div>`;
  }

  // 스킬 선택: 활성 스킬 4개를 균일 카드로 (쿨/사정권 상태 반영)
  const cards = bar.map((entry) => {
    const id = entry.skillId;
    const sk = SKILLS[id];
    if (!sk) return "";
    const cd = entry.cooldown;
    const disabled = cd > 0 || !usable.has(id);
    const reason = cd > 0 ? `쿨 ${cd}` : !usable.has(id) ? "사정권 없음" : "";
    const attrs = disabled ? "disabled" : `data-skill="${id}"`;
    const brk = ui.sheetDetail ? breakdownLine(entry.parts) : "";
    return `<button class="skcard t-${skillType(sk).key} ${disabled ? "disabled" : ""}" ${attrs}>
      <span class="skhead"><span class="skname">${esc(sk.name)}</span>${reason ? `<span class="skreason">${reason}</span>` : ""}</span>
      ${skillCardBody(sk, entry.effDmg)}${brk}
    </button>`;
  }).join("");
  // 대기: 아무것도 안 하고 턴 넘기기 (항상 노출, 쿨 소모 없음) + 자세히(피해 분해) 토글
  const detailBtn = `<button class="detail-toggle${ui.sheetDetail ? " on" : ""}" id="detailbtn">${ui.sheetDetail ? "자세히 ✓" : "자세히"}</button>`;
  return `<div class="actions skillsel"><div class="prompt">▶ ${esc(obs.current.name)}의 턴 — 스킬 선택 ${detailBtn}</div><div class="skgrid">${cards}</div><button class="act skip wait" id="skipbtn">⏭ 대기 (턴 넘김)</button></div>`;
}
