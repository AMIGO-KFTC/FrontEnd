// 세션 작업 화면: 진행 단계 + (자료 | 대화·문서 | 항목 현황) 3단 레이아웃
import { ArrowLeft, Bot, FileText, LayoutList, MessagesSquare, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useSessionState } from "../hooks/useSessionState";
import type { AppConfig, ChatMessage, Source } from "../types";
import { ChatPanel } from "./ChatPanel";
import { DocumentViewer } from "./DocumentViewer";
import { SlotBoard } from "./SlotBoard";
import { StageProgress } from "./StageProgress";
import { UploadPanel } from "./UploadPanel";

type Tab = "chat" | "document";
type MobilePanel = "sources" | "main" | "slots";

interface Props {
  sessionId: string;
  config: AppConfig | null;
  onBack: () => void;
  notify: (message: string, tone?: "error" | "info") => void;
}

export function Workspace({ sessionId, config, onBack, notify }: Props) {
  const { session, messages, error, refresh, addMessages } = useSessionState(sessionId);
  const [tab, setTab] = useState<Tab>("chat");
  const [mobile, setMobile] = useState<MobilePanel>("main");
  const [unseenDoc, setUnseenDoc] = useState(false);
  const seenVersion = useRef<number | null>(null);

  // 새 문서 버전이 나오면: 처음(v1)은 문서 탭으로 이동, 이후 버전은 탭에 표시만
  useEffect(() => {
    if (!session) return;
    const version = session.document_version;
    if (seenVersion.current === null) {
      seenVersion.current = version;
      return;
    }
    if (version > seenVersion.current) {
      seenVersion.current = version;
      if (version === 1) {
        setTab("document");
        setMobile("main");
      } else if (tab !== "document") setUnseenDoc(true);
    }
  }, [session, tab]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        const result = await action();
        // 채팅·건너뛰기·문서 생성 요청은 방금 저장된 사용자 메시지를 돌려주므로 바로 화면에 붙인다
        if (result && typeof result === "object" && "message" in result) {
          const message = (result as { message?: ChatMessage }).message;
          if (message) addMessages([message]);
        }
      } catch (e) {
        notify((e as Error).message);
      } finally {
        void refresh();
      }
    },
    [addMessages, notify, refresh],
  );

  const upload = useCallback(
    (files: File[]) => {
      const max = (config?.max_upload_mb ?? 50) * 1024 * 1024;
      const allowed = new Set(config?.allowed_extensions ?? []);
      const ok = files.filter((f) => {
        const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase() : "";
        if (allowed.size && !allowed.has(ext)) {
          notify(`'${f.name}' 은(는) 지원하지 않는 형식이에요.`);
          return false;
        }
        if (f.size > max) {
          notify(`'${f.name}' 이(가) 너무 커요(최대 ${config?.max_upload_mb ?? 50}MB).`);
          return false;
        }
        return true;
      });
      if (ok.length) void run(() => api.upload(sessionId, ok));
    },
    [config, notify, run, sessionId],
  );

  if (!session) {
    return (
      <main className="loading-screen">
        {error ? (
          <>
            <p>{error}</p>
            <button className="btn secondary" onClick={onBack}>
              목록으로
            </button>
          </>
        ) : (
          <p className="muted">불러오는 중…</p>
        )}
      </main>
    );
  }

  const deleteSource = (source: Source) => {
    if (window.confirm(`'${source.name}' 자료를 삭제할까요?`)) void run(() => api.deleteSource(sessionId, source.id));
  };
  const analyze = () => {
    if (session.stage !== "setup" && !window.confirm("지금까지의 분석과 질의응답을 지우고 처음부터 다시 분석할까요?")) return;
    setTab("chat");
    void run(() => api.analyze(sessionId));
  };

  return (
    <div className="workspace">
      <header className="ws-head">
        <button className="icon-btn" onClick={onBack} aria-label="목록으로">
          <ArrowLeft size={18} />
        </button>
        <div className="ws-title">
          <h1>{session.title}</h1>
          <p className="muted small">
            {[session.organization, session.successor && `인수자 ${session.successor}`, session.handover_date && `인계일 ${session.handover_date}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className={`engine ${session.engine || config?.engine}`} title="AI 엔진">
          <Bot size={14} />
          {(session.engine || config?.engine) === "claude" ? `Claude · ${config?.model ?? ""}` : "오프라인 규칙 엔진"}
        </span>
      </header>

      <StageProgress session={session} />

      <nav className="mobile-tabs" aria-label="화면 전환">
        <button className={mobile === "sources" ? "on" : ""} onClick={() => setMobile("sources")}>
          <UploadCloud size={16} /> 자료
        </button>
        <button className={mobile === "main" ? "on" : ""} onClick={() => setMobile("main")}>
          <MessagesSquare size={16} /> 대화·문서
        </button>
        <button className={mobile === "slots" ? "on" : ""} onClick={() => setMobile("slots")}>
          <LayoutList size={16} /> 현황
        </button>
      </nav>

      <div className={`ws-grid show-${mobile}`}>
        <div className="col col-sources">
          <UploadPanel
            session={session}
            config={config}
            onUpload={upload}
            onAddLink={(url, type) => void run(() => api.addLinks(sessionId, [url], type))}
            onDelete={deleteSource}
            onAnalyze={analyze}
          />
        </div>

        <section className="col col-main panel">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
              <MessagesSquare size={16} /> 대화
            </button>
            <button
              role="tab"
              aria-selected={tab === "document"}
              className={tab === "document" ? "on" : ""}
              onClick={() => {
                setTab("document");
                setUnseenDoc(false);
              }}
            >
              <FileText size={16} /> 인수인계서
              {session.document_version > 0 && <span className="badge info">v{session.document_version}</span>}
              {unseenDoc && <span className="dot" aria-label="새 버전" />}
            </button>
          </div>
          {tab === "chat" ? (
            <ChatPanel
              session={session}
              messages={messages}
              onSend={(text) => void run(() => api.chat(sessionId, text))}
              onSkip={() => void run(() => api.skip(sessionId))}
              onGenerate={() => void run(() => api.generate(sessionId))}
              onRetry={() => void run(() => api.retry(sessionId))}
              onUpload={upload}
              onOpenDocument={() => setTab("document")}
            />
          ) : (
            <DocumentViewer session={session} onGenerate={() => void run(() => api.generate(sessionId))} />
          )}
        </section>

        <div className="col col-slots">
          <SlotBoard session={session} config={config} />
        </div>
      </div>
    </div>
  );
}
