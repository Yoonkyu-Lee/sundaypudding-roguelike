// 웹 엔트리 — Rust 코어 풀게임 마운트(TS 엔진 은퇴 후 단일 경로).
// 게임/에디터/허브/전투/일시정지/세이브 전부 `rustRun`이 Rust 세션(IPC)으로 구동.
// 제품 셸 = Tauri(`app/`). 브라우저(Tauri 런타임 아님)에선 rustRun이 안내 메시지를 띄움.
// (TS 골든 엔진·differential 하네스는 archive/ts-core 브랜치 + tag ts-golden-oracle에 보관)
import { mountRustRun } from "./rustRun.ts";

const app = document.getElementById("app")!;
mountRustRun(app, 42);
