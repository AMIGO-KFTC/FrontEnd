import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { isDemo } from "./shared/api";

if (isDemo) {
  const badge = document.createElement("div");
  badge.className = "demo-badge";
  badge.textContent = "예시 화면 · 서버 없이 동작하는 미리보기";
  document.body.appendChild(badge);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
