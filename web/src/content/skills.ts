// 스킬 데이터 (데이터 주도). 위치 마스크·쿨타임·명중·효과 전부 데이터로. (2.4~2.10)
// 근접 스킬은 `reach`(동적 도달 열) 사용 — 정적 전방 마스크 폐지(후열만 남는 교착 방지, 2.4).
//
// 진실원 = skills.json (스킬 에디터가 저작·내보내기 — jobs/items와 동일 패턴). 이 파일은 타입드 로더.
// 설계 의도(캐릭터별 역할·하이브리드 패시브 등)는 game-design 2.x가 SoT. (이주 전 인라인 주석은 git 이력 보존)
import type { Skill } from "../contract/types.ts";
import SKILLS_JSON from "./skills.json" with { type: "json" };

export const SKILLS: Record<string, Skill> = SKILLS_JSON as unknown as Record<string, Skill>;
