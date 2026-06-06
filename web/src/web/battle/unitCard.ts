// 그리드 캐릭터 카드 — 아바타·이름·포메이션·쉴드바(체력바 위 좌측정렬)·HP바·HP텍스트·상태칩.
// 칸 규격 통일: 카드는 칸을 꽉 채우고 내부 구조는 정보량과 무관하게 고정 (item 2/3/6).
import type { UnitView } from "../../contract/types.ts";
import { avatarHtml, esc, r1, ck, type TgtCtx } from "./shared.ts";
import { statusChips } from "./status.ts";

function formationBadge(u: UnitView): string {
  const a = u.formation.attackPower > 0 ? `<span class="fb atk">⚔${r1(u.formation.attackPower)}</span>` : "";
  const d = u.formation.defensePower > 0 ? `<span class="fb def">🛡${r1(u.formation.defensePower)}</span>` : "";
  return a || d ? `<span class="fbs">${a}${d}</span>` : "";
}

export function unitCard(u: UnitView, isCurrent: boolean, damaged: boolean, tgt: TgtCtx, moved = false): string {
  const key = ck(u.pos);
  const inFoot = tgt.active && tgt.areaSide === u.side && tgt.footprint.has(key);
  const hpPct = Math.max(0, (u.hp / u.hpMax) * 100);
  const shPct = u.shield > 0 ? Math.min(100, (u.shield / u.hpMax) * 100) : 0; // 쉴드 = hpMax 대비 비율, 좌측정렬

  // 영향 칸 대상 HP 깎일 양 미리보기 (쉴드/관통/공포 반영, 0.2) — AoE면 빨간 하이라이트 안 전원
  let preview = "";
  let lossText = "";
  const pl = tgt.previewLoss.get(u.uid);
  if (pl) {
    const { hpLoss, shieldConsumed } = pl;
    const leftPct = ((u.hp - hpLoss) / u.hpMax) * 100;
    const widthPct = (hpLoss / u.hpMax) * 100;
    preview = `<div class="ploss" style="left:${leftPct}%;width:${widthPct}%"></div>`;
    lossText = ` <span class="lossnum">−${hpLoss}</span>${shieldConsumed > 0 ? `<span class="absnum">🛡−${shieldConsumed}</span>` : ""}`;
  }

  const cls = ["card", u.side, isCurrent ? "current" : "", damaged ? "flash" : "", moved ? "moved" : "", inFoot ? "tgt" : ""].join(" ").replace(/\s+/g, " ").trim();
  const hitBadge = tgt.active && tgt.validHit.has(u.uid) ? `<div class="hitbadge">${tgt.validHit.get(u.uid)}%</div>` : "";
  const info = `<button class="cs-info" data-sheet-uid="${u.uid}" aria-label="프로필">ℹ</button>`; // 아군·적 모두 열람(읽기전용)

  return `<div class="${cls}" data-uid="${u.uid}">
    ${hitBadge}${info}
    <div class="cardtop">${avatarHtml(u.avatar, "avt")}<span class="nm">${esc(u.name)}</span>${formationBadge(u)}</div>
    <div class="bars">
      <div class="shbar">${shPct > 0 ? `<div class="shfill" style="width:${shPct}%"></div><span class="shnum">${u.shield}</span>` : ""}</div>
      <div class="hpbar"><div class="hp" style="width:${hpPct}%"></div>${preview}</div>
    </div>
    <div class="hptext"><span>${u.hp}/${u.hpMax}</span>${lossText}</div>
    <div class="chips">${statusChips(u)}</div>
  </div>`;
}
