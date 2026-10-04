import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 서버(5173)에서 /api 요청은 FastAPI(8000)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.AMIGO_API ?? "http://localhost:8000", changeOrigin: true },
    },
  },
});
