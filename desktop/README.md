# spr-app — Tauri2 데스크톱 셸 (P1-13)

Rust 코어(`rust/spr-core`) 포팅을 **실제 데스크톱 앱에서 육안 검증**하기 위한 Tauri2 셸. 워크스페이스 밖 독립 크레이트라 `cargo test`/`npm run check`는 영향받지 않는다(가벼운 게이트 유지).

## 범위 (Phase 1)

- **전투(데모)만.** `spr-core`의 `Session` API(`create_session`/`battle_step`/`observation`)를 IPC 커맨드로 노출.
- 이벤트 로그는 TS와 **바이트 동일**(differential 40벡터/679스텝 입증). 이 앱은 그 동치를 *눈으로* 확인하는 단계.
- run/hub/맵 진행 레이어는 아직 TS(미포팅) → 풀 앱 통합은 후속.

## 선결

```bash
npm install -D @tauri-apps/cli@^2   # 프리빌트 CLI (cargo install보다 빠름) — 이미 devDep에 추가됨
# Windows: WebView2 런타임(대개 Win11 기본), MSVC 빌드툴
```

## 구동 (검증된 2-스텝 — beforeDevCommand 비움)

```bash
# 터미널 1 (레포 루트): Vite dev 서버
npm run dev                 # http://localhost:5173

# 터미널 2 (app/): Tauri 윈도우 — devUrl(5173) 로드
cd app && npx tauri dev

# 프론트에서 Rust 코어 선택: 앱 윈도우 URL에 ?core=rust
#   (없으면 TS 코어 — 같은 화면·같은 시드 = 같은 진행이어야)
```
> 첫 `npx tauri dev`는 tauri 의존 트리 컴파일로 ~1~2분. 이후 캐시.

## 검증 체크리스트 (P1-13 완료 기준)

1. `?core=rust`로 데모 전투를 플레이 → 정상 진행/연출.
2. 같은 시드로 **TS 모드(`?core=ts` 또는 무옵션)** 와 **Rust 모드** 가 동일한 전투 전개(서열·명중·피해·사망·상태이상·연출)인지 비교.
3. 이벤트 델타 기반 재생(8.5)이 양쪽 동일.

## 어댑터

프론트 피처플래그 = `src/web/coreAdapter.ts` (`selectBattleBackend()` — `?core=rust` + Tauri 런타임 시 Rust, 아니면 TS). 두 백엔드 모두 `{ create(seed), step(action) } → { eventDelta, observation }` 동형.

## TODO (빌드 후)

- `app/icons/icon.png` 추가(번들 아이콘 — 현재 placeholder 경로).
- `main.ts` 전투 루프를 `selectBattleBackend()` 경유로 전환(현재는 어댑터만 제공, 기존 직접호출 유지).
- 다중 세션/run 레이어 포팅 시 커맨드 확장.
