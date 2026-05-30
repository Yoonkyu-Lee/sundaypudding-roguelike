# 코드 매핑 (CODE-MAP)

> **목적**: "어떤 코드 파일이 무슨 역할인지"를 한눈에. 작업 전 이 문서를 읽어 맥락을 잡고,
> 의미 있는 슬라이스를 완료하면 이 문서를 **반드시 갱신**한다. (규칙: `CLAUDE.md`)
>
> 게임 규칙 자체는 여기 적지 않는다 → [`GAME-DESIGN.md`](GAME-DESIGN.md)가 그 SoT.

## 레이어 개요

```
src/
  core/   ← 순수·결정론 게임 로직. 렌더링/IO 의존 0. (GAME-DESIGN 8.1)
  data/   ← 데이터 주도 콘텐츠. 엔진은 이걸 "해석"만. (8.6)
  cli/    ← 터미널 드라이버(사람용 IO). core를 소비.
  web/    ← 웹 렌더러(사람용 뷰). 같은 core 상태를 구독 + 이벤트 로그 재생 (8.5)
```

규칙: **core는 절대 console/DOM/readline을 직접 만지지 않는다.** IO는 cli/·web/에서만.
타입 레벨 강제: `tsconfig.json`(코어/CLI, DOM lib 없음) vs `tsconfig.web.json`(웹, DOM lib).

## 파일별 책임

| 파일 | 레이어 | 책임 | 핵심 export |
|---|---|---|---|
| `src/core/rng.ts` | core | 시드 PRNG. **모든 무작위의 유일한 출처**(결정론, 8.3) | `Rng` |
| `src/core/types.ts` | core | **타입 스키마 = 명세서.** 모든 상태/행동/관측/이벤트 타입 | (모든 타입) |
| `src/core/engine.ts` | core | 게임 로직 전부. 상태+행동→다음상태 | `createBattle` · `getLegalActions` · `step` · `computeHitChance` |
| `src/core/observation.ts` | core | 관측 빌드(JSON) + ASCII 보드 렌더 | `buildObservation` · `renderAscii` |
| `src/core/ai.ts` | core | 결정론 휴리스틱 정책(데모/적 조종) | `chooseAction` |
| `src/core/engine.test.ts` | core | 결정론·기능 단위 테스트 | — |
| `src/data/statuses.ts` | data | 상태이상 정의(거동 데이터) | `STATUS_DEFS` |
| `src/data/skills.ts` | data | 스킬(위치마스크·쿨타임·명중·효과) | `SKILLS` |
| `src/data/characters.ts` | data | 캐릭터(고유 스탯 + learnset) | `CHARACTERS` |
| `src/data/encounters.ts` | data | 전투 배치(+보스/포메이션 override) | `DEMO_ENCOUNTER` · `Encounter` |
| `src/data/formations.ts` | data | 포메이션 열보너스 배치(총량보존, 6장) | `STANDARD_FORMATION` |
| `src/cli/play.ts` | cli | 대화형/`--demo` 터미널 드라이버 | (엔트리) |
| `src/web/main.ts` | web | 웹 엔트리·게임 루프(아군=클릭, 적=AI 자동) | (엔트리) |
| `src/web/render.ts` | web | DOM 렌더 + **2단계 타겟팅 GUI**(칸 하이라이트·머리위 명중%·눈금 화살표·HP 미리보기) + `formatEvent` | `renderApp` · `formatEvent` |
| `src/web/style.css` | web | 다크 테마 스타일 | — |
| `index.html` · `vite.config.ts` | web | Vite 진입/설정 (`npm run dev`) | — |

## 기능 → 위치 색인 (engine.ts 내부)

| 게임 기능 (GAME-DESIGN 참조) | 위치 |
|---|---|
| 라운드/SPD 주사위 서열 (2.2) | `startRound` / `advance` |
| 정규 턴 시작·종료 처리 (쿨타임 감소·DoT·지속시간 차감) | `onNormalTurnStart` / `onNormalTurnEnd` |
| 합법 행동 열거, 사정권/쿨다운/빙결 반영 (8.2/2.10) | `getLegalActions` / `validTargets` / `isFrozen` |
| 명중 판정 (2.7) | `computeHitChance` / `resolveSkill` |
| 데미지 계산·치명타·곱연산 순서 (3.7) | `computeDamage` |
| 쉴드→HP 피해 적용 (2.9) | `dealRawDamage` |
| 상태이상 원장 부여/틱(DoT+HoT) (3.1/3.5) | `applyStatusInstance` / `tickPeriodic` |
| 공포(쉴드잠식)·관통(쉴드무시)·불사(생존) (3.5/3.6) | `dealRawDamage` |
| HP 손실 미리보기(관통/공포 반영) | `previewHpLoss` |
| 스킬 효과 디스패치(데미지/상태/쉴드/힐/이동/끼어들기) (3.9) | `applyEffects` |
| 동적 재배치 (6.4) | `moveUnit` |
| 끼어들기 삽입 (2.11) | `applyEffects`의 `interruptSelf` 케이스 |
| 포메이션 열보너스·총량보존 (6.1/6.3) | `getFormationBonus` + `applyEffects`(damage/shield/heal에 합연산) |
| 데미지 미리보기(비크리 결정론, 타겟팅 UI용) | `previewDamage` |
| 승패 (7.3) | `checkWin` |
| 행동 1회 처리(턴 진행) | `step` |

## 미구현 → 들어갈 자리 (☐, 부록 B)

| 기능 | 예정 위치 |
|---|---|
| 런 노드맵·보상화면 (7장) | 신규 `core/run.ts` + `data/` |
| 메타/본산/기억회랑 (5장) | 신규 `core/meta.ts` (전투 위 레이어) |
| **적 전용 AI/패턴** | `core/ai.ts` (현재는 아군과 공유 정책) |
| 웹 렌더러 고도화(스프라이트/애니메이션) | `src/web/` (현재 v1: DOM 카드 + 피격 플래시 + 로그 재생) |
