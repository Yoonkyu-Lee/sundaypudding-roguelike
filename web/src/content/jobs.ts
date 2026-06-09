// 전직 직업 트리 데이터 (4.7) — 캐릭터 전속. 전직 = 패시브 부여 + 차수(classReq) 스킬 보상 해금.
// 분기 차이는 패시브뿐(같은 차수 보상 풀 공유). 런 한정.
//
// 진실원 = jobs.json (전직 트리 에디터가 저작·내보내기 — runs/*.json과 동일 패턴). 이 파일은 타입드 로더.
// 트리 설계 메모(상세는 game-design 4.7):
//   • 김두한: 종로 주먹(0) → {우미관 두목(팀 강화), 협객(단독 캐리)}(1). 분기는 패시브만 다름, 보상 풀 공유.
//   • 소년두한(런1): 종로 거지 소년(0) → 무도가(기 집중, 1차 전용기)(1).
//   • 두한 청년(런2~): 무소속 주먹(0) → 거리의 독립군(1) → 이정목 오야붕(2) → 우미관 오야붕(3).
import type { JobDef } from "../contract/types.ts";
import JOBS_JSON from "./jobs.json" with { type: "json" };

export const JOBS: Record<string, JobDef> = JOBS_JSON as unknown as Record<string, JobDef>;
