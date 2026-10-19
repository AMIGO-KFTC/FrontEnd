import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./shared/api";
import type { StartData } from "./shared/handover";
import type { AppConfig, IntegrationImportResult, SessionDetail, SessionSummary, Source } from "./shared/types";
import { dataFromSession, screenForStage, sessionFromHash, writeHash } from "./shared/restore";
import { useSessionState } from "./shared/useSessionState";
import { EMPTY_PROFILE, ProfileProvider, profileFromUser, useProfile } from "./shared/profile";
import { ADMIN_PREVIEW } from "./shared/adminPreview";
import { AdminDashboardScreen } from "./screens/admin/AdminDashboardScreen";
import { ForgotPasswordScreen } from "./screens/auth/ForgotPasswordScreen";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { CompletionScreen } from "./screens/CompletionScreen";
import { FinalDocumentScreen } from "./screens/FinalDocumentScreen";
import { CompletedDocumentsScreen } from "./screens/home/CompletedDocumentsScreen";
import { DashboardScreen } from "./screens/home/DashboardScreen";
import { OngoingHandoverScreen } from "./screens/home/OngoingHandoverScreen";
import { ReceivedHandoverScreen } from "./screens/home/ReceivedHandoverScreen";
import type { HomeNav, SessionList } from "./screens/home/types";
import { ProcessingScreen } from "./screens/ProcessingScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { StartScreen } from "./screens/StartScreen";
import { UploadStepScreen } from "./screens/UploadStepScreen";

type HomeScreen = "dashboard" | "handover" | "documents" | "received"; // 홈 셸(사이드바가 있는 화면)
type Screen = "login" | HomeScreen | "admin" | "start" | "upload" | "processing" | "question" | "document" | "complete";
const HOME_SCREENS: Screen[] = ["dashboard", "handover", "documents", "received"];
type AuthPanel = "signup" | "forgot" | null; // 로그인 화면 위에 띄우는 창

const EMPTY: StartData = { mode: "reassignment", name: "", division: "", team: "", role: "", task: "", date: "" };

function citationCount(session: SessionDetail | null): number {
  if (!session) return 0;
  return Object.values(session.slots).reduce((sum, slot) => sum + slot.items.reduce((n, item) => n + item.citations.length, 0), 0);
}

export default function App() {
  return (
    <ProfileProvider>
      <AppScreens />
    </ProfileProvider>
  );
}

