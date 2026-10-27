import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// 개발 서버(5173)에서 /api 요청은 FastAPI(8000)로 넘긴다.
// index.html 이 확정 디자인 화면, legacy.html 이 이전 구현(보존용)이다.
// "@/..." 는 src/ 를 가리키는 별칭이다(tsconfig.json 의 paths 와 짝).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      input: { main: "index.html", legacy: "legacy.html" },
    },
  },
  server: {
    // 원격 서버(VM)에서 IP·도메인으로 접속할 수 있게 한다. 로컬 개발에는 영향 없음
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      "/api": { target: process.env.AMIGO_API ?? "http://localhost:8000", changeOrigin: true },
    },
  },
});
