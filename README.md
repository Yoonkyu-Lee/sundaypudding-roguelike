# Sunday Pudding Roguelike — 엔진

육성형 로그라이크의 **헤드리스 결정론 전투 코어 + CLI**.
설계 진실의 원천(SoT): [`docs/GAME-DESIGN.md`](docs/GAME-DESIGN.md).

## 요구사항
- **Node ≥ 24** (네이티브 TypeScript 실행 — 빌드 스텝 없음).

## 실행
```bash
npm run dev           # 웹 렌더러 (브라우저로 관전·플레이) → http://localhost:5173
npm run demo          # 터미널 자동플레이 1판 (양측 AI), seed 42
npm run play          # 터미널 대화형: 아군=당신, 적=AI
node src/cli/play.ts --demo --seed 7    # 시드 지정
npm test              # 결정론 + 기능 단위 테스트 (11개)
npm run typecheck     # 코어 + 웹 타입체크 (devDeps 설치 후)
```

> 웹은 `npm install` 후 `npm run dev` → 브라우저에서 localhost:5173. 코어는 무수정으로 브라우저 구동(Vite).

> 외부 런타임 의존성 0. `typescript`/`@types/node`는 타입체크 전용 devDependency.

## 아키텍처 (GAME-DESIGN.md 8장)
```
src/
  core/        ← 순수·결정론 엔진 (렌더링 의존 0)
    rng.ts        시드 PRNG (mulberry32). 모든 무작위의 단일 출처
    types.ts      타입 스키마 = 명세서. GameState/Unit/Skill/Status/Observation/Action…
    engine.ts     createBattle / getLegalActions / step  ← 게임 로직 전부
    observation.ts buildObservation(JSON) + renderAscii(텍스트 보드)
    ai.ts         결정론 휴리스틱 정책 (적 조종/데모)
    engine.test.ts 결정론·기능 테스트
  data/        ← 데이터 주도 (8.6): 엔진은 이걸 해석만 한다
    statuses.ts  상태이상 정의 (화상/중독/출혈/빙결/동상)
    skills.ts    스킬 (위치마스크·쿨타임·명중·효과)
    characters.ts 캐릭터 (포켓몬式 고유 스탯 + learnset)
    encounters.ts 전투 배치
  cli/
    play.ts      터미널 드라이버 (사람용). AI는 core를 직접 import해 플레이
  web/         ← 웹 렌더러 (Vite, npm run dev). 같은 core 구독 + 이벤트 로그 재생
    main.ts      게임 루프 (아군=클릭, 적=AI)
    render.ts    DOM 렌더 + formatEvent
    style.css
```

**AI/모니터링 인터페이스 (8.2):** 스크린샷이 아니라 `buildObservation(state)`(matrix/JSON) +
`getLegalActions(state)` + `step(state, action)`. 사람이 보는 ASCII = AI가 읽는 JSON = 같은 코어 상태.

## 이 슬라이스에 구현된 것 (핵심 전투 전체)
- 4×4 그리드 진형 / 라운드제 SPD 주사위 서열 / 1턴 1행동 / 위치 마스크 타겟팅
- 스킬 상수 데미지 (ATK/DEF·속성 없음) / 명중 = (명중률+스킬명중)−DEX / 치명타
- 쉴드(덤 HP, 피해 흡수) / 상태이상 원장(화상·중독·출혈·빙결·동상)
- 스킬 쿨타임 / 끼어들기(interrupt, 차감 무시) / 동적 재배치(밀치기) / "쓸 기술 없음" 스킵
- 승패 판정 / 시드 결정론 / 이벤트 로그

## 아직 (다음 슬라이스)
본산·메타·기억회랑 / 런 노드맵·보상화면 / 공포·관통·불사·재생 / 적 전용 AI /
웹 렌더러 고도화(스프라이트·애니메이션) / 밸런싱. (GAME-DESIGN.md 부록 B 참조)
