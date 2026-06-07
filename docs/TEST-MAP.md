# TEST-MAP.md — 테스트 카탈로그

각 테스트가 **무엇을 보증하는지** 한 줄 색인. 게이트 = `npm run check`(typecheck·web test·cargo test·줄수·순수성·배럴·드리프트). 엔진 결정론·differential은 `cargo test --manifest-path engine/Cargo.toml`.

> **용어**: *parity* = TS 골든 오라클(은퇴, `archive/ts-core`)이 만든 기댓값과 바이트 동일. *differential* = 기록된 행동 벡터를 Rust가 재생 → 전체 이벤트 로그 바이트 동일(동결 회귀 벡터, `engine/spr-core/tests/*.generated.json`). 신규 메커니즘은 parity 대신 **타겟 단위/통합 + 동결 픽스처**로 검증.

---

## 1. Rust 엔진 (`cargo test`)

### 1.1 결정론 기반 — `spr-types` / `spr-data`
| 테스트 | 파일 | 무엇을 보증 |
|---|---|---|
| `parity_next_u32` | `spr-types/src/rng.rs` | mulberry32 u32 시퀀스가 TS와 바이트 동일 |
| `parity_int_chance` | `spr-types/src/rng.rs` | `int(lo,hi)`·`chance(pct)` 분포가 TS와 동일(시드별) |
| `int_clamp_and_clone` | `spr-types/src/rng.rs` | 범위 클램프 + RNG 복제 시 상태 보존 |
| `sorts_keys_integers_arrays` | `spr-types/src/canonical.rs` | canonical JSON: 키 사전정렬·정수·배열 순서 보존 |
| `omits_none_like_undefined` | `spr-types/src/canonical.rs` | `None` 필드 생략(absent ≠ null) = TS `undefined` 거동 |
| `roundtrip_canonical_matches_committed` | `spr-data/src/lib.rs` | Rust canonical(번들) == 커밋된 `data.generated.json` 바이트(전 실데이터) |
| `top_level_maps_present` | `spr-data/src/lib.rs` | 번들 최상위 맵 존재 + skills 개수 가드(콘텐츠 추가 감지) |

### 1.2 전투 코어 — `spr-core/src`
| 테스트 | 파일 | 무엇을 보증 |
|---|---|---|
| `compute_damage_parity` | `damage.rs` | 데미지 산식(쉴드·관통·곱/합연산·crit) parity |
| `deal_raw_damage_parity` | `damage.rs` | 원시 피해 적용(쉴드 잠식·HP) parity |
| `resolve_skill_hit_parity` | `skills.rs` | 명중 시 스킬 해소(효과 순서·이벤트) parity |
| `resolve_skill_miss_parity` | `skills.rs` | 빗맞음 처리 parity |
| `resolve_skill_with_passives_parity` | `skills.rs` | 하이브리드 스킬(능동+패시브) 해소 parity |
| `area_cells_shapes` | `targeting.rs` | AreaShape(단일·행·열·십자·면적·free) 셀 계산 |
| `targeting_parity` | `targeting.rs` | 타겟 마스크·`reach` 동적 도달열 parity |
| `apply_and_tick_parity` | `status.rs` | 상태이상 적용 + DoT/HoT 틱(시점별) parity |
| `insert_interrupts_order_and_events` | `interrupt.rs` | 끼어들기 서열 삽입 순서 + 이벤트 |
| `predict_from_buff_grants_interrupt` | `interrupt.rs` | 버프(grantsInterrupt) 출처 끼어들기 예측 |
| `formation_parity` | `formation.rs` | 포메이션 열보너스 총량보존 분배 parity |
| `parity_create_battle_demo_seed42` | `battle.rs` | 데모 전투 생성(서열·룰 컴파일) 로그 parity |
| `create_battle_grown_differential` | `battle.rs` | 성장 파티(장착·계승상태·노드룰) 풀 전투 differential |
| `full_battle_differential_seed42` | `flow.rs` | step 루프 전 과정(seed42) 전투 로그 differential |
| `observation_parity_seed42` | `observation.rs` | `buildObservation`(AI/플레이어 관측 DTO) parity |
| `preview_parity` | `preview.rs` | 데미지/HP손실 미리보기(머리위 예고) parity |
| `ai_driven_full_battle_differential` | `ai.rs` | AI 정책 자동 플레이 전투 differential |
| `hex_adjacency` | `graph.rs` | 헥스 인접 판정(축 좌표) |
| `parity_validate_and_reachable` | `graph.rs` | 런 그래프 검증(`validateRun`)·도달성(`liveReachable`) parity |
| `session_deltas_concatenate_to_full_log` | `src/session.rs` | 데모 세션 이벤트 델타 누적 == 전체 로그 |

