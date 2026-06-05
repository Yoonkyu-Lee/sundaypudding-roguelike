# PORTING.md — TS→Rust 마이그레이션 워크플로 (SoT)

> **목적**: `src/core/`(TS 결정론 엔진)를 Rust로 **자율 포팅**하기 위한 워크플로 진실원.
> 사용자는 **최종에 Tauri2 프론트로만 검증**하고, 그 외는 **differential harness**(TS=골든 오라클,
> Rust=DUT, 같은 시드+행동 → **바이트 동일 이벤트 로그**)로 자가검수한다.
> 검증 인프라(불변식·골든·스트레스·self-consistency·SERIALIZATION-CONTRACT·NUMERIC-POLICY·rngTrace)는 완료됨.
> 이 문서 = "어떻게 옮기고, 무엇으로 자율 수행하나". 규칙 요약은 [`CLAUDE.md`](../CLAUDE.md) 🦀 섹션.

---

## 0. 확정 결정 (회의 + Codex 적대검토 2026-06-05)

- **D1 수치 정책 = 정수화**: crit배수·frost(×0.5)·회복pct 등 코어 잔존 f64를 **정수 퍼센트(×100 고정소수)**로. 코어 f64 0 → Rust `i64`로 자명한 플랫폼-무관 결정론. (포메이션은 슬라이스1서 완료, [`NUMERIC-POLICY.md`](NUMERIC-POLICY.md) 옵션 B.) **전투 수치 ±1 미세 변동 = 밸런스 변경 → 디자이너 고지·승인.**
- **D2 자율성 = 동작변경만 승인**: 골든이 재생성되는(값 바뀌는) 슬라이스만 diff를 사용자 승인 후 진행. 순수 포팅(값 불변)은 자율.
- **D3 Codex = 플랜 리뷰 + 막힘시 rescue**: 각 슬라이스 Plan을 Codex 리뷰, 구현 검증은 differential 자동 게이트, 막히면 `codex:rescue`.

## 1. 워크스페이스 레이아웃

```
src/        ← TS 코어(골든 오라클 — 포팅 끝까지 유지, 검증 후 은퇴)
rust/       ← Cargo workspace (크레이트 의존그래프가 data→types←core→views 단방향을 컴파일 강제)
  spr-types/   (serde derive 허용)        ← types
  spr-data/    (→types)                   ← data (JSON 로더)
  spr-core/    (→types,data; 순수·no-IO)  ← core (combat/run/ai)
  spr-cli/     (→core)                    ← 헤드리스 demo + differential 드라이버
app/        ← Tauri2 (기존 src/web 프론트 + Rust 코어를 IPC 세션 API로 연결)
```
- **단방향 강제**: Cargo는 순환 의존을 금지 → TS의 `data→types←core→views`가 컴파일러 수준으로 보장(TS보다 강함).
- **코어 순수성**: `spr-core`에 `std::time`/`thread_rng` 금지(clippy deny + 게이트 grep). 무작위는 시드 RNG 타입만.
- **Tauri IPC = 세션 API**(매 step 전체 GameState 전송 금지): `create_run → session_id + view` / `battle_step(session_id, action) → event_delta + view` / `run_command(...) → delta + view`. Rust가 세션 소유.
- **CLI**: 대화형 `play` **drop**(웹이 대체). 헤드리스 demo(골든) + differential 드라이버만 이식.

## 2. 작업 순서 (의존 순서 — Codex 13단계)

### Phase 0 — 포팅 전 TS 정리 (현 TS 하네스 `/slice-plan`+`/slice-wrap`+골든)
1. **행동 벡터 포맷 동결 + emitter** — `(행동 시퀀스 + step별 event-delta + rng before/after)` 픽스처 기록 모드. *새 하네스 추가.* 행동 선택을 엔진과 분리(Rust가 같은 시퀀스 재생).
2. **zero-f64 정수화** — crit배수·frost·pct를 정수 퍼센트(데이터값 `content.ts`/`statuses.ts`/`items.ts`/`events.ts` + 코드 `damage.ts`/`passives/effects.ts`/`helpers.ts`/`encounter.ts`). **[D2: 동작변경 → 골든 diff 승인]**
3. **전역상태 → 컨텍스트 귀속** — passives `depth`/`activeKeys`(`combat/passives/dispatch.ts`), run `firing`(`run/passives.ts`)을 `GameState`/`RunState`로. (골든 불변 목표 = 동작 보존.)
4. **데이터 JSON화** — items/skills/characters/traits/ai를 JSON으로 내보내고 TS가 JSON 로드(단일 진실원, runs JSON 패턴 확장).
5. **`DATA-SERIALIZATION-CONTRACT.md`** 작성 — union 판별자(`kind`/`do`/`c`/`on`)·absent vs null·정수/퍼센트 스케일·배열=의미순서·ID 참조검증·passive DSL(`types/passives.ts`)·AI 프로파일(`ai/profile.ts`). TS에 DATA 계약 검증 추가.

### Phase 1 — Rust 포팅 (`/port-slice` + `/differential`)
6. Cargo workspace: `spr-types` + 시드 RNG(부호 계약) + canonical 직렬화([`SERIALIZATION-CONTRACT.md`](SERIALIZATION-CONTRACT.md)).
7. 데이터 로더 포팅 + 전 JSON 검증(DATA 계약).
8. 런 그래프/도달성 포팅(`run/graph.ts`).
9. **전투 수직 슬라이스**(한 단위 — 순환: `flow → turnOrder → targeting → status → damage → skills → passives`).
10. **슬라이스마다 directed 골든 벡터 재생**(differential 게이트).
11. 스트레스 벡터 재생(N 시드, random=coremark).
12. Tauri 세션 API.
13. **그 다음에야** 프론트 피처플래그(TS코어↔Rust코어 나란히) → **최종 Tauri2 검증(사용자)**.

