import { useCallback, useEffect, useState } from "react";
import { api } from "./shared/api";
import type { StartData } from "./shared/handover";
import type { AppConfig, SessionDetail, Source } from "./shared/types";
import { useSessionState } from "./shared/useSessionState";
import { CompletionScreen } from "./screens/CompletionScreen";
import { FinalDocumentScreen } from "./screens/FinalDocumentScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ProcessingScreen } from "./screens/ProcessingScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { StartScreen } from "./screens/StartScreen";
import { UploadStepScreen } from "./screens/UploadStepScreen";

type Screen = "login" | "start" | "upload" | "processing" | "question" | "document" | "complete";

const EMPTY: StartData = { name: "", division: "", team: "", role: "", task: "", date: "" };

function citationCount(session: SessionDetail | null): number {
  if (!session) return 0;
  return Object.values(session.slots).reduce((sum, slot) => sum + slot.items.reduce((n, item) => n + item.citations.length, 0), 0);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [data, setData] = useState<StartData>(EMPTY);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, messages, refresh, addMessages } = useSessionState(sessionId);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig(null));
  }, []);

  // AI 단계가 끝나면 화면을 이어서 넘긴다: 분석 완료 → 질의응답, 문서 작성 시작 → 문서
  const stage = session?.stage;
  const documentVersion = session?.document_version ?? 0;
  useEffect(() => {
    if (!stage) return;
    if (screen === "question" && (stage === "composing" || stage === "review")) setScreen("document");
  }, [screen, stage]);

  useEffect(() => {
    if (screen !== "document" || !sessionId || documentVersion === 0) return;
    let cancelled = false;
    setDocLoading(true);
    api
      .document(sessionId)
      .then((d) => !cancelled && setMarkdown(d.markdown))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setDocLoading(false));
    return () => {
      cancelled = true;
    };
  }, [screen, sessionId, documentVersion]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setError(null);
      try {
        const result = await action();
        if (result && typeof result === "object" && "message" in result) {
          const message = (result as { message?: Parameters<typeof addMessages>[0][number] }).message;
          if (message) addMessages([message]);
        }
        return result;
      } catch (e) {
        setError((e as Error).message);
        return undefined;
      } finally {
        void refresh();
      }
    },
    [addMessages, refresh],
  );

  const start = async (form: StartData) => {
    if (!form.name.trim()) {
      setError("성명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createSession({
        owner_name: form.name.trim(),
        organization: [form.division, form.team].filter(Boolean).join(" · "),
        position: form.role,
        duties: form.task,
        successor: "",
        handover_date: form.date,
      });
      setData(form);
      setSessionId(created.id);
      setScreen("upload");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = (files: File[]) => {
    if (!sessionId) return;
    const max = (config?.max_upload_mb ?? 50) * 1024 * 1024;
    const allowed = new Set(config?.allowed_extensions ?? []);
    const ok = files.filter((f) => {
      const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase() : "";
      if (allowed.size && !allowed.has(ext)) {
        setError(`'${f.name}' 은(는) 지원하지 않는 형식이에요.`);
        return false;
      }
      if (f.size > max) {
        setError(`'${f.name}' 이(가) 너무 커요(최대 ${config?.max_upload_mb ?? 50}MB).`);
        return false;
      }
      return true;
    });
    if (ok.length) void run(() => api.upload(sessionId, ok));
  };

  const analyze = async () => {
    if (!sessionId || !session) return;
    if (session.sources.some((s) => s.status === "pending" || s.status === "processing")) {
      setError("자료를 읽고 있어요. 잠시 후 다시 눌러 주세요.");
      return;
    }
    if (!session.sources.some((s) => s.status === "ready")) {
      setError("분석할 자료를 1건 이상 등록해 주세요.");
      return;
    }
    setBusy(true);
    const result = await run(() => api.analyze(sessionId));
    if (result) await refresh(); // 재분석이면 이전 단계 값이 남아 있으므로 새 상태를 받은 뒤 화면을 넘긴다
    setBusy(false);
    if (result) setScreen("processing");
  };

  const generate = async () => {
    if (!sessionId) return;
    const result = await run(() => api.generate(sessionId));
    if (result) setScreen("document");
  };

  const reset = () => {
    setSessionId(null);
    setData(EMPTY);
    setMarkdown("");
    setError(null);
    setScreen("start");
  };

  const toScreen = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

  if (screen === "login") return <LoginScreen onLogin={() => toScreen("start")} />;
  if (screen === "start") return <StartScreen onStart={start} busy={busy} error={error} />;

  if (!session) {
    return null;
  }

  if (screen === "upload") {
    return (
      <UploadStepScreen
        sources={session.sources}
        error={error}
        busy={busy}
        onBack={() => toScreen("start")}
        onNext={analyze}
        onUploadFiles={uploadFiles}
        onAddLink={(url) => sessionId && void run(() => api.addLinks(sessionId, [url], "auto"))}
        onDeleteSource={(source: Source) => sessionId && void run(() => api.deleteSource(sessionId, source.id))}
      />
    );
  }
  if (screen === "processing") return <ProcessingScreen session={session} onNext={() => toScreen("question")} onRetry={() => sessionId && void run(() => api.retry(sessionId))} />;
  if (screen === "question") {
    return (
      <QuestionScreen
        session={session}
        messages={messages}
        config={config}
        error={error}
        onBack={() => toScreen("upload")}
        onSend={(text) => sessionId && void run(() => api.chat(sessionId, text))}
        onSkip={() => sessionId && void run(() => api.skip(sessionId))}
        onUploadFiles={uploadFiles}
        onRetry={() => sessionId && void run(() => api.retry(sessionId))}
        onComplete={generate}
      />
    );
  }
  if (screen === "document") {
    return (
      <FinalDocumentScreen
        data={data}
        sessionId={session.id}
        markdown={markdown}
        loading={docLoading}
        sourceCount={citationCount(session)}
        failedMessage={session.status === "error" ? session.error : null}
        onRetry={() => sessionId && void run(() => api.retry(sessionId))}
        onBack={() => toScreen("question")}
        onComplete={() => toScreen("complete")}
      />
    );
  }
  return (
    <CompletionScreen
      sourceCount={session.sources.length}
      questionCount={session.question_count}
      citationCount={citationCount(session)}
      onViewDocument={() => toScreen("document")}
      onNew={reset}
    />
  );
}
