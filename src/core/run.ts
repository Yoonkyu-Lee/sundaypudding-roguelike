// 파사드(배럴) — 런 공개 API. 내부 구현은 core/run/* 로 모듈화됨.
// 기존 `from "../core/run.ts"` import 호환 유지.
export * from "./run/index.ts";
