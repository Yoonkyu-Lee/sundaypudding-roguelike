// 행동 패널: 스킬 선택 모드(균일 카드 4개) vs 타겟팅 모드. 스킬 설명은 skillDesc(데이터).
import type { GameState, Observation } from "../../core/types.ts";
import { SKILLS } from "../../data/skills.ts";
import { esc, type Ui } from "./shared.ts";
import { skillCardBody, skillInline } from "./skillDesc.ts";

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
      <div class="prompt">🎯 「${esc(sk.name)}」 대상 선택 — 칸 클릭 <span class="skinline">${esc(skillInline(sk))}</span></div>
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
    return `<button class="skcard ${disabled ? "disabled" : ""}" ${attrs}>
      <span class="skhead"><span class="skname">${esc(sk.name)}</span>${reason ? `<span class="skreason">${reason}</span>` : ""}</span>
      ${skillCardBody(sk)}
    </button>`;
  }).join("");
  return `<div class="actions skillsel"><div class="prompt">▶ ${esc(obs.current.name)}의 턴 — 스킬 선택</div><div class="skgrid">${cards}</div></div>`;
}
