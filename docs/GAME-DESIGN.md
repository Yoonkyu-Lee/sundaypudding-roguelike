# 게임 시스템 명세서 — 인덱스 (작업 제목: *Sundaypudding Roguelike*)

> 이 문서는 **공략집/나무위키형 시스템 명세**다. "이 게임의 시스템이 어떻게 동작하는가"를
> 에셋·스토리 없이 **규칙 레벨로** 서술한다. 구현(자체 엔진)은 이 문서를 진실의 원천(source of truth)으로 삼는다.
>
> 작성 방식: 디렉터(Claude) ↔ 기획자(사용자)의 grill-me 인터뷰로 한 칸씩 확정해 나간다.
> 상태 범례: `✓ 확정` · `★ 차별화 후보` · `☐ 미정/후속 인터뷰 예정`

> 📑 **분할 안내**: 본문이 길어 **장(章)별 파일로 분리**(`docs/game-design/`)했다. 이 문서는 **인덱스**다.
> **절 번호(예: `8.8`·`4.7`·`2.11`)는 전체 명세 기준 안정 식별자** — 타 문서·커밋은 `GAME-DESIGN 8.8`처럼 이 번호로 참조하고, 아래 표에서 해당 장 파일을 찾는다. 파일이 갈려도 번호는 안 바뀐다.

---

## 장(章) 색인

| 장 | 파일 | 내용 |
|---|---|---|
| **0·1** | [`game-design/00-overview.md`](game-design/00-overview.md) | 북극성(설계 기준)·대원칙(엔진=일반형/모드=제한 설정)·수치 투명성 원칙 · 장르 정의 |
| **2** | [`game-design/02-combat.md`](game-design/02-combat.md) | 전투 코어 — 전장(4×4)·턴 서열(라운드제 SPD 주사위)·행동 경제·타겟팅(위치 마스크)·데미지·능력치·명중·치명·쉴드·쿨타임·끼어들기 |
| **3** | [`game-design/03-status.md`](game-design/03-status.md) | 상태이상 & 특수효과 — 타임드 인스턴스 원장·점진 공개·전역 상태 vs 특수효과·목록·데미지 보정 규칙·프리미티브 |
| **4** | [`game-design/04-character.md`](game-design/04-character.md) | 캐릭터 & 성장(육성) — 모델·파워 레버·장착 3칸·숙련도·전투 보상 화면·강화 티어·**전직 시스템(4.7)** |
| **5** | [`game-design/05-roguelike-loop.md`](game-design/05-roguelike-loop.md) | 로그라이크 루프 — ⚠️ **부분 재정렬됨**(아래 주의) |
| **6** | [`game-design/06-formation.md`](game-design/06-formation.md) | ★ 포메이션 변주(차별점) — 열보너스 총량보존·그리드·변주 원천·동적 재배치 |
| **7** | [`game-design/07-run.md`](game-design/07-run.md) | 런 구조 & 승패 — 맵 위상(헥스 인접 무방향그래프)·노드 종류·런 길이·모드와의 관계 |
| **8** | [`game-design/08-engine.md`](game-design/08-engine.md) | 자체 엔진 & 인프라 — 헤드리스 코어·AI 인터페이스·결정론·기술 스택·연출(이벤트 재생)·데이터 주도·**구현 상태(8.7)**·**데이터↔엔진 경계 + 프리미티브 카탈로그(8.8)** |
| **부록** | [`game-design/99-appendix.md`](game-design/99-appendix.md) | A. 확정 결정 로그(요약) · B. 미해결 항목 |

## ⚠️ 5장 주의 (2026-06 디자이너 인터뷰로 재정렬)

5장(로그라이크 루프 — 본산 & 기억 회랑)의 **본산 영구 투자·메타 재화·두 트랙 분리** 모델은 인터뷰로 **폐기/재정렬**됐다(런 중심 로그라이크로 전환, 영구 성장=숙련도→스킬풀 하나). 현행 모델 = [`ROADMAP.md`](ROADMAP.md) § 확정된 게임 모델 · [`SHELL-DESIGN.md`](SHELL-DESIGN.md) · [`DESIGNER-INTERVIEW.md`](DESIGNER-INTERVIEW.md). 5장 본문은 **변경 전 기록**으로 보존(추후 재작성 대상).

## 관련 문서
- 다음 작업 우선순위 = [`ROADMAP.md`](ROADMAP.md) · 겉 구조 = [`SHELL-DESIGN.md`](SHELL-DESIGN.md) · 노드 내부 = [`NODE-DESIGN.md`](NODE-DESIGN.md)
- 코드 매핑 = [`CODE-MAP.md`](CODE-MAP.md) · 테스트 카탈로그 = [`TEST-MAP.md`](TEST-MAP.md) · 데이터 계약 = [`DATA-SERIALIZATION-CONTRACT.md`](DATA-SERIALIZATION-CONTRACT.md)
