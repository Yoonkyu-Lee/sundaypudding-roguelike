# Sundaypudding Roguelike — 엔진

육성형 로그라이크의 **결정론 전투 코어 + 웹 GUI + CLI**. 자체 엔진(빌드 스텝 없는 네이티브 TypeScript).

- 설계 진실의 원천(SoT): [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md)
- 코드 지도: [`docs/CODE-MAP.md`](docs/CODE-MAP.md)
- **디자이너 가이드**(스킬·캐릭터 등 콘텐츠 제작): [`src/data/README.md`](src/data/README.md)

## 요구사항
- **Node ≥ 24** (네이티브 TypeScript 실행 — 빌드 스텝 없음). 외부 런타임 의존성 0.

## 실행
```bash
npm install           # 최초 1회 (devDeps: typescript, vite — 타입체크·웹 전용)
npm run dev           # 웹 GUI (브라우저로 플레이) → http://localhost:5173
npm run demo          # 터미널 자동플레이 1판 (양측 AI), seed 42
npm run play          # 터미널 대화형: 아군=당신, 적=AI
npm test              # 결정론 + 기능 단위 테스트 + 불변식/캠페인/세이브 harness
npm run campaign      # 대량 무작위 캠페인 스윕(기본 6만판) — 크래시·교착·불변식 위반 검출 (docs/MIGRATION-VERIFICATION-PLAN)
npm run typecheck     # 코어 + 웹 타입체크
npm run check         # 통합 게이트 (타입·테스트·줄수·코어순수성·데모회귀)
npm run build:app     # 단일 HTML 빌드 → dist/index.html (오프라인 실행 가능한 한 파일)
```

> `npm run build:app`이 만든 `dist/index.html`은 더블클릭하면 브라우저에서 바로 실행(서버 불필요). 그 파일만 공유하면 됨.

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
