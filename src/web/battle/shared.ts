// 전투 뷰 공용 소도구 + UI 타입 (leaf). 모든 battle/* 모듈과 render가 여기서 import.
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
export const r1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const ck = (p: { row: number; col: number }) => `${p.row},${p.col}`;

/** 아바타: 이미지 경로면 <img>(고정 크기), 이모지면 칸. 그리드 칸 규격 통일을 위해 항상 같은 박스. */
export function avatarHtml(av: string | undefined, cls = "avt"): string {
  // 경로(/) · data: URL(단일 HTML 빌드 인라인) · 이미지 확장자 → <img>, 그 외 이모지
  if (av && (av.startsWith("/") || av.startsWith("data:") || /\.(png|jpe?g|webp|gif|avif)$/i.test(av)))
    return `<img class="${cls}" src="${av}" alt="" onerror="this.replaceWith(document.createTextNode('🎭'))">`;
  return `<span class="${cls} avem">${av ?? "🎭"}</span>`;
}

// ── UI 상태 / 핸들러 ──
export interface Ui {
  selectedSkillId: string | null; // null = 스킬 선택 모드 / 값 = 타겟팅 모드
  hoverCell: { row: number; col: number } | null; // 호버 중인 앵커 칸
  pickedCells: { row: number; col: number }[]; // 자유선택(free)에서 고른 칸들
  damaged: Set<string>;
  moved: Set<string>; // 직전 step에서 이동한 유닛 (이동 펄스 연출)
  seed: number;
}
export interface Handlers {
  onSkill: (skillId: string) => void;
  onCellClick: (pos: { row: number; col: number }) => void;
  onCellHover: (pos: { row: number; col: number } | null) => void;
  onCancel: () => void;
  onSkip: () => void;
  onNewBattle: (seed: number) => void;
}

// ── 타겟팅 컨텍스트 (셀 기반) ──
export interface TgtCtx {
  active: boolean;
  validHit: Map<string, number>; // uid → 명중% (점유 칸 머리 위 표시)
  previewLoss: { hpLoss: number; shieldConsumed: number } | null;
  casterUid: string | null;
  areaSide: "ally" | "enemy" | null; // 타겟팅 대상 진영
  hoverCell: string | null; // "row,col"
  anchorOk: Set<string>; // 클릭 가능한 앵커/다음선택 칸 키
  footprint: Set<string>; // 영향 칸 미리보기 (바닥 하이라이트)
  picked: Set<string>; // 자유선택에서 이미 고른 칸
}
