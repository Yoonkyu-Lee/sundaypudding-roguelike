import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// 웹 렌더러. dev: 코어(src/core) 무수정 import. build: JS/CSS를 index.html 한 파일로 인라인
// (viteSingleFile). 아바타(public/)는 빌드 후 scripts/inline-avatars.mjs가 base64로 박아넣음
// → 친구에게 보내는 완전 단일 HTML (더블클릭 → 브라우저, 오프라인).
export default defineConfig({
  plugins: [viteSingleFile()],
  server: { port: 5173, strictPort: false },
});
