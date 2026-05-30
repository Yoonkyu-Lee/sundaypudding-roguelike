// 개발용 레이아웃 모드 — 패널을 드래그/리사이즈로 자유 배치, localStorage 저장, 내보내기.
// 플레이어 GUI가 아니라 "개발자가 프론트를 코드 없이 빠르게 조절"하기 위한 도구.
const KEY = "spr-devlayout";

export interface Geom { x: number; y: number; w: number; h: number; hidden?: boolean }
interface Store { on: boolean; panels: Record<string, Geom> }

// 패널 초기 배치(전투 화면 기준)
const DEFAULTS: Record<string, Geom> = {
  turnbar: { x: 8, y: 8, w: 980, h: 70 },
  ally: { x: 8, y: 88, w: 480, h: 400 },
  enemy: { x: 500, y: 88, w: 480, h: 400 },
  actions: { x: 8, y: 496, w: 972, h: 150 },
  log: { x: 996, y: 8, w: 360, h: 638 },
};

function load(): Store {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { on: !!o.on, panels: o.panels ?? {} };
  } catch {
    return { on: false, panels: {} };
  }
}
let store: Store = load();
function save(): void { localStorage.setItem(KEY, JSON.stringify(store)); }

export function devOn(): boolean { return store.on; }
export function toggleDev(): void { store.on = !store.on; save(); }
export function geomOf(pid: string): Geom { return store.panels[pid] ?? DEFAULTS[pid] ?? { x: 8, y: 8, w: 320, h: 220 }; }
export function setGeom(pid: string, g: Geom): void { store.panels[pid] = g; save(); }
export function resetLayout(): void { store.panels = {}; save(); }
export function panelIds(): string[] { return Object.keys(DEFAULTS); }
export function exportLayout(): string {
  const o: Record<string, Geom> = {};
  for (const k of panelIds()) o[k] = geomOf(k);
  return JSON.stringify(o, null, 2);
}

/** 패널 엘리먼트에 드래그(헤더)·리사이즈 영속화 연결 */
export function wirePanel(el: HTMLElement, pid: string): void {
  const head = el.querySelector<HTMLElement>(".dphead");
  head?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const g = geomOf(pid);
    const sx = e.clientX, sy = e.clientY, ox = g.x, oy = g.y;
    const mv = (ev: PointerEvent) => {
      const ng: Geom = { ...geomOf(pid), x: Math.max(0, ox + ev.clientX - sx), y: Math.max(0, oy + ev.clientY - sy) };
      setGeom(pid, ng);
      el.style.left = `${ng.x}px`;
      el.style.top = `${ng.y}px`;
    };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  });
  // 모서리 리사이즈(css resize) 변경 영속화
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setGeom(pid, { ...geomOf(pid), w: el.offsetWidth, h: el.offsetHeight }));
  });
  ro.observe(el);
}
