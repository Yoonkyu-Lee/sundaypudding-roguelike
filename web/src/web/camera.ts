// 뷰포트 카메라(줌·팬) — 고정 크기 viewport 안에서 field를 translate+scale. 공용(web).
// 에디터 노드 맵·층 그래프 + 인게임 맵이 공유. cam은 영속 상태; 변경분만 onChange로 통지.
export interface Cam { zoom: number; x: number; y: number; }

export interface CameraOpts {
  viewport: HTMLElement; // 고정 크기 창(overflow hidden)
  field: HTMLElement; // 변환 대상(내용물)
  cam: Cam; // 초기 카메라(복사본을 넘길 것). x가 NaN이면 첫 진입 → initialCenter로 중앙 정렬
  onChange: (c: Cam) => void; // 영속 통지
  contentSize: { w: number; h: number }; // 리셋 시 중앙 정렬 기준
  initialCenter?: () => { x: number; y: number } | null; // 첫 진입 중앙에 둘 내용 좌표(없으면 contentSize 중앙)
  canPan?: (e: PointerEvent) => boolean; // 팬 시작 조건(기본=중클릭). 좌드래그 배경 팬 등 커스터마이즈
}

export interface CameraControls { zoomAtCenter: (factor: number) => void; reset: () => void; }

export function attachCamera(opts: CameraOpts): CameraControls {
  const { viewport: vp, field, cam, onChange, contentSize } = opts;
  const canPan = opts.canPan ?? ((e) => e.button === 1);
  const clamp = (z: number) => Math.max(0.3, Math.min(2.5, z));
  const apply = () => { field.style.transformOrigin = "0 0"; field.style.transform = `translate(${Math.round(cam.x)}px,${Math.round(cam.y)}px) scale(${cam.zoom})`; };
  const ctr = () => { const r = vp.getBoundingClientRect(); return [r.width / 2, r.height / 2] as const; };

  // 블러 방지: will-change는 제스처 중에만 켠다(레이어 승격=매끄러운 변형). 쉴 때 끄면
  // 브라우저가 현재 줌 배율로 재래스터 → 선명(상시 켜면 1×로 캐시돼 확대 시 흐림).
  let idleTimer = 0;
  const hot = () => { field.style.willChange = "transform"; };
  const cool = () => { field.style.willChange = "auto"; }; // 레이어 해제 → 재래스터(선명)
  const coolSoon = () => { if (idleTimer) clearTimeout(idleTimer); idleTimer = window.setTimeout(cool, 200); };

  if (Number.isNaN(cam.x)) {
    const c = opts.initialCenter?.() ?? { x: contentSize.w / 2, y: contentSize.h / 2 };
    const r0 = vp.getBoundingClientRect();
    cam.zoom = 1; cam.x = r0.width / 2 - c.x; cam.y = r0.height / 2 - c.y;
    onChange({ ...cam });
  }
  apply();

  const zoomAt = (mx: number, my: number, factor: number) => {
    const nz = clamp(cam.zoom * factor), k = nz / cam.zoom;
    cam.x = mx - (mx - cam.x) * k; cam.y = my - (my - cam.y) * k; cam.zoom = nz;
    apply(); onChange({ ...cam });
  };
  vp.addEventListener("wheel", (e) => { e.preventDefault(); hot(); const r = vp.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 1 / 1.1); coolSoon(); }, { passive: false });

  let panning = false, lastX = 0, lastY = 0;
  vp.addEventListener("pointerdown", (e) => { if (!canPan(e)) return; e.preventDefault(); panning = true; hot(); lastX = e.clientX; lastY = e.clientY; vp.setPointerCapture(e.pointerId); });
  vp.addEventListener("pointermove", (e) => { if (!panning) return; cam.x += e.clientX - lastX; cam.y += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; apply(); });
  vp.addEventListener("pointerup", () => { if (panning) { panning = false; onChange({ ...cam }); coolSoon(); } });

  return {
    zoomAtCenter: (factor) => zoomAt(...ctr(), factor),
    reset: () => { cam.zoom = 1; const [mx, my] = ctr(); cam.x = mx - contentSize.w / 2; cam.y = my - contentSize.h / 2; apply(); onChange({ ...cam }); },
  };
}
