// 행동서열 패널 (영속·모드-aware). 주사위 연출(rolling)과 전투 타임라인(live)이 한 컴포넌트.
// rolling: 중앙 확장해 주사위 굴림→±→서열 확정 → dock(): 같은 행이 좌측 레일로 FLIP 슬라이드 → live.
// roundIntro.ts + timeline.ts 통합. 연속성 = 같은 root DOM이 모드만 전환(별개 오버레이 없음).
import type { GameState, Observation, SpeedRoll } from "../../core/types.ts";
import { avatarHtml, esc } from "./shared.ts";

export interface RollView extends SpeedRoll {
  name: string;
  avatar?: string;
  side: "ally" | "enemy";
}

export interface TimelinePanel {
  root: HTMLElement; // .battleleft 안에 영속 마운트
  rolling: () => boolean;
  playRoll: (round: number, rolls: RollView[], orderUids: string[], onDone: () => void) => void;
  update: (obs: Observation, state: GameState, ghostNames: string[]) => void;
}

const TRIG = 60; // 주사위 회전 간격(ms)

export function createTimelinePanel(): TimelinePanel {
  const root = document.createElement("div");
  root.className = "timeline";
  let mode: "rolling" | "live" = "live";
  const spins: number[] = [];
  const timers: number[] = [];
  const clearAll = () => { spins.forEach(clearInterval); timers.forEach(clearTimeout); spins.length = 0; timers.length = 0; };
  const rowOf = (uid: string) => root.querySelector<HTMLElement>(`.trow[data-uid="${uid}"]`);

  // ── live: 전투 타임라인 행 (완료✓/현재▶/끼어들기 유령) ──
  function update(obs: Observation, state: GameState, ghostNames: string[]): void {
    if (mode === "rolling") return; // 굴림 중엔 갱신 보류
    const rows: string[] = [];
    obs.order.forEach((e, i) => {
      const u = state.units.find((x) => x.uid === e.uid);
      const nm = u?.name ?? e.uid;
      const dead = u ? !u.alive : false;
      const done = i < obs.cursorIndex;
      const cur = i === obs.cursorIndex;
      const cls = ["trow", e.kind === "interrupt" ? "interrupt" : "", cur ? "cur" : "", done ? "done" : "", dead ? "dead" : ""].join(" ").replace(/\s+/g, " ").trim();
      const mark = e.kind === "interrupt" ? "⚡" : done && !dead ? "✓" : cur ? "▶" : "";
      const spd = e.kind === "interrupt" ? "" : `<em>${e.speed}</em>`;
      rows.push(`<div class="${cls}" data-uid="${e.uid}"><span class="tmark">${mark}</span><span class="tname">${esc(nm)}</span><span class="tspd">${spd}</span></div>`);
      if (cur) for (const name of ghostNames) rows.push(`<div class="trow interrupt ghost"><span class="tmark">⚡</span><span class="tname">${esc(name)}</span><span class="tspd"></span></div>`);
    });
    root.innerHTML = `<h2>서열</h2><div class="trows">${rows.join("") || "<div class='trow'>—</div>"}</div>`;
  }

  // ── rolling: 중앙 확장 주사위 → 확정 → dock ──
  function playRoll(round: number, rolls: RollView[], orderUids: string[], onDone: () => void): void {
    mode = "rolling";
    clearAll();
    root.classList.add("rolling");
    root.innerHTML = `<h2>⚄ ROUND ${round} · 행동 서열 결정</h2>
      <div class="trows">${rolls.map((r) => `<div class="trow rollrow" data-uid="${r.uid}">
        <span class="tmark"></span>${avatarHtml(r.avatar, "avt")}<span class="tname ${r.side}">${esc(r.name)}</span>
        <span class="ri-die" data-min="${r.speedMin}" data-max="${r.speedMax}">?</span>
        <span class="ri-adj">${r.speedDown > 0 ? `−${r.speedDown}` : ""}</span>
        <span class="tspd"></span></div>`).join("")}</div>
      <div class="ri-skip">클릭하면 건너뛰기</div>`;

    let done = false;
    const dock = () => {
      if (done) return;
      done = true;
      clearAll();
      const trows = root.querySelector<HTMLElement>(".trows")!;
      // First: 굴림(중앙) 위치 기록 (x,y 둘 다 — 중앙→레일은 가로 이동도 큼)
      const before = new Map<string, { x: number; y: number }>();
      for (const r of rolls) { const rc = rowOf(r.uid)!.getBoundingClientRect(); before.set(r.uid, { x: rc.left, y: rc.top }); }
      // 레일(live)로: rolling 해제 → 콤팩트 레이아웃으로 리플로우 (행은 그대로, CSS가 주사위 숨김)
      root.classList.remove("rolling");
      root.classList.add("docking");
      const h2 = root.querySelector("h2"); // 제목을 레일 라벨로 미리 정착 → dock 중 긴 제목이 좁은 폭에서 wrap(높이 출렁임)되는 것 방지
      if (h2) h2.textContent = "서열";
      // Invert + Play: 각 행을 중앙 위치로 되돌렸다가 레일로 슬라이드
      const moved: HTMLElement[] = [];
      for (const r of rolls) {
        const row = rowOf(r.uid)!;
        const rc = row.getBoundingClientRect();
        const b = before.get(r.uid)!;
        const dx = b.x - rc.left, dy = b.y - rc.top;
        if (!dx && !dy) continue;
        row.style.transition = "none";
        row.style.transform = `translate(${dx}px, ${dy}px)`;
        moved.push(row);
      }
      void trows.offsetWidth; // 리플로우 커밋
      for (const row of moved) {
        row.style.transition = "transform .5s cubic-bezier(.4,0,.2,1)";
        row.style.transform = "";
      }
      timers.push(setTimeout(() => {
        root.classList.remove("docking");
        for (const row of moved) { row.style.transition = ""; row.style.transform = ""; }
        mode = "live";
        onDone();
      }, 540) as unknown as number);
    };
    root.onclick = dock; // 클릭 스킵 → 즉시 도킹

    // Phase A: 주사위 회전
    for (const r of rolls) {
      const die = rowOf(r.uid)!.querySelector<HTMLElement>(".ri-die")!;
      let v = r.speedMin;
      spins.push(setInterval(() => { die.textContent = String(v); v = v >= r.speedMax ? r.speedMin : v + 1; }, TRIG) as unknown as number);
    }
    // Phase B: 차례로 멈춰 roll·spd 확정
    rolls.forEach((r, i) => {
      timers.push(setTimeout(() => {
        clearInterval(spins[i]);
        const row = rowOf(r.uid)!;
        row.querySelector<HTMLElement>(".ri-die")!.textContent = String(r.roll);
        row.querySelector<HTMLElement>(".tspd")!.textContent = `= ${r.speed}`;
        row.classList.add("ri-settled");
      }, 600 + i * 100) as unknown as number);
    });
    // Phase C: 최종 서열로 재정렬 + 순위 + dock
    const settleEnd = 600 + rolls.length * 100;
    timers.push(setTimeout(() => {
      const trows = root.querySelector<HTMLElement>(".trows")!;
      const first = new Map<string, number>();
      for (const uid of orderUids) first.set(uid, rowOf(uid)!.getBoundingClientRect().top);
      orderUids.forEach((uid, rank) => { const row = rowOf(uid)!; row.querySelector<HTMLElement>(".tmark")!.textContent = `${rank + 1}`; row.classList.add("ri-ranked"); trows.appendChild(row); });
      const moved: HTMLElement[] = [];
      for (const uid of orderUids) { const row = rowOf(uid)!; const d = first.get(uid)! - row.getBoundingClientRect().top; if (!d) continue; row.style.transition = "none"; row.style.transform = `translateY(${d}px)`; moved.push(row); }
      void trows.offsetWidth;
      for (const row of moved) { row.style.transition = "transform .4s cubic-bezier(.4,0,.2,1)"; row.style.transform = ""; }
    }, settleEnd + 200) as unknown as number);
    // Phase D: 자동 도킹
    timers.push(setTimeout(dock, settleEnd + 200 + 900) as unknown as number);
  }

  return { root, rolling: () => mode === "rolling", playRoll, update };
}
