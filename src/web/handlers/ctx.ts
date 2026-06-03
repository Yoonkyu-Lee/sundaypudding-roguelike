// 핸들러 공유 컨텍스트 — main이 가변 상태(run/busy)와 앱 액션을 주입. 핸들러는 ctx로만 접근
// (run/busy를 직접 잡지 않음 → 재할당은 main 소관). 핸들러끼리 직접 의존 없이 앱 액션으로 평탄화.
import type { RunState } from "../../core/run.ts";
import type { Action } from "../../core/types.ts";
import type { Ui } from "../render.ts";

export interface AppCtx {
  ui: Ui;
  getRun: () => RunState; // 현재 런(재할당돼도 항상 최신)
  isBusy: () => boolean; // 연출/AI 대기 중 입력 잠금
  render: () => void;
  resetUi: () => void; // 노드 전환 시 UI 리셋
  endTargeting: () => void; // 타겟팅 취소
  battleStep: (action: Action) => void; // 전투 1스텝 진행 + 렌더
  restart: () => void; // 런 재시작(seed++ → newRun)
  openPause: () => void; // 일시정지 오버레이 열기
  toHub: () => void; // 집으로(승패 시 런 정리)
}
