// 캐스터→타겟 눈금 화살표 (SVG, 측정 기반). render에서 분리.
export function drawArrow(app: HTMLElement, casterUid: string, targetUid: string): void {
  const svg = app.querySelector<SVGSVGElement>(".arrows");
  const cEl = app.querySelector<HTMLElement>(`.card[data-uid="${casterUid}"]`);
  const tEl = app.querySelector<HTMLElement>(`.card[data-uid="${targetUid}"]`);
  if (!svg || !cEl || !tEl) return;
  const c = cEl.getBoundingClientRect();
  const t = tEl.getBoundingClientRect();
  const x1 = c.left + c.width / 2, y1 = c.top + c.height / 2;
  const x2 = t.left + t.width / 2, y2 = t.top + t.height / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len; // 단위벡터
  const px = -uy, py = ux; // 수직(눈금용)

  let ticks = "";
  const step = 22;
  for (let d = step; d < len - 18; d += step) {
    const bx = x1 + ux * d, by = y1 + uy * d;
    ticks += `<line x1="${bx - px * 4}" y1="${by - py * 4}" x2="${bx + px * 4}" y2="${by + py * 4}" class="tick"/>`;
  }
  const hx = x2 - ux * 12, hy = y2 - uy * 12;
  const head = `<polygon points="${x2},${y2} ${hx + px * 6},${hy + py * 6} ${hx - px * 6},${hy - py * 6}" class="head"/>`;
  const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="shaft"/>`;
  svg.innerHTML = line + ticks + head;
}
