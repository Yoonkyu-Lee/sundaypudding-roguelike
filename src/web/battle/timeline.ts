// 행동 서열 타임라인 (좌측 세로, 위→아래). 완료(✓ 흐림)/현재(▶)/예정/끼어들기(초록 삽입)/사망(취소선).
// 끼어들기 예고: 현재 칸 바로 뒤에 유령 행(초록 점선, 밖→안 깜빡)을 삽입.
import type { GameState, Observation } from "../../core/types.ts";
import { esc } from "./shared.ts";

export function turnBar(obs: Observation, state: GameState, ghostNames: string[]): string {
  const rows: string[] = [];
  obs.order.forEach((e, i) => {
    const u = state.units.find((x) => x.uid === e.uid);
    const nm = u?.name ?? e.uid;
    const dead = u ? !u.alive : false;
    const done = i < obs.cursorIndex;
    const cur = i === obs.cursorIndex;
    const cls = ["trow", e.kind === "interrupt" ? "interrupt" : "", cur ? "cur" : "", done ? "done" : "", dead ? "dead" : ""]
      .join(" ").replace(/\s+/g, " ").trim();
    const mark = e.kind === "interrupt" ? "⚡" : done && !dead ? "✓" : cur ? "▶" : "";
    const spd = e.kind === "interrupt" ? "" : `<em>${e.spd}</em>`;
    rows.push(`<div class="${cls}"><span class="tmark">${mark}</span><span class="tname">${esc(nm)}</span>${spd}</div>`);
    if (cur) {
      for (const name of ghostNames) {
        rows.push(`<div class="trow interrupt ghost" title="확정 시 삽입"><span class="tmark">⚡</span><span class="tname">${esc(name)}</span></div>`);
      }
    }
  });
  return `<div class="timeline"><h2>서열</h2><div class="trows">${rows.join("") || "<div class='trow'>—</div>"}</div></div>`;
}
