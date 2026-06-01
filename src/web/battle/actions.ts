// 행동 패널: 스킬 선택 모드(균일 카드 4개) vs 타겟팅 모드. 스킬 설명은 skillDesc(데이터).
import type { GameState, Observation, Unit } from "../../core/types.ts";
import { previewDamage, previewDamageParts } from "../../core/engine.ts";
import { SKILLS } from "../../data/skills.ts";
import { esc, type Ui } from "./shared.ts";
import { skillCardBody, skillInline, skillType } from "./skillDesc.ts";

/** 시전자 실피해(무기 dmgFlat·강화·포메이션 반영). 데미지 스킬만, 아니면 undefined. */
function effDmgOf(state: GameState, actor: Unit, skillId: string): number | undefined {
  const sk = SKILLS[skillId];
  return sk?.effects.some((e) => e.kind === "damage") ? previewDamage(state, actor, sk) : undefined;
}

/** 자세히 보기: 피해 원인 분해 한 줄 (기본 12 · 무기 +3 · 포메이션 +2 = 17). 데미지 스킬만. */
function breakdownLine(state: GameState, actor: Unit, skillId: string): string {
  const b = previewDamageParts(state, actor, SKILLS[skillId]);
  if (!b) return "";
  const parts = b.parts.map((p) => (p.label === "기본" ? `기본 ${p.amount}` : p.label === "동상" ? "동상 ×" : `${p.label} ${p.amount >= 0 ? "+" : ""}${p.amount}`)).join(" · ");
  return `<span class="skbreak">${parts} = <b>${b.total}</b></span>`;
}

export function actionPanel(obs: Observation, state: GameState, ui: Ui): string {
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

  const actor = state.units.find((u) => u.uid === obs.current!.uid)!;
  const usable = new Set<string>();
  for (const la of obs.legalActions) if (la.action.type === "skill") usable.add(la.action.skillId);

  if (ui.selectedSkillId) {
    const sk = SKILLS[ui.selectedSkillId];
    return `<div class="actions targeting">
      <div class="prompt">🎯 「${esc(sk.name)}」 대상 선택 — 칸 클릭 <span class="skinline">${esc(skillInline(sk, effDmgOf(state, actor, ui.selectedSkillId)))}</span></div>
      <button class="act cancel" id="cancelbtn">취소 (Esc)</button>
    </div>`;
  }

  // 스킬 선택: 활성 스킬 4개를 균일 카드로 (쿨/사정권 상태 반영)
  const cards = actor.activeSkillIds.map((id) => {
    const sk = SKILLS[id];
    if (!sk) return "";
    const cd = actor.cooldowns[id] ?? 0;
    const disabled = cd > 0 || !usable.has(id);
    const reason = cd > 0 ? `쿨 ${cd}` : !usable.has(id) ? "사정권 없음" : "";
    const attrs = disabled ? "disabled" : `data-skill="${id}"`;
    const brk = ui.sheetDetail ? breakdownLine(state, actor, id) : "";
    return `<button class="skcard t-${skillType(sk).key} ${disabled ? "disabled" : ""}" ${attrs}>
      <span class="skhead"><span class="skname">${esc(sk.name)}</span>${reason ? `<span class="skreason">${reason}</span>` : ""}</span>
      ${skillCardBody(sk, effDmgOf(state, actor, id))}${brk}
    </button>`;
  }).join("");
  // 대기: 아무것도 안 하고 턴 넘기기 (항상 노출, 쿨 소모 없음) + 자세히(피해 분해) 토글
  const detailBtn = `<button class="detail-toggle${ui.sheetDetail ? " on" : ""}" id="detailbtn">${ui.sheetDetail ? "자세히 ✓" : "자세히"}</button>`;
  return `<div class="actions skillsel"><div class="prompt">▶ ${esc(obs.current.name)}의 턴 — 스킬 선택 ${detailBtn}</div><div class="skgrid">${cards}</div><button class="act skip wait" id="skipbtn">⏭ 대기 (턴 넘김)</button></div>`;
}
