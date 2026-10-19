import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { IntegrationPickerPage } from "./screens/handover/IntegrationPickerPage";
import { parsePickHash } from "./shared/pickBridge";
import "./index.css";

// 새 탭으로 연 선택 창(#/pick/mattermost · #/pick/confluence)은 로그인·세션 흐름 없이 패널만 보여 준다.
const pickKind = parsePickHash(window.location.hash);

createRoot(document.getElementById("root")!).render(<StrictMode>{pickKind ? <IntegrationPickerPage kind={pickKind} /> : <App />}</StrictMode>);
