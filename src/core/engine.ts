// 파사드(배럴) — 전투 엔진 공개 API. 내부 구현은 core/combat/* 로 모듈화됨.
// 기존 `from "../core/engine.ts"` import 호환 유지.
export * from "./combat/index.ts";
