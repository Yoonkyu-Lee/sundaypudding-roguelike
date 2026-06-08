# DOC-INDEX — `docs/` 문서 인덱스 (여기서 시작)

> **이 문서 = `docs/` 폴더의 허브.** 어떤 문서가 무엇을 담고 언제 읽는지의 단일 색인. **정보가 어디 있는지 모르면 이 표부터.**
> 코드 위치는 코드 전용 지도 [`CODE-MAP.md`](CODE-MAP.md)가 담당 — 이 문서는 **문서**를 가리킨다.

---

## 🧭 설계 — 게임이 무엇이고 어떻게 동작하나

| 문서 | 무엇 | 언제 읽나 |
|---|---|---|
| **게임 명세** = [`game-design/`](game-design/) (아래 § 장 색인) | **규칙·수치·설계 결정의 SoT.** 전투·상태이상·캐릭터·전직·런·엔진 | 게임 로직을 만들거나 바꿀 때 |
| [`ROADMAP.md`](ROADMAP.md) | **다음 작업 우선순위 SoT** + 확정된 게임 모델(런 중심 로그라이크) | "다음에 뭐 만들지" 정할 때 |
| [`BACKLOG.md`](BACKLOG.md) | **실행 슬라이스 백로그 (자동 루프 SoT).** 순서표 — `/slice-plan→구현→/slice-wrap` 반복. 현재=야인시대 런1 수직슬라이스 | 슬라이스 실행/자동 루프 |
| [`Yainsidae/`](Yainsidae/) | 야인시대 대본 지식베이스(요약124·아크8·런설계8) — 콘텐츠 원천 | 캐릭/스킬/런 콘텐츠 설계 |
| [`SHELL-DESIGN.md`](SHELL-DESIGN.md) | 게임 겉 구조(타이틀·모드·런 선택, 본산 폐기) | 화면 흐름·모드·메타 루프 |
| [`NODE-DESIGN.md`](NODE-DESIGN.md) | 노드 내부 설계 회의(레이어 모델, 진행 중) | 노드 콘텐츠·레이어 |
| [`DESIGNER-INTERVIEW.md`](DESIGNER-INTERVIEW.md) | 디자이너 인터뷰 원문(롱텀 동기·전직 모델) | 게임 방향 확인 |

## 🔧 코드 · 테스트 · 계약

| 문서 | 무엇 | 언제 읽나 |
|---|---|---|
| [`CODE-MAP.md`](CODE-MAP.md) | **코드 매핑** — 워크스페이스·모듈 트리·기능→파일 | 작업 전, 어디 고칠지 찾을 때 |
| [`TEST-MAP.md`](TEST-MAP.md) | **테스트 카탈로그** — 각 테스트가 무엇을 보증하나 | 관련 테스트 찾기 / 새 테스트 추가·정리 |
| [`DATA-SERIALIZATION-CONTRACT.md`](DATA-SERIALIZATION-CONTRACT.md) | 데이터 직렬화 계약(콘텐츠 TS↔Rust, 드리프트 가드) | 콘텐츠 필드 추가/변경 |
| [`SERIALIZATION-CONTRACT.md`](SERIALIZATION-CONTRACT.md) | 이벤트 로그 직렬화 계약(canonical·바이트 동일) | 이벤트/로그/differential 다룰 때 |
| [`NUMERIC-POLICY.md`](NUMERIC-POLICY.md) | 수치 정책(정수화·f64 금지·결정론) | 수치/배율/확률 다룰 때 |
| [`INVARIANTS.md`](INVARIANTS.md) | 불변식 카탈로그(결정론·순수성 보증) | 결정론·회귀 점검 |

## 📦 이력 · 기타

| 문서 | 무엇 | 언제 읽나 |
|---|---|---|
| [`PORTING.md`](PORTING.md) | TS→Rust 마이그레이션 이력(완료) | Rust 엔진·아카이브(`archive/ts-core`) 참조 |
| [`UI-GLOSSARY.md`](UI-GLOSSARY.md) | GUI 도메인 명칭 SoT(화면·패널 통일 이름) | GUI 만들거나 부를 때 |
| [`../README.md`](../README.md) | 실행법·아키텍처 요약 | 돌려볼 때 |
| [`../web/src/content/README.md`](../web/src/content/README.md) | 디자이너 콘텐츠 작성 가이드 | 콘텐츠 저작 |