function AppScreens() {
  const [screen, setScreen] = useState<Screen>("login");
  const [authPanel, setAuthPanel] = useState<AuthPanel>(null);
  const [, setProfile] = useProfile();
  const [authChecked, setAuthChecked] = useState(false); // 로그인 상태 확인이 끝나기 전에는 로그인 화면을 깜빡이지 않는다
  const [data, setData] = useState<StartData>(EMPTY);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null); // 주소 해시로 이어서 열려는 작업
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null); // 홈 화면의 서버 작업 목록(실패하면 null)
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const { session, messages, error: sessionError, refresh, addMessages } = useSessionState(sessionId);

  // 로그인된 상태가 확인되면(앱 시작·로그인 직후) 해시의 작업을 이어서 열고, 없으면 홈 대시보드로 간다.
  const enter = useCallback(() => {
    const id = sessionFromHash();
    if (id) {
      setRestoreId(id);
      setSessionId(id);
    } else {
      setScreen("dashboard");
    }
  }, []);

  // 홈 화면의 작업 목록. 실패하면 목록을 비우고(null) 오류를 남겨 "0건"으로 보이지 않게 한다.
  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.listSessions());
      setSessionsError(null);
    } catch (e) {
      setSessions(null);
      setSessionsError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (HOME_SCREENS.includes(screen)) void loadSessions();
  }, [screen, loadSessions]);

  // 이미 로그인된 쿠키가 있으면 로그인 화면을 건너뛰고, 서버가 준 사용자 정보로 프로필을 채운다.
  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        setProfile(profileFromUser(user));
        enter();
      })
      .catch(() => undefined)
      .finally(() => setAuthChecked(true));
  }, [enter, setProfile]);

  // 같은 탭에서 주소의 해시만 다른 작업으로 바뀌면(링크 붙여넣기 등) 그 작업을 이어서 연다.
  useEffect(() => {
    const onHash = () => {
      const id = sessionFromHash();
      if (!id || id === sessionId || !authChecked || screen === "login") return;
      setRestoreId(id);
      setSessionId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [sessionId, authChecked, screen]);

  // 이어서 열기: 작업을 불러오면 진행 단계에 맞는 화면으로, 불러오지 못하면(없거나 내 작업이 아니면) 시작 화면으로
  useEffect(() => {
    if (!restoreId) return;
    if (session && session.id === restoreId) {
      setData(dataFromSession(session));
      setScreen(screenForStage(session.stage));
      setRestoreId(null);
    } else if (sessionError) {
      writeHash(null);
      setSessionId(null);
      setRestoreId(null);
      setError("이전 작업을 불러오지 못했어요. 새로 시작해 주세요.");
      setScreen("dashboard");
    }
  }, [restoreId, session, sessionError]);

  // 서버가 늦게 떠서 실패했더라도 화면을 옮길 때 다시 불러온다.
  useEffect(() => {
    if (config) return;
    api.config().then(setConfig).catch(() => setConfig(null));
  }, [config, screen]);

  // AI 단계가 끝나면 화면을 이어서 넘긴다: 분석 완료 → 질의응답, 문서 작성 시작 → 문서
  const stage = session?.stage;
  const documentVersion = session?.document_version ?? 0;
  const prevStage = useRef(stage);
  useEffect(() => {
    const changed = prevStage.current !== stage;
    prevStage.current = stage;
    if (!stage || !changed) return;
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

  // 가상 Mattermost·Confluence 에서 고른 항목을 자료로 등록한다. 결과 안내는 패널 안에서 보여 주므로 run() 의 대화 메시지 처리는 거치지 않는다.
  const importIntegration = useCallback(
    async (action: () => Promise<IntegrationImportResult>): Promise<IntegrationImportResult | undefined> => {
      setError(null);
      try {
        return await action();
      } catch (e) {
        setError((e as Error).message);
        return undefined;
      } finally {
        void refresh();
      }
    },
    [refresh],
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
        mode: form.mode,
        task_name: form.task.split(/\r?\n/).filter(Boolean)[0] ?? "",
        successor: "",
        handover_date: form.date,
      });
      setData(form);
      setSessionId(created.id);
      writeHash(created.id);
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

  // 현재 작업을 화면에서 내려놓는다(서버에는 남는다).
  const clearSession = () => {
    writeHash(null);
    setSessionId(null);
    setData(EMPTY);
    setMarkdown("");
    setError(null);
  };

  const reset = () => {
    clearSession();
    setScreen("start");
  };

  // 홈 목록에서 "이어서 작성"·"문서 열기": 세션을 불러온 뒤 서버에 저장된 단계의 화면으로 간다(해시 복원과 같은 경로).
  const openSession = (id: string) => {
    setError(null);
    setRestoreId(id);
    setSessionId(id);
    writeHash(id);
  };

  // 홈 목록에서 삭제. 성공하면 목록을 다시 불러오고, 실패하면 오류 문구를 돌려준다.
  const deleteSession = async (id: string): Promise<string | null> => {
    try {
      await api.deleteSession(id);
    } catch (e) {
      return (e as Error).message;
    }
    if (id === sessionId) clearSession();
    await loadSessions();
    return null;
  };

  const toScreen = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

  const login = async (loginId: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(loginId, password);
      setProfile(profileFromUser(result.user));
      enter();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 서버 세션을 끝내고 로그인 화면으로. 서버 호출이 실패해도(이미 만료 등) 화면은 로그인으로 보낸다.
  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* 쿠키가 이미 없으면 그대로 진행 */
    }
    reset();
    setProfile(EMPTY_PROFILE);
    setScreen("login");
  };

  // 단계 화면의 "홈으로 돌아가기". 작업은 서버에 남고 홈 목록에서 다시 열 수 있다.
  const goHome = () => {
    clearSession();
    setScreen("dashboard");
  };

  const nav: HomeNav = {
    onHome: () => toScreen("dashboard"),
    onHandover: () => toScreen("handover"),
    onDocuments: () => toScreen("documents"),
    onReceived: () => toScreen("received"),
    onLogout: logout,
  };
  const list: SessionList = { sessions, error: sessionsError, reload: () => void loadSessions(), open: openSession, remove: deleteSession };

  if (!authChecked || restoreId) return null;
  if (screen === "login") {
    return (
      <>
        <LoginScreen onLogin={login} onSignup={() => setAuthPanel("signup")} onForgot={() => setAuthPanel("forgot")} busy={busy} error={error} />
        {authPanel === "signup" && <SignupScreen onBack={() => setAuthPanel(null)} />}
        {authPanel === "forgot" && <ForgotPasswordScreen onBack={() => setAuthPanel(null)} />}
      </>
    );
  }
  if (screen === "dashboard") return <DashboardScreen {...nav} list={list} onNew={reset} onAdmin={() => ADMIN_PREVIEW && toScreen("admin")} />;
  if (screen === "admin") return ADMIN_PREVIEW ? <AdminDashboardScreen onExit={() => toScreen("dashboard")} /> : <DashboardScreen {...nav} list={list} onNew={reset} onAdmin={() => undefined} />;
  if (screen === "handover") return <OngoingHandoverScreen {...nav} list={list} onNew={reset} />;
  if (screen === "documents") return <CompletedDocumentsScreen {...nav} list={list} />;
  if (screen === "received") return <ReceivedHandoverScreen {...nav} list={list} />;
  if (screen === "start") return <StartScreen onStart={start} onLogout={logout} onHome={goHome} busy={busy} error={error} />;

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
        onLogout={logout}
        onHome={goHome}
        onUploadFiles={uploadFiles}
        onAddLink={(url) => sessionId && void run(() => api.addLinks(sessionId, [url], "auto"))}
        onDeleteSource={(source: Source) => sessionId && void run(() => api.deleteSource(sessionId, source.id))}
        onImportMattermost={(ids) => (sessionId ? importIntegration(() => api.importMattermost(sessionId, ids)) : Promise.resolve(undefined))}
        onImportConfluence={(ids) => (sessionId ? importIntegration(() => api.importConfluence(sessionId, ids)) : Promise.resolve(undefined))}
      />
    );
  }
  if (screen === "processing") return <ProcessingScreen session={session} onNext={() => toScreen("question")} onRetry={() => sessionId && void run(() => api.retry(sessionId))} onLogout={logout} onHome={goHome} />;
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
        onLogout={logout}
        onHome={goHome}
      />
    );
  }
  if (screen === "document") {
    return (
      <FinalDocumentScreen
        data={data}
        sessionId={session.id}
        markdown={markdown}
        onGanttEdit={(name, nth, months) => api.editGantt(session.id, name, nth, months).then((d) => setMarkdown(d.markdown))}
        loading={docLoading}
        sourceCount={citationCount(session)}
        failedMessage={session.status === "error" ? session.error : null}
        onRetry={() => sessionId && void run(() => api.retry(sessionId))}
        onBack={() => toScreen("question")}
        onComplete={() => toScreen("complete")}
        onLogout={logout}
        onHome={goHome}
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
      onHome={goHome}
    />
  );
}