### 1.3 런 오케스트레이션 — `spr-core/src/run`
| 테스트 | 파일 | 무엇을 보증 |
|---|---|---|
| `create_run_parity` | `run.rs` | 런 생성(파티·RNG시드·도달성) parity |
| `heal_and_party_mutations` | `run.rs` | 회복/파티 상태 변이 helpers |
| `full_run_differential` | `run.rs` | yain 풀 런 자동 네비(전투·보상·상점·인카운터·전직 skip) 최종상태 동결 회귀 (`SPR_UPDATE_GOLDEN=1`로 재생성) |
| `get_run_view_parity` | `view.rs` | `RunView` DTO(맵/파티/보상) parity |
| `fire_run_trigger_parity` | `passives.rs` | 모험 스코프 패시브(nodeEnter/goldGain 등) 발동 parity |
| `gen_rewards_differential` | `rewards.rs` | 보상 추첨(등급별 N택1·풀순서·RNG) differential |
| `reward_gate_class_and_mastery` | `rewards.rs` | 보상 게이트 `reward_gate_ok` — 숙련도(masteryReq)·전직(classReq) 차단 로직 (4.7) |
| `class_reward_pool_surfaces_at_tier` | `rewards.rs` | **[전직 끝-끝]** 전직기(박치기·종로호령)가 차수 0엔 풀에 없고 차수 1에 편입 |
| `run_session_drives_full_run` | `run/session.rs` | `RunSession`(IPC 진입점)이 풀 런을 끝까지 구동 |
| `save_load_round_trip_deterministic` | `run/session.rs` | mid-battle 세이브→로드 후 동일 구동 → 델타 바이트 동일 |
| `battle_step_returns_post_resolve_view` | `run/session.rs` | 막타 후 뷰가 resolve 후 phase 반영(전투종료 프리즈 회귀가드) |
| `battle_step_targetcell_player_action` | `run/session.rs` | 플레이어 타겟칸 지정 행동 1스텝 |

### 1.4 전직 시스템 (4.7) — `spr-core/src/run/jobs.rs`
| 테스트 | 무엇을 보증 |
|---|---|
| `create_run_seeds_root_job` | 런 시작 시 캐릭에 루트 직업·차수0·부여trait 없음 세팅 |
| `class_change_advances_grants_and_validates_edge` | 전직 = 트리 간선 검증 + 차수↑ + 패시브 누적, 전투중·무효간선 거부 |
| `class_options_lists_advances_to` | 현재 직업의 전직 가능 갈래 목록 |
| `job_trait_compiles_into_unit_rules` | 부여 trait가 유닛 룰 컴파일에 +1 포함 |
| `class_change_layer_blocks_resolves_and_advances` | **[통합]** 전직 노드 진입→classChange 블록→선택→스킵→레이어 종료·노드 완료 |
| `job_passive_fires_in_battle_after_class_change` | **[끝-끝]** 전직(두목) 후 실제 전투 battleStart에 아군 공위증 발동(두목의 의리) |
| `class_change_survives_save_roundtrip` | 전직 상태(직업·차수·trait) 세이브 왕복 보존 |

### 1.5 differential 코퍼스 — `spr-core/tests`
| 테스트 | 무엇을 보증 |
|---|---|
| `replay_diff_corpus_byte_identical` | 40벡터(skip·AoE·free-cell·사망·패시브) 재생 → 전체 로그 시드별 바이트 동일 |

---

## 2. 웹 / 에디터 (`npm test`, `node --test`)

### 2.1 헥스 기하 — `web/src/ui/hexgeo.test.ts`
- 인접 6방향 셀이 변(꼭짓점 2개)을 정확히 공유 = 완벽한 벌집 / 비인접은 꼭짓점 비공유 / 변 길이 균일.
- `edgeDirIndex`+`cornerOffsets` = 방향 이웃과의 공유 변(맵 벽 기하 SoT), `EDGE_DIRS`의 역함수(V2).
- `EDGE_DIRS`(에디터 벽) ↔ 엔진 `hexAdjacent` 동치(V3, 교차 모듈 회귀가드). `pixelToAxial∘셀중심` 항등(라운드트립).

### 2.2 에디터 그래프 연산 — `web/src/ui/editor/ops.test.ts`
- `addNode`(빈칸 추가·점유 무시·인접 자동연결·defaultCore 시드)·`toggleEdge`(인접만)·`deleteNode`(입장노드 보호)·`moveNode(s)`(점유 무시·변 재계산·군집 평행이동·원자적 취소).
- `setNodeLabel`(트림)·`adjacentPairs`(무방향 인접쌍)·층 편집(add/delete/move)·id 유일성(U1)·좌표외 필드 불변(U3)·변=인접쌍 교차검증(U4/U7).

### 2.3 에디터 데이터 정합 — `web/src/ui/editor/editor-data.test.ts`
- `saveTemplate`(content deep-clone·빈 이름 대체·id 유일/get/delete)·`blankRun`(즉시 validateRun 통과)·JSON 왕복 동치·`cloneAsDraft`(deep-clone·새 id)·`LAYER_KINDS∪DECO_KINDS ⊆ LAYER_SPECS`(레이어 카탈로그 정합, classChange 포함)·`addNodeFromTemplate`(deep-clone 배치).

---

## 3. 빈틈 (자동 검증 안 되는 것 — 수동/실플레이)
- **플레이어 표면(웹 렌더·IPC 왕복)**: `npm run build`/typecheck만 자동. 실제 화면·상호작용은 `npm run dev` + 데스크톱 실플레이로 확인(전직 화면은 yain **쉼터** 노드 진입). 관례 = "로직은 결정론 테스트, 표면은 실플레이"(CLAUDE.md).
- **full-run 골든의 성격**: 결정론·무회귀 **앵커**(그리디 AI라 현재 3시드 다 lost로 종료) — "게임이 승리 가능/기능 작동"의 오라클이 아님. 기능 정확성은 §1.4 같은 타겟 테스트가 담당.
