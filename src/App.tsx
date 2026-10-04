import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { StartScreen } from "./components/StartScreen";
import { Workspace } from "./components/Workspace";
import type { AppConfig } from "./types";

interface Toast {
  id: number;
  message: string;
  tone: "error" | "info";
}

// 주소창 해시로 현재 세션을 기억한다(#/s/<세션ID>) → 새로고침해도 이어서 작업
function sessionFromHash(): string | null {
  const match = window.location.hash.match(/^#\/s\/([0-9a-f]{8,32})$/);
  return match ? match[1] : null;
}

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(sessionFromHash);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: "error" | "info" = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch((e: Error) => notify(e.message));
    const onHash = () => setSessionId(sessionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [notify]);

  const open = (id: string | null) => {
    window.location.hash = id ? `#/s/${id}` : "";
    setSessionId(id);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => open(null)} aria-label="처음 화면">
          <span className="logo">A</span>
          <span>
            AMIGO <small>인수인계 도우미</small>
          </span>
        </button>
      </header>

      {sessionId ? (
        <Workspace key={sessionId} sessionId={sessionId} config={config} onBack={() => open(null)} notify={notify} />
      ) : (
        <StartScreen onOpen={open} onError={notify} />
      )}

      <div className="toasts" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>{t.message}</span>
            <button className="icon-btn" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} aria-label="닫기">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
