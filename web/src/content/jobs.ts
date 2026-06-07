// 전직 직업 트리 데이터 (4.7) — 캐릭터 전속. 전직 = 패시브 부여 + 차수(classReq) 스킬 보상 해금.
// 분기 차이는 패시브뿐(같은 차수 보상 풀 공유). 런 한정. 엔진 해석은 전직 슬라이스(S2~) — 현재 데이터만(휴면).
import type { JobDef } from "../contract/types.ts";

export const JOBS: Record<string, JobDef> = {
  // ══ 김두한(야인시대) 예시 트리 ══
  // 종로 주먹(0차) → {우미관 두목, 협객}(1차). 분기는 패시브만 다름 — 보상 스킬 풀(classReq 1)은 공유.
  kim_job_brawler: { id: "kim_job_brawler", name: "종로 주먹", classReq: 0, advancesTo: ["kim_job_boss", "kim_job_fist"] },
  // 우미관 두목: 두목의 의리(팀 강화). 팀/서포트 빌드(예: 종로 호령)와 시너지.
  kim_job_boss: { id: "kim_job_boss", name: "우미관 두목", classReq: 1, grantsTraitIds: ["kim_oyabun_will"] },
  // 협객: 맹타(단독 캐리·치명). 단타 빌드(예: 박치기)와 시너지. 단, 두목이 박치기를 뽑아도 됨(배제 없음).
  kim_job_fist: { id: "kim_job_fist", name: "협객", classReq: 1, grantsTraitIds: ["kim_relentless"] },
};