## 3. 슬라이스 프로토콜 (`/port-slice` — RPI)

1. **Research** (코드 0줄): TS 원본 모듈 + 걸리는 불변식([`INVARIANTS-FROM-CLAUDE-CODE.md`](INVARIANTS-FROM-CLAUDE-CODE.md)) + 그 모듈의 differential 벡터를 읽는다.
2. **Plan** (`plans/port-<module>.md`): Rust가 무엇을 1:1로 옮기는지, **무엇을 안 바꾸는지**, differential 합격선. → **Codex 플랜 리뷰**(D3).
3. **Implement**: 새 세션(플랜만 로드, DumbZone 회피). Rust 작성.
4. **differential 게이트**: `/differential`로 TS↔Rust 벡터 재생 → **첫 어긋난 step+event** + 그 시점 **RNG-state**(rngTrace) 보고. 바이트 동일까지 반복. 막히면 요약→새 세션 또는 `codex:rescue`.
5. **`/slice-wrap`**: 게이트 + 문서 + 커밋. 이 PORTING.md 진행 상태 갱신.

## 4. 자율 수행 — 스킬/에이전트/훅/게이트

| 요소 | 역할 |
|---|---|
| **`/port-slice`**(신규, Phase 1) | RPI 1슬라이스. slice-plan/wrap 패턴 재사용 + Codex 플랜리뷰 + differential 게이트. |
| **`/differential`**(신규, Phase 1) | TS↔Rust 벡터 재생, 첫 발산 step·event + RNG-state로 "RNG vs 로직" 국소화. |
| **`/slice-plan`·`/slice-wrap`**(기존) | Phase 0 TS 정리 슬라이스. |
| **서브에이전트** | 단일 PO=메인. **저결합 슬라이스만 병렬**(데이터로더·rng·런그래프·벡터 emitter), 각 게이트=그 모듈 differential. **전투=메인의 한 수직 슬라이스**(순환이라 분할 금지 — 핸드오프=컨텍스트 사망). |
| **Dynamic Workflow(순정)** | 저결합 fan-out에만(토큰 폭식 허용). 전투 수직슬라이스엔 미사용(중간 개입 불가). |
| **`codex:rescue`** | differential이 수렴 안 할 때 2nd opinion. |
| **Hooks/게이트** | `scripts/check.ts` 확장(rust/ 생기면 `cargo test` + 골든벡터 differential을 pre-commit 필수). 기존 골든·스트레스 게이트 유지. |
| **LSP(rust-analyzer)** | rust/ 착수 시 — 크레이트 간 타입 결합 탐색. |
| **MCP** | 없음(불필요). |

## 5. 최대 리스크 (Codex)

**passive/status/interrupt 이벤트 순서 + RNG 소비** — 하나라도 순서가 어긋나면 로그+RNG 스트림 전체가 밀려 바이트 동일이 깨진다. Rust 측 필수:
- 상태 집계(`combat/status.ts` defId별)는 **JS 삽입순서** → Rust `IndexMap`/`Vec`(**`BTreeMap` 금지** — 재정렬됨).
- 트리거 정렬(`passives/dispatch.ts` `(orderIndex, owner.uid, idx)`)·끼어들기 삽입(`interrupt.ts` cursor+1 역순 splice)·턴 서열(`turnOrder.ts` — float 나눗셈을 **정수 교차곱**으로) 순서를 바이트 동일하게.
- RNG: `|0` signed 저장 / `>>>0` unsigned 방출 — canonical 트레이스가 부호 명시(`rng.ts`).
- 그래프 reachable은 authored edge 순서 의존 → `Vec` 순서 보존.

## 6. 검증 = RTL 벤치마크 재사용

- **directed 벡터**(골든 코퍼스) = AES/SHA 테스트 벡터 격. **스트레스 벡터**(random) = coremark 격.
- TS가 `(행동 시퀀스 + canonical event-delta)`를 픽스처로 커밋 → Rust 재생 → **바이트 동일** 대조.
- 불변식 assertion(Part 1~4)도 Rust로 이식(심층 방어, Rust 스트레스 중 상시 검사).
- 골든 코퍼스 + N 스트레스 시드 100% 일치 = 포팅 검증 완료 → 그 다음 사용자 Tauri2 플레이로 최종 무결성.

## 7. 진행 상태 (각 슬라이스 `/slice-wrap`이 갱신)

- [x] P0-1 행동 벡터 포맷 + emitter (`harness/vector.ts`, record→replay 바이트동일 입증)
- [ ] P0-2 zero-f64 정수화 (동작변경 승인)
- [ ] P0-3 전역상태→컨텍스트
- [ ] P0-4 데이터 JSON화
- [ ] P0-5 DATA-SERIALIZATION-CONTRACT
- [ ] P1-6 Rust workspace(types/rng/canonical)
- [ ] P1-7 데이터 로더
- [ ] P1-8 런 그래프
- [ ] P1-9 전투 수직 슬라이스
- [ ] P1-10~11 골든/스트레스 벡터 재생
- [ ] P1-12 Tauri 세션 API
- [ ] P1-13 프론트 피처플래그 → 최종 Tauri2 검증
