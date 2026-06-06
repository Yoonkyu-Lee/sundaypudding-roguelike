// 공용 포인터 기반 드래그 — 네이티브 HTML5 DnD(브라우저 고스트 이미지) 대체.
// 커서를 따라오는 아바타(게임 오브젝트 느낌), 임계 이동 후 드롭, 안 움직이면 클릭으로 처리.
// 드롭 대상은 커서 아래 요소(elementFromPoint) — 소비자가 .closest로 영역 판별. 에디터·파티편성 공용.
export interface PointerDragSpec {
  payload: string;
  avatar: string; // 아바타 innerHTML (빈 문자열이면 아바타 없음 — 클릭/해제 제스처)
  onDrop?: (payload: string, target: Element | null, x: number, y: number) => void;
  onClick?: () => void;
}

export function beginPointerDrag(startEl: HTMLElement, e: PointerEvent, spec: PointerDragSpec): void {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  let avatar: HTMLElement | null = null;
  try { startEl.setPointerCapture(e.pointerId); } catch { /* */ }

  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
      moved = true;
      if (spec.avatar) {
        avatar = document.createElement("div");
        avatar.className = "drag-avatar";
        avatar.innerHTML = spec.avatar;
        document.body.appendChild(avatar);
        document.body.classList.add("dragging");
      }
    }
    if (avatar) { avatar.style.left = `${ev.clientX}px`; avatar.style.top = `${ev.clientY}px`; }
  };
  const up = (ev: PointerEvent) => {
    startEl.removeEventListener("pointermove", move);
    startEl.removeEventListener("pointerup", up);
    avatar?.remove();
    document.body.classList.remove("dragging");
    if (moved) spec.onDrop?.(spec.payload, document.elementFromPoint(ev.clientX, ev.clientY), ev.clientX, ev.clientY);
    else spec.onClick?.();
  };
  startEl.addEventListener("pointermove", move);
  startEl.addEventListener("pointerup", up);
}
