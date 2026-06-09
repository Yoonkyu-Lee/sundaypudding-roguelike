// 캐릭터 데이터 (포켓몬式 고유 디자인, 4.1). 스탯=기본값(보정 가능).
//
// 진실원 = characters.json (캐릭터 에디터가 저작·내보내기 — jobs/items/skills/traits와 동일 패턴). 이 파일은 타입드 로더.
// skillIds=보유 풀(앞 4개 활성). traitIds·aiProfileId·rootJobId는 traits/ai/jobs 참조. (이주 전 인라인 주석은 git 이력 보존)
import type { Character } from "../contract/types.ts";
import CHARACTERS_JSON from "./characters.json" with { type: "json" };

export const CHARACTERS: Record<string, Character> = CHARACTERS_JSON as unknown as Record<string, Character>;
