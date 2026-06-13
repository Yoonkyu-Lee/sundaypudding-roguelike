# GODOT-SCAFFOLD-REPORT — 게임 쉘 스캐폴딩 완료 보고 (2026-06)

> **결론: 에디터를 제외한 게임 쉘 전 화면을 Godot에 스캐폴딩 완료.** 런 루프 전체가 네비게이블하고, 핵심 화면은 spr-core **실데이터로 구동**. 폴리시·미완 기능은 §3 백로그. 진행 SoT = [`RENDER-MIGRATION.md`](RENDER-MIGRATION.md) §5, 규칙 = [`GODOT-CONVENTIONS.md`](GODOT-CONVENTIONS.md).

## 1. 한 일 (슬라이스)
- **slice 0**: spr-godot 전체 명령 세트 + dll 갱신 + MCP(`godot-mcp-enhanced`) 연결(스크린샷 시각 검증).
- **slice 1**: 노드 맵 — RunView 헥스 그래프(노드 버튼+아이콘+status색, Line2D 엣지).
- **slice 2**: 전투 실데이터 — battle_obs로 아군/적 배치·HP, 행동 서열(SPD·현재), 스킬(legalActions) + 자동전투(ai_step 루프 완주).
- **slice 3**: 전직(classChange)·결과(won/lost) 화면 + GameDirector 라우트.
- **slice 4**: 캐릭터 도감 — RunView.party 카드(이름·HP·스킬).
- **slice A**(전투 시각): 유닛 = 바닥 쿼드 → **서 있는 빌보드 카드**(이름·HP, 깊이무시 라벨) — 가시성 확보.
- **slice B**(노드 맵): 직사각 버튼 → **육각 타일 벌집**(어두운 몸체 + status색 테두리, web `.mnode/.mhex` 2겹) + **벽**(막힌 길 `#b0413b`) + 발광 도달가능. 연결선 폐기(web 동일 — reachable 발광으로 길 표현).
- **slice C**(수동 전투): **스킬→타겟 2단계 UI** — `legalActions`로 스킬 버튼→타겟 버튼(명중%)→`battle_step`. 적 턴 자동 진행(`_advance_enemy_turns`). `action_chosen` 시그널로 HUD↔씬 분리.
- **slice D**(주사위): `battle_init` **roundStart 델타 → dice_roll 인스턴스** 연출(주사위 회전→차례로 확정·`= speed`→최종 순위)→라이브 서열. web `timelinePanel` rolling 모드 모방.
- **slice E**(유닛 카드 데이터): 카드에 HP바(색=잔량)+쉴드·상태칩(icon·stacks)+HP텍스트 — UnitView 실데이터.
- **slice F**(하단 HUD 리레이아웃): **사용자 스케치(`전투 하단 HUD.jpg`) 구현** — 좌 `unit_panel.tscn`(현재 유닛: 체력바+숫자·스탯 창(SPD범위/명중/회피/크리+포메이션)·장비 3슬롯·상태이상 가로 스크롤) + **툴팁 공간**(호버/클릭 상세 단일 표시, `tips.gd`) + 큰 스킬 슬롯(가로 균등) + **턴 넘기기** 버튼. 스탯·장비명·툴팁 = 신규 `content_section` 바인딩(번들 원본 JSON 섹션) + `sheet_data`(charId·equipped).

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

### A. 전투 (실전투 인터랙션 — 코어 루프는 done, 연출·미리보기 남음)
- **✅ 수동 전투 UI**(slice C): 스킬→타겟 2단계(명중%)+battle_step. **남은 것**:
  - **타겟 칸 클릭(3D 보드 레이캐스트)**: 현재 HUD 버튼으로 타겟 선택. web식 칸 하이라이트(2.4)+호버 HP예고(`battle_targeting`)+area 미리보기는 보드 클릭/레이캐스트 필요(미구현).
  - **눈금 화살표·머리위 명중%**(web 2.7): 시전자→타겟 화살표, 유닛 위 명중% 칩.
- **이벤트→애니메이션**: `BattleDirector`가 스텁. 데미지 팝업·공격 모션·피격 플래시·상태칩·카메라 흔들림 = 이벤트 로그 소비해 연주(R3, 디자이너 협업).
- ✅ 상태칩·쉴드·HP바(slice E 카드 + slice F HUD 패널). **남은 것**: 스킬 쿨다운 표시(UnitView.cooldowns 미소비), 툴팁 풀 서술(web skillDesc/passiveDesc 수준 — 현재 한 줄 요약).

### B. 시각 (스크린샷으로 확인된 것)
- **✅ 유닛 카드 가시화**(slice A): 서 있는 빌보드 카드. **남은 것**: 카드에 초상화 스프라이트(현 단색 쿼드), HP바(현 텍스트), 양 진영 카드 대비.
- **✅ 노드 맵 육각 타일**(slice B): 벌집+벽+발광. **남은 것**: 카메라 줌/팬(web `camera.ts`), reachable 펄스 애니메이션, 노드 hover.
- 이름표(Label3D) 높이·정렬, 양 진영 중앙 간격 미세조정.
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
- **`class_name`은 헤드리스에서 미등록**(전역 클래스 캐시는 에디터 임포트가 생성) → 새 헬퍼 스크립트는 `class_name` 의존 금지, **`preload` const로 참조**(tips.gd 사례). 스크립트 에러는 헤드리스 직접 실행(`--headless --quit-after`)으로 즉시 확인 가능.
- **`cargo build | tail` 파이프는 실패를 숨김**(exit code = tail) → `PIPESTATUS` 확인 필수. 콘텐츠 타입(spr-types)은 `Deserialize` 전용이라 재직렬화 불가 — 콘텐츠 노출은 **번들 원본 `data_value()` 섹션**으로(`content_section`).
- Godot 슬라이스 검증 = **스크린샷**(npm/cargo 게이트는 웹·엔진 무변이라 무관).

## 5. 다음 권장 순서
1. **이벤트→애니메이션**(BattleDirector) — 데미지 팝업·피격 플래시·상태칩·HP바. 게임의 알맹이, R3. (수동 전투·주사위 = ✅ done)
2. **타겟 칸 클릭(3D 레이캐스트)** + 칸 하이라이트·호버 HP예고·area 미리보기·머리위 명중% — web 전투 어포던스 패리티.
3. chardex 전체 도감(char_list+meta) · 파티 시트 · 세이브·이어하기 · 일시정지(Esc) 연결.
4. 노드 맵 카메라 줌/팬 + reachable 펄스 · 모바일 게임 룩 폴리시 + (확정 후) 에셋 생성 실험.
5. 패리티 도달 시 **Tauri 게임 경로 은퇴**(웹은 저작 에디터만 잔류).
