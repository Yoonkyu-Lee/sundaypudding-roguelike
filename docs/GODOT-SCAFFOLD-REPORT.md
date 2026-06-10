# GODOT-SCAFFOLD-REPORT — 게임 쉘 스캐폴딩 완료 보고 (2026-06)

> **결론: 에디터를 제외한 게임 쉘 전 화면을 Godot에 스캐폴딩 완료.** 런 루프 전체가 네비게이블하고, 핵심 화면은 spr-core **실데이터로 구동**. 폴리시·미완 기능은 §3 백로그. 진행 SoT = [`RENDER-MIGRATION.md`](RENDER-MIGRATION.md) §5, 규칙 = [`GODOT-CONVENTIONS.md`](GODOT-CONVENTIONS.md).

## 1. 한 일 (슬라이스)
- **slice 0**: spr-godot 전체 명령 세트 + dll 갱신 + MCP(`godot-mcp-enhanced`) 연결(스크린샷 시각 검증).
- **slice 1**: 노드 맵 — RunView 헥스 그래프(노드 버튼+아이콘+status색, Line2D 엣지).
- **slice 2**: 전투 실데이터 — battle_obs로 아군/적 배치·HP, 행동 서열(SPD·현재), 스킬(legalActions) + 자동전투(ai_step 루프 완주).
- **slice 3**: 전직(classChange)·결과(won/lost) 화면 + GameDirector 라우트.
- **slice 4**: 캐릭터 도감 — RunView.party 카드(이름·HP·스킬).

## 2. 화면 인벤토리

| 화면 | 상태 | 데이터 | 스크린샷 검증 |
|---|---|---|---|
| boot/title/hub | ✅ 스캐폴드 | 정적(라우팅) | — |
| campaign_select | ✅ | `run_list` 실 런 목록 | — |
| **run_map** | ✅ | RunView.nodes/edges(헥스) | ✅ |
| **battle** | ✅ | battle_obs(아군·적·서열·스킬) | ✅ |
| reward/shop/encounter | ✅ | view.rewards/shop/encounter | — |
| class_change | ✅ 스캐폴드 | view.classChange | (빈 데이터 렌더) |
| result(won/lost) | ✅ 스캐폴드 | view.phase | — |
| **chardex** | ✅ 스캐폴드 | RunView.party | ✅ |
| pause(오버레이) | ✅ 플레이스홀더 | — | — |

런 루프: 허브 → 캠페인 → 런 선택 → **런 맵(실 노드)** → 노드 진입 → phase별 화면(전투/보상/상점/인카운터/전직) 자동 라우팅 → 승패 → 허브. **전부 spr-core 구동.**

## 3. 폴리시 · 미완 백로그 (다듬을 부분)

### A. 전투 (가장 큰 미완 — 실전투 인터랙션)
- **수동 전투 UI 없음**: 현재 "자동 전투"(양측 AI)로만 완주. 실전투(스킬 선택→타겟 칸/유닛→명중%·area 미리보기→실행)는 미구현 = 다음 큰 슬라이스. legalActions·battle_targeting·battle_step 바인딩은 준비됨.
- **이벤트→애니메이션**: `BattleDirector`가 스텁. 데미지 팝업·공격 모션·피격 플래시·상태칩·카메라 흔들림 = 이벤트 로그 소비해 연주(R3, 디자이너 협업).
- 상태칩·쉴드·쿨다운·HP바(현 텍스트 HP) 시각 표현.

### B. 시각 (스크린샷으로 확인된 것)
- **유닛 카드(파랑/빨강 쿼드)가 셀에 묻혀 안 보임** — 이름/HP 텍스트만 뜸. 카드를 더 띄우거나 대비/테두리. (battle.gd `_flat_quad` y/색)
- 이름표(Label3D) 높이·정렬, 노드 맵 노드 간격(HEX)·엣지 대비, 양 진영 중앙 간격.
- HUD 레이아웃 정밀화(패널 위치·여백) — 에디터에서 디자이너.
- 전반 "상용 모바일 게임 룩"(현재 = 웹 다크 테마 이식, 플랫).

### C. 미완 화면 기능
- **chardex 전체 해금 도감**: 현재 파티만. 전체 playable 캐릭 + 해금/seen 상태 = **`char_list` 명령(spr-godot) + meta(Godot 영속)** 필요.
- **파티 시트 / 장착 오버레이**: 미구현(web `run_sheet_data`/equip 바인딩은 있음).
- **허브 모드 카드**: 현재 단순 버튼 → 웹 `.hub-mode` 카드 룩.
- **일시정지**: pause.tscn은 플레이스홀더, 실제 호출(Esc) 미연결.
- 보상/상점/인카운터: 동작하나 카드 비주얼 단순.

### D. 인프라
- **세이브·이어하기**: `save`/`load` 바인딩 있음, 화면/영속 미연결.
- **dll 복사 자동화**: 현재 수동 `cp`(에디터 열림 시 잠김). 빌드+복사 스크립트 + 에디터 닫힘 가드.
- 스크린샷 출력 = ALLOWED_PROJECT_PATHS 내(`godot/*_shot.png`, gitignore)만 가능.

### E. 에셋 (후속·디자이너/생성)
- 스프라이트(유닛·아이콘)·파티클·테마 텍스처(9-slice). godogen식 AI 생성은 **HUD 레이아웃 확정 후** 실험.

## 4. 특이사항 · 발견 (scaffolding 중)
- **★ MCP 시각 루프 = 게임체인저**: 만들고 → `mcp screenshot capture`(헤드리스) → PNG를 AI가 Read로 보고 → 고침. 카메라·보드·HUD·노드맵·도감을 전부 내가 직접 보고 검증.
- **`bootstrap_demo`/`bootstrap_battle`**: 빈 상태로 화면 단독 실행 시 자동으로 런/전투를 만들어 데이터 채움 → **각 화면을 독립적으로 스크린샷** 가능(핵심 개발 affordance).
- **자동전투**(ai_step 루프)로 **실전투 UI 없이도 런 완주 가능** — 쉘 완결성 확보.
- **Godot 4.6 기본 폰트가 한글+이모지(📍⚔️👑…) 다 렌더** — 별도 폰트 불요(현재).
- **경계 = JSON 문자열**이 desktop IPC와 1:1로 깔끔 — 전 명령 무리 없이 노출.
- 헥스 렌더 = web `hexgeo` 공식(pointy-top axial `x=√3·s·(q+r/2)`, `y=1.5·s·r`) 그대로.
- **dll 잠금**: Godot 에디터 열려 있으면 `cp ...dll` 실패(busy). **co-edit**: `.tscn`을 에디터가 저장하면 uid·unique_id 정규화 → 파일/에디터 양쪽 수정 시 충돌 주의(구조=파일, 시각=에디터 분리).
- Godot 슬라이스 검증 = **스크린샷**(npm/cargo 게이트는 웹·엔진 무변이라 무관).

## 5. 다음 권장 순서
1. **전투 시각 개선**(유닛 카드 가시성·HP바·상태칩) — 빠른 시각 이득.
2. **수동 전투 UI**(스킬→타겟→실행) + **이벤트→애니메이션**(BattleDirector) — 게임의 알맹이, R3.
3. chardex 전체 도감(char_list+meta) · 파티 시트 · 세이브·이어하기.
4. 모바일 게임 룩 폴리시 + (확정 후) 에셋 생성 실험.
5. 패리티 도달 시 **Tauri 게임 경로 은퇴**(웹은 저작 에디터만 잔류).
