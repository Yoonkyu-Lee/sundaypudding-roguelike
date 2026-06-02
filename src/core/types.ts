// 타입 배럴(파사드). 데이터 계약(content) + 엔진 런타임(runtime)을 한 경로로 노출.
// 기존 `from "../core/types.ts"` import 호환 유지. (8.6 타입 스키마 = 명세서)
export type * from "./types/content.ts";
export type * from "./types/passives.ts";
export type * from "./types/ai.ts";
export type * from "./types/map.ts";
export type * from "./types/runtime.ts";
