// 이벤트 → 사람 가독 한 줄 (8.5 로그 재생). render에서 분리(1모듈=1책임).
import type { GameEvent, GameState } from "../../core/types.ts";

export function formatEvent(state: GameState, e: GameEvent): string | null {
  const nm = (uid?: string) => state.units.find((u) => u.uid === uid)?.name ?? uid ?? "?";
  switch (e.t) {
    case "roundStart": return `<b>── ROUND ${e.round} ──</b>`;
    case "turnStart": return `· <i>${nm(e.uid)}의 턴${e.kind === "interrupt" ? " ⚡끼어들기" : ""}</i>`;
    case "skillUsed": return `${nm(e.uid)} → 「${e.skillId}」${e.targetUid ? ` (${nm(e.targetUid)})` : ""}`;
    case "miss": return `&nbsp;&nbsp;✗ 빗나감 (${e.chance}%)`;
    case "hit": return `&nbsp;&nbsp;✓ 명중${e.crit ? " 💥크리!" : ""}`;
    case "damage": return `&nbsp;&nbsp;💢 ${nm(e.targetUid)} 피해 ${e.final} (쉴드 ${e.toShield}/HP ${e.toHp})`;
    case "statusTick": return `&nbsp;&nbsp;${nm(e.targetUid)} ${e.statusId} 지속피해 ${e.dmg}`;
    case "statusApplied": return `&nbsp;&nbsp;☢ ${nm(e.targetUid)} ${e.statusId} ${e.stacks}스택(${e.duration}턴)`;
    case "cleanse": return `&nbsp;&nbsp;✨ ${nm(e.targetUid)} 정화`;
    case "shieldGain": return `&nbsp;&nbsp;🛡 ${nm(e.targetUid)} 쉴드 +${e.amount}`;
    case "heal": return `&nbsp;&nbsp;➕ ${nm(e.targetUid)} 회복 ${e.amount}`;
    case "move": return `&nbsp;&nbsp;↔ ${nm(e.uid)} 이동 (c${e.from.col}→c${e.to.col})`;
    case "interrupt": return `&nbsp;&nbsp;⚡ ${nm(e.uid)} 끼어들기!`;
    case "skip": return `${nm(e.uid)} 스킵 (${e.reason})`;
    case "death": return `&nbsp;&nbsp;☠ ${nm(e.uid)} 전투불능`;
    case "battleEnd": return `<b>${e.phase === "allyWin" ? "🏆 아군 승리!" : "💀 패배..."}</b>`;
    default: return null;
  }
}
