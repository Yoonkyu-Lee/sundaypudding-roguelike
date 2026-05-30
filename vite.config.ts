import { defineConfig } from "vite";

// 웹 렌더러 dev 서버. 코어(src/core)는 무수정으로 import해 브라우저에서 실행.
export default defineConfig({
  server: { port: 5173, strictPort: false },
});
