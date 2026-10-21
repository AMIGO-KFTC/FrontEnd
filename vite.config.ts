import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 개발 서버(5173)에서 /api 요청은 FastAPI(8000)로 넘긴다.
// index.html 이 확정 디자인 화면, legacy.html 이 이전 구현(보존용)이다.
// `vite build --mode demo` 는 서버 없이 정적 파일만으로 동작하는 예시 화면(dist-demo)을 만든다.
export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    plugins: [react(), tailwindcss()],
    base: demo ? "./" : "/",
    define: demo ? { "import.meta.env.VITE_DEMO": JSON.stringify("1") } : {},
    build: {
      outDir: demo ? "dist-demo" : "dist",
      rollupOptions: {
        input: demo ? { main: "index.html" } : { main: "index.html", legacy: "legacy.html" },
        // 예시 화면은 올릴 파일 수를 줄이려고 지연 로딩 조각(Mermaid 등)을 하나로 합친다.
        ...(demo ? { output: { inlineDynamicImports: true } } : {}),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: process.env.AMIGO_API ?? "http://localhost:8000", changeOrigin: true },
      },
    },
  };
});
