# Sundaypudding Roguelike

육성형 로그라이크. **게임 엔진 = Rust(`engine/spr-core`)** · **GUI = 웹 프론트(Tauri 데스크톱 앱)**. 결정론·differential 검증.

- 설계 진실의 원천(SoT): [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md) (인덱스 — 장별 본문은 `docs/game-design/`)
- 코드 지도: [`docs/CODE-MAP.md`](docs/CODE-MAP.md) · 테스트 카탈로그: [`docs/TEST-MAP.md`](docs/TEST-MAP.md)
- **디자이너 가이드**(스킬·캐릭터 등 콘텐츠 제작): [`web/src/content/README.md`](web/src/content/README.md)

## 요구사항
- **Node ≥ 24** (네이티브 TypeScript 실행 — 빌드 스텝 없음). 외부 런타임 의존성 0.

## 실행
**엔진 = Rust(`engine/spr-core`), 프론트 = 웹(Tauri IPC).** 제품 셸은 Tauri 데스크톱 앱(`desktop/`).
> ⚠️ **`package.json`은 `web/`에 있다(루트 아님).** 모든 `npm` 스크립트는 **`web/`에서** 실행 — 루트에서 `npm run dev`는 ENOENT. 루트에서 쓰려면 `npm --prefix web run <script>`.

```bash
npm install --prefix web   # 최초 1회 (devDeps: typescript, vite — 타입체크·웹 전용)

# ── 게임 구동(데스크톱): 터미널 2개 ──
cd web && npm run dev      # 터미널1: 웹 프론트 dev 서버 → http://localhost:5173
cd desktop && cargo build && ./target/debug/spr-app.exe   # 터미널2: Rust 풀게임 부팅(기본 = Rust)

# ── 검증/빌드 (npm = web/에서) ──
cd web && npm run check         # ★ 통합 게이트 (typecheck·web test·cargo test·줄수·코어순수성·배럴)
cd web && npm test              # 웹/에디터 단위 테스트만 (node --test)
cd web && npm run typecheck     # 계약타입(코어) + 웹 타입체크
cd web && npm run data:export   # 데이터 JSON 번들 재생성(web/src/content 변경 시) → data.generated.json (Rust 로드용)
cargo test --manifest-path engine/Cargo.toml   # (루트) Rust 엔진 — differential 회귀 벡터·save-roundtrip

# 배포(단일 실행 파일 — 인스톨러 불필요): 프론트 빌드 → Tauri 프로덕션 빌드
cd web && npm run build                                            # 프론트 → web/dist
cd ../desktop && ../web/node_modules/.bin/tauri build --no-bundle  # → desktop/target/release/spr-app.exe (프론트 임베드 단일 exe ~12MB)
```

> ⚠️ **`cargo build --release`는 프로덕션이 아니다.** Tauri의 dev/prod 전환은 cargo 프로필이 아니라 **`tauri build` CLI**가 설정한다 — cargo로 빌드한 release exe는 *dev 모드*(devUrl=`localhost:5173`)로 동작해 단독 실행 시 "연결 거부". 프로덕션 단일 exe는 반드시 위 `tauri build`로. (실행엔 시스템 **WebView2** 런타임 필요 — Win11 기본 내장. 자동 프론트 빌드는 `beforeBuildCommand` cwd 이슈로 비활성 → 위처럼 `npm run build` 선행.)
>
> **TS 엔진은 은퇴**(Rust로 마이그레이션 완료). TS 골든 엔진 + differential 하네스는 `archive/ts-core` 브랜치 + `tag ts-golden-oracle`에 보관. 상세: [`docs/PORTING.md`](docs/PORTING.md).

## 아키텍처 (상세: [`docs/CODE-MAP.md`](docs/CODE-MAP.md))
**폴리글랏 Tauri 앱** — 언어/역할별 최상위 분리:
```
engine/    Rust 게임 엔진 (Cargo workspace: spr-types ← spr-data ← spr-core). 전투·AI·런·세이브. 결정론·IO 0.
desktop/   Tauri2 셸 — 엔진을 IPC 커맨드(세션 API)로 노출. 프론트↔엔진 다리.
web/       TS 웹 프론트 (vite/npm 자족). 
  src/ui/        플레이어 GUI (타이틀·맵·전투·에디터…). Rust를 IPC로 구동.
  src/content/   게임 콘텐츠 데이터 (→ npm run data:export → JSON → 엔진 로드). ← ★ 디자이너 영역
  src/contract/  프론트↔엔진 계약 타입 + 순수 유틸(hex graph).
docs/ · web/scripts/(빌드·검증)
```
**흐름**: 플레이어 → `web/src/ui`(GUI) → invoke → `desktop`(IPC) → `engine/spr-core`(상태 변이) → 이벤트 델타·뷰 → 렌더.
**원칙**: 메커니즘=엔진(`engine`), 값·콘텐츠=데이터(`web/src/content`). 새 콘텐츠가 기존 프리미티브 조합으로 되면 **데이터만**, 아니면 엔진 확장 — 경계는 [`web/src/content/README.md`](web/src/content/README.md).

## 로드맵
다음 작업 우선순위 = [`docs/ROADMAP.md`](docs/ROADMAP.md) (본산 메타 육성 · 연출 엔진 · 지닌물건 · 콘텐츠 에디터).
- 콘텐츠 확장 · 밸런싱
