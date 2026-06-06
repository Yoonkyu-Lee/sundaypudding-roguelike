# Sundaypudding Roguelike — 엔진

육성형 로그라이크의 **결정론 전투 코어 + 웹 GUI + CLI**. 자체 엔진(빌드 스텝 없는 네이티브 TypeScript).

- 설계 진실의 원천(SoT): [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md)
- 코드 지도: [`docs/CODE-MAP.md`](docs/CODE-MAP.md)
- **디자이너 가이드**(스킬·캐릭터 등 콘텐츠 제작): [`src/data/README.md`](src/data/README.md)

## 요구사항
- **Node ≥ 24** (네이티브 TypeScript 실행 — 빌드 스텝 없음). 외부 런타임 의존성 0.

## 실행
**엔진 = Rust(`rust/spr-core`), 프론트 = 웹(Tauri IPC).** 제품 셸은 Tauri 데스크톱 앱(`app/`).
```bash
npm install           # 최초 1회 (devDeps: typescript, vite — 타입체크·웹 전용)
# 게임 구동(데스크톱): 터미널1 = vite, 터미널2 = Tauri 앱
npm run dev           # 웹 프론트 dev 서버 → http://localhost:5173
cd app && cargo build && ./target/debug/spr-app.exe   # Rust 풀게임 부팅(기본 = Rust)
npm test              # 웹/에디터 단위 테스트 (node --test)
cargo test --manifest-path rust/Cargo.toml   # Rust 엔진 — differential 회귀 벡터·save-roundtrip
npm run data:export   # 데이터 JSON 번들 재생성(src/data 변경 시) → data.generated.json (Rust 로드용)
npm run typecheck     # 계약타입(코어) + 웹 타입체크
npm run check         # 통합 게이트 (타입·web test·cargo test·줄수·코어순수성·배럴)
npm run build:app     # 단일 HTML 빌드 → dist/index.html
```

> **TS 엔진은 은퇴**(Rust로 마이그레이션 완료). TS 골든 엔진 + differential 하네스는 `archive/ts-core` 브랜치 + `tag ts-golden-oracle`에 보관. 상세: [`docs/PORTING.md`](docs/PORTING.md).

## 아키텍처 (상세: GAME-DESIGN.md 8장)
```
src/
  core/        순수·결정론 엔진 (렌더링/IO 의존 0)
    rng.ts          시드 PRNG (mulberry32) — 모든 무작위의 단일 출처
    types/          타입 스키마 (content=데이터 스키마 · runtime=런타임 상태)
    combat/         전투 엔진 (createBattle · getLegalActions · step · 끼어들기 · 포메이션…)
    run/            런 진행 (헥스 맵 · 노드 · 보상 · 상점 · 세이브 · 파티 편성)
    ai/             결정론 휴리스틱 정책 (적 조종 / 데모)
    observation.ts  buildObservation(JSON) — 결정에 필요한 정보 노출
    *.test.ts       결정론 · 기능 단위 테스트
  data/        데이터 주도 — 엔진은 이걸 '해석'만 한다  ← ★ 디자이너 영역 (src/data/README.md)
    skills.ts · statuses.ts · characters.ts · items.ts
    formations.ts · maps.ts · modes.ts · encounters.ts · events.ts
  cli/         터미널 드라이버 (개발·검증용; play.ts · ascii.ts)
  web/         웹 GUI (Vite) — 같은 core 구독 + 이벤트 로그 재생
    main.ts · render.ts · runRender.ts · shell.ts · partyView.ts · charSheet.ts · battle/ · style.css
```

**원칙**: 단방향 의존 `data → types ← core → views(cli/web)`. 메커니즘은 엔진(`core/`), 값·콘텐츠는 데이터(`data/`).
새 콘텐츠가 기존 엔진 프리미티브 조합으로 표현되면 **데이터만** 추가하면 되고, 그렇지 않으면 엔진 확장이 필요하다 — 경계와 작업 분담은 [`src/data/README.md`](src/data/README.md) 참고.

## 로드맵
- 스킬 편성 GUI 개편
- `main.ts` 분리 및 리팩토링
- 적 전용 AI / 패턴, 적 스탯 액트 스케일링
- 추가 모드(캠페인 / 챌린지) + 모드 선택 UI
- 본산 메타 재화 · 추가 해금
- 웹 렌더러 고도화(스프라이트 / 애니메이션) · 사운드
- 콘텐츠 확장 · 밸런싱
