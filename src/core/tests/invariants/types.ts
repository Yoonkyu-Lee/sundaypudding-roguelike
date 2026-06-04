// 불변식 assertion 공용 타입. (INVARIANTS-FROM-CLAUDE-CODE.md)
// 검사기는 throw하지 않고 위반(Violation)을 모아 반환 → 캠페인 러너가 (시드·턴·규칙·스냅샷) 덤프.

export type Severity = "CRIT" | "NORM";

/** 단일 불변식 위반. id는 카탈로그 ID(A1·C2·M8 …), msg는 사람이 읽을 구체 설명. */
export interface Violation {
  id: string;
  severity: Severity;
  msg: string;
}

/** 위반 누산 헬퍼 — 조건이 false면 위반 push. */
export class Violations {
  readonly list: Violation[] = [];
  check(cond: boolean, id: string, severity: Severity, msg: () => string): void {
    if (!cond) this.list.push({ id, severity, msg: msg() });
  }
  add(id: string, severity: Severity, msg: string): void {
    this.list.push({ id, severity, msg });
  }
}

/** 위반 목록을 한 줄 요약(테스트 실패 메시지용). */
export function summarize(vs: Violation[]): string {
  if (vs.length === 0) return "위반 없음";
  return vs.map((v) => `[${v.id}/${v.severity}] ${v.msg}`).join("\n");
}
