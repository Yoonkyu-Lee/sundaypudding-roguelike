// AUTO-GENERATED — 에디터 'repo에 저장'(dev-write 미들웨어, F3)이 src/content/runs/*.json을
// 스캔해 통째로 재생성한다. 직접 편집 금지(다음 저장 때 덮어써짐). 키 = 각 json의 id.
import type { RunDef } from "../../contract/types.ts";
import run_yain from "./yain.json" with { type: "json" };
import run_run1_youth from "./run1-youth.json" with { type: "json" };
import run_run2_jongno from "./run2-jongno.json" with { type: "json" };

export const RUNS: Record<string, RunDef> = {
  "yain": run_yain as unknown as RunDef,
  "run1_youth": run_run1_youth as unknown as RunDef,
  "run2_jongno": run_run2_jongno as unknown as RunDef,
};