---

## 📖 게임 명세 장 색인 (`game-design/`)

> 본문이 길어 **장(章)별 파일로 분리**(`docs/game-design/`). **절 번호(예: `8.8`·`4.7`·`2.11`)는 안정 식별자** — 타 문서·코드 주석·커밋은 `GAME-DESIGN 8.8`처럼 이 번호로 참조하고, 아래 표에서 장 파일을 찾는다. 파일이 갈려도 번호는 안 바뀐다.

| 장 | 파일 | 내용 |
|---|---|---|
| **0·1** | [`game-design/00-overview.md`](game-design/00-overview.md) | 북극성(설계 기준)·대원칙(엔진=일반형/모드=제한 설정)·수치 투명성 · 장르 정의 |
| **2** | [`game-design/02-combat.md`](game-design/02-combat.md) | 전투 코어 — 전장(4×4)·턴 서열(라운드제 SPD)·행동 경제·타겟팅(위치 마스크)·데미지·능력치·명중·치명·쉴드·쿨타임·끼어들기 |
| **3** | [`game-design/03-status.md`](game-design/03-status.md) | 상태이상 & 특수효과 — 타임드 인스턴스 원장·점진 공개·전역 vs 특수효과·목록·데미지 보정·프리미티브 |
| **4** | [`game-design/04-character.md`](game-design/04-character.md) | 캐릭터 & 성장(육성) — 모델·파워 레버·장착 3칸·숙련도·보상 화면·강화 티어·**전직(4.7)** |
| **5** | [`game-design/05-roguelike-loop.md`](game-design/05-roguelike-loop.md) | 로그라이크 루프 — ⚠️ **부분 재정렬됨**(아래 주의) |
| **6** | [`game-design/06-formation.md`](game-design/06-formation.md) | ★ 포메이션 변주(차별점) — 열보너스 총량보존·그리드·변주 원천·동적 재배치 |
| **7** | [`game-design/07-run.md`](game-design/07-run.md) | 런 구조 & 승패 — 맵 위상(헥스 인접 무방향그래프)·노드 종류·런 길이·모드와의 관계 |
| **8** | [`game-design/08-engine.md`](game-design/08-engine.md) | 자체 엔진 & 인프라 — 헤드리스 코어·AI 인터페이스·결정론·기술 스택·연출(이벤트 재생)·데이터 주도·**구현 상태(8.7)**·**데이터↔엔진 경계 + 프리미티브 카탈로그(8.8)** |
| **부록** | [`game-design/99-appendix.md`](game-design/99-appendix.md) | A. 확정 결정 로그(요약) · B. 미해결 항목 |

> 명세 작성 방식: 디렉터(Claude) ↔ 기획자 grill-me 인터뷰로 한 칸씩 확정. 상태 범례: `✓ 확정` · `★ 차별화 후보` · `☐ 미정`. 새 규칙 확정/구현 시 해당 장 파일을 갱신(절 번호 유지) + 8.7 구현 상태·8.8 프리미티브 카탈로그 반영.

### ⚠️ 5장 주의 (2026-06 디자이너 인터뷰로 재정렬)
5장(로그라이크 루프 — 본산 & 기억 회랑)의 **본산 영구 투자·메타 재화·두 트랙 분리** 모델은 인터뷰로 **폐기/재정렬**됐다(런 중심 로그라이크 전환, 영구 성장=숙련도→스킬풀 하나). 현행 모델 = [`ROADMAP.md`](ROADMAP.md) § 확정된 게임 모델 · [`SHELL-DESIGN.md`](SHELL-DESIGN.md) · [`DESIGNER-INTERVIEW.md`](DESIGNER-INTERVIEW.md). 5장 본문은 **변경 전 기록**으로 보존(추후 재작성 대상).
