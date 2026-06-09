// 특성(trait) 데이터 — 캐릭터를 정의하는 상시 패시브 룰 묶음 (디자이너 작성).
// 캐릭터가 characters.ts의 traitIds로 참조. 룰 = when/if/then (contract/types/passives.ts 스키마).
//
// 진실원 = traits.json (패시브/특성 에디터가 저작·내보내기 — jobs/items/skills와 동일 패턴). 이 파일은 타입드 로더.
// 작성법·카탈로그: src/content/README.md "특성/패시브" 절. (이주 전 인라인 주석은 git 이력 보존)
import type { TraitDef } from "../contract/types.ts";
import TRAITS_JSON from "./traits.json" with { type: "json" };

export const TRAITS: Record<string, TraitDef> = TRAITS_JSON as unknown as Record<string, TraitDef>;
