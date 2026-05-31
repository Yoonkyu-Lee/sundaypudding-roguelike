// 라운드 시작 연출 — 각 유닛이 주사위를 굴리고(speedMin~speedMax) → ±speedDown → 최종 SPD → 서열 정렬 (2.2).
// 8.5 원칙: roundStart 이벤트(SpeedRoll[])의 재생. 결정값은 엔진에서 옴, 여기선 연출만. 클릭 스킵.
import type { SpeedRoll } from "../../core/types.ts";
import { avatarHtml, esc } from "./shared.ts";

export interface RollView extends SpeedRoll {
  name: string;
  avatar?: string;
  side: "ally" | "enemy";
}

/** 오버레이를 그리고 다단계 애니메이션 후 onDone. 클릭하면 즉시 마무리. */
export function playRoundIntro(app: HTMLElement, round: number, rolls: RollView[], orderUids: string[], onDone: () => void): void {
  const rows = rolls
    .map(
      (r) => `<div class="ri-row" data-uid="${r.uid}">
        <span class="ri-rank"></span>
        ${avatarHtml(r.avatar, "avt")}
        <span class="ri-name ${r.side}">${esc(r.name)}</span>
        <span class="ri-die" data-min="${r.speedMin}" data-max="${r.speedMax}">?</span>
        <span class="ri-adj">${r.speedDown > 0 ? `−${r.speedDown}` : ""}</span>
        <span class="ri-spd"></span>
      </div>`,
    )
    .join("");
  const overlay = document.createElement("div");
  overlay.className = "roundintro";
  overlay.innerHTML = `<div class="ri-box"><h2>⚄ ROUND ${round} · 행동 서열 결정</h2><div class="ri-list">${rows}</div><div class="ri-skip">클릭하면 건너뛰기</div></div>`;
  app.appendChild(overlay);

  const spins: number[] = [];
  const timers: number[] = [];
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    for (const s of spins) clearInterval(s);
    for (const t of timers) clearTimeout(t);
    overlay.classList.add("ri-out");
    setTimeout(() => {
      overlay.remove();
      onDone();
    }, 180);
  };
  overlay.addEventListener("click", finish);
  const rowOf = (uid: string) => overlay.querySelector<HTMLElement>(`.ri-row[data-uid="${uid}"]`)!;

  // Phase A: 주사위 회전 (min→max 순환)
  for (const r of rolls) {
    const die = rowOf(r.uid).querySelector<HTMLElement>(".ri-die")!;
    let v = r.speedMin;
    spins.push(setInterval(() => {
      die.textContent = String(v);
      v = v >= r.speedMax ? r.speedMin : v + 1;
    }, 60) as unknown as number);
  }

  // Phase B: 차례로 멈춰 roll 확정 + ±speedDown + 최종 speed
  rolls.forEach((r, i) => {
    timers.push(setTimeout(() => {
      clearInterval(spins[i]);
      const row = rowOf(r.uid);
      row.querySelector<HTMLElement>(".ri-die")!.textContent = String(r.roll);
      row.querySelector<HTMLElement>(".ri-spd")!.textContent = `= ${r.speed}`;
      row.classList.add("ri-settled");
    }, 650 + i * 110) as unknown as number);
  });

  // Phase C: 최종 서열로 재정렬 + 순위 라벨 (order = 엔진 확정 순서)
  const settleEnd = 650 + rolls.length * 110;
  timers.push(setTimeout(() => {
    const list = overlay.querySelector<HTMLElement>(".ri-list")!;
    orderUids.forEach((uid, rank) => {
      const row = rowOf(uid);
      row.querySelector<HTMLElement>(".ri-rank")!.textContent = `${rank + 1}`;
      row.classList.add("ri-ranked");
      list.appendChild(row); // DOM 순서 = 최종 서열
    });
  }, settleEnd + 250) as unknown as number);

  // Phase D: 자동 마무리
  timers.push(setTimeout(finish, settleEnd + 250 + 950) as unknown as number);
}
