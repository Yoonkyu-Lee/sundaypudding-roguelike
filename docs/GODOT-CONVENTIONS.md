# GODOT-CONVENTIONS — Godot 클라이언트 작업 규칙 (정립)

> **이 문서 = Godot(`godot/`) 작업의 규칙 SoT.** 웹의 "모듈 구조 & 파일 분리"(CLAUDE.md)에 대응하는 Godot판. 마이그레이션 배경은 [`RENDER-MIGRATION.md`](RENDER-MIGRATION.md). 핵심 통찰: **전장이 3D인 것만 빼면 게임은 기술적으로 동일** — 전부 "엔진 데이터로 구동되는, 화면 위 상호작용 위젯". 그래서 웹 프론트의 구조가 그대로 매핑된다.

## 0. 정체성
- **Godot = 플레이어 클라이언트(뷰). 두뇌 = Rust `spr-core`(불변).** 데이터 에디터(jobs/items/skills/traits/characters·런 에디터)는 **웹에 잔류**(개발자 도구).
- Godot은 현 `web/src/ui`의 자리를 대체한다 — **순수 뷰**. 게임 로직·상태·결정론은 전부 Rust.

## 1. 불변 규칙 (어기면 안 됨 — 웹 불변식의 Godot판)

1. **1 씬 = 1 책임.** 패널·화면·컴포넌트 = **`.tscn`(노드 트리) + `.gd`(행동)** 한 쌍 = 하나의 모듈. (= 웹 "1 모듈 = 1 책임".) 공개 표면 = `@export` 변수 + `signal`, 내부는 캡슐화. 소비 = **인스턴스**(= import).
2. **정적 레이아웃 = `.tscn`(에디터·디자이너) / 동적 내용 = `.gd`(엔진 데이터로 채움).** "무엇이 어디에"는 씬, "지금 누구 턴·어떤 스킬·명중 몇%"는 코드가 관측에서 읽어 채움. (= 데이터/엔진 경계의 프론트판.)
3. **반복 요소 = 재사용 씬 인스턴스.** 스킬 버튼·서열 칩·유닛 카드는 **각자 `.tscn`을 N번 인스턴스**(데이터 개수만큼). `.tscn`에 손으로 N개 박지 않는다. (= 웹 컴포넌트 재사용.)
4. **엔진 링크 = `SprSession`(GDExtension) JSON 계약.** 컨트롤러는 **명령 호출(create_run/enter_node/battle_step…) + 관측(RunView/observation JSON) 읽기**만. **게임 로직·상태 변이·RNG 0**(= 웹 IPC 계약, `spr-core` 순수성·결정론 불변 1·2 그대로). 경계 = JSON 문자열(현 Tauri IPC와 동일).
5. **라우팅 = `GameDirector` autoload**(= `rustRun.ts`). **이벤트 로그 → 애니메이션 = `BattleDirector`**(= `rustBattle.ts`). 화면 전환·세션 보유는 디렉터가.

## 2. 웹 ↔ Godot 개념 대응

| 웹(`web/src/ui`) | Godot(`godot/`) |
|---|---|
| 모듈(1책임) + 배럴 공개 API | 씬(`.tscn`+`.gd`) + `@export`/`signal` |
| 컴포넌트 N번 렌더 | 씬 N번 인스턴스 |
| `style.css`(테마·StyleBox) | `ui/theme.tres`(Theme·StyleBox) |
| DOM 노드 | 노드(Control/Node3D/…) |
| IPC `invoke(cmd)` → RunView/obs | `SprSession.cmd()` → 같은 JSON |
| `rustRun.ts`(appState·라우팅) | `GameDirector`(autoload) |
| `rustBattle.ts`(이벤트 재생) | `BattleDirector` |
| `renderBattle`(서열·스킬바·보드) | `battle_hud.tscn`+`.gd` / 3D 보드 |
| 정적 HTML / 동적 채움 | `.tscn` / `.gd` populate |

## 3. 폴더 구조 (현재)
```
godot/
├── scenes/  화면·컴포넌트 씬(.tscn+.gd) — screen별. 반복원자는 하위 폴더(예: battle/hud/)
├── scripts/ 디렉터(game_director·battle_director)
├── ui/      theme.tres(게임 CSS)
├── assets/  디자이너: sprites/ fonts/ audio/ vfx/
├── bin/     spr_godot.dll (gitignore, 빌드 산출)
└── spr.gdextension
```

## 4. 자동화 — 어디까지 자율 스캐폴드 가능한가

**기술적으로 동일하므로(전장 3D만 신규), 화면별 스캐폴드+엔진 링크는 반복 패턴 = 자동화 가능.** 화면 1개 = 다음 6단계 반복:
1. 씬(`.tscn`) 레이아웃 뼈대(컨테이너·자리). 2. 컨트롤러(`.gd`). 3. `GameDirector`에 라우트 등록. 4. 진입 시 엔진 명령 호출. 5. 관측 JSON 읽어 위젯 채움(반복원자 인스턴스). 6. 상호작용 → 엔진 명령 back. → 헤드리스 임포트/런으로 파싱·로직 검증.

- **AI가 자율로 가능**: 모든 씬 구조·GDScript·엔진 배선·라우팅·데이터바인딩·헤드리스 검증. (= 웹 프론트 구조/정보아키텍처를 그대로 모방.)
- **사람/디자이너 영역**: 렌더 결과를 눈으로 튜닝(위치·간격·색감), 실제 아트(스프라이트·파티클·폰트), 애니메이션 키프레임, "보기 좋은가/잘 노나" 판단.
- **신규 표현(레퍼런스 없음) = 3D 전장 하나뿐.** 나머지 화면은 웹에 레퍼런스가 있어 모방+링크가 기계적.

## 5. 검증
- **헤드리스 임포트**: `tools/godot/...console.exe --headless --editor --quit --path godot` → 씬/스크립트 파싱·로드 에러 검출(시각 무관, AI가 돌림).
- **헤드리스 런**: `--headless --path godot` → `_ready` 로직·print 검증(디스플레이 불요).
- **GUI**: 사람이 에디터 F5로 시각·플레이 확인.
- `spr-godot`(Rust) 변경 = `cargo build` + `cp ... godot/bin/`(현재 수동).
