import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./shared/api";
import type { StartData } from "./shared/handover";
import type { AppConfig, IntegrationImportResult, SessionDetail, SessionSummary, Source } from "./shared/types";
import { dataFromSession } from "./shared/restore";
import { HOME, resolveStep, useHashRoute, type AdminSection, type Route, type StepScreen } from "./shared/router";
import { useSessionState } from "./shared/useSessionState";
import { EMPTY_PROFILE, ProfileProvider, profileFromUser, useProfile } from "./shared/profile";
import { AdminDashboardScreen } from "./screens/admin/AdminDashboardScreen";
import { ForgotPasswordScreen } from "./screens/auth/ForgotPasswordScreen";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { WorkspaceSelectScreen, type Workspace } from "./screens/auth/WorkspaceSelectScreen";
import { CompletionScreen } from "./screens/handover/CompletionScreen";
import { FinalDocumentScreen } from "./screens/handover/FinalDocumentScreen";
import { GeneratingDocumentScreen } from "./screens/handover/GeneratingDocumentScreen";
import { HandoverTypeScreen } from "./screens/handover/HandoverTypeScreen";
import { ProcessingScreen } from "./screens/handover/ProcessingScreen";
import { QuestionScreen } from "./screens/handover/QuestionScreen";
import { SessionGateScreen, type GateState } from "./screens/handover/SessionGateScreen";
import { StartScreen } from "./screens/handover/StartScreen";
import { UploadStepScreen } from "./screens/handover/UploadStepScreen";
import { CompletedDocumentsScreen } from "./screens/home/CompletedDocumentsScreen";
import { DashboardScreen } from "./screens/home/DashboardScreen";
import { OngoingHandoverScreen } from "./screens/home/OngoingHandoverScreen";
import { ReceivedHandoverScreen } from "./screens/home/ReceivedHandoverScreen";
import type { HomeNav, SessionList } from "./screens/home/types";

type AuthPanel = "signup" | "forgot" | null; // 로그인 화면 위에 띄우는 창

const EMPTY: StartData = { mode: "reassignment", name: "", division: "", team: "", role: "", task: "", date: "", successor: "", successorLoginId: "" };
const EXPIRED = "로그인이 만료됐어요. 다시 로그인해 주세요.";
const WORKSPACE_KEY = "amigo-workspace"; // 팀장이 고른 작업 공간(일반 / 팀 관리). 탭을 닫거나 로그아웃하면 다시 고른다.

function storedWorkspace(): Workspace | null {
  try {
    const value = sessionStorage.getItem(WORKSPACE_KEY);
    return value === "admin" || value === "user" ? value : null;
  } catch {
    return null;
  }
}

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

// 화면은 주소(route)와 서버 상태로 정해진다. 화면 사이를 오가는 것은 주소만 바꾸는 일이라 뒤로·앞으로 가기로 API 가 다시 불리지 않는다.
function AppScreens() {
  const { route, navigate } = useHashRoute();
  const [authChecked, setAuthChecked] = useState(false); // 로그인 상태 확인이 끝나기 전에는 로그인 화면을 깜빡이지 않는다
  const [loggedIn, setLoggedIn] = useState(false);
  const [authPanel, setAuthPanel] = useState<AuthPanel>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null); // 로그인 만료 안내
  const [homeNotice, setHomeNotice] = useState<string | null>(null); // 홈에서 보여 줄 안내(열 수 없는 작업 등)
  const [profile, setProfile] = useProfile();
  const [workspace, setWorkspaceState] = useState<Workspace | null>(storedWorkspace);
  const [adminReturn, setAdminReturn] = useState<AdminSection>("handovers"); // 팀장이 문서를 열기 전에 보던 팀 관리 탭
  const setWorkspace = useCallback((next: Workspace | null) => {
    setWorkspaceState(next);
    try {
      if (next) sessionStorage.setItem(WORKSPACE_KEY, next);
      else sessionStorage.removeItem(WORKSPACE_KEY);
    } catch {
      /* 저장소를 못 쓰면 이번 화면에서만 기억한다 */
    }
  }, []);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  // 문서에 번호가 달린 근거 수(문서의 '근거 자료' 목록과 같은 수). 항목마다 달린 근거를 모두 더한 수와 달라 따로 받아 둔다.
  const [citationTotal, setCitationTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); // 세션 생성·분석 시작처럼 화면을 바꾸는 요청
  const [acting, setActing] = useState(false); // 답변·건너뛰기·생성 요청이 서버에 가 있는 동안(중복 요청 방지)
  const [targetVersion, setTargetVersion] = useState(1); // 생성 중 화면이 기다리는 문서 버전
  const awaitingStart = useRef(false); // 생성·수정 요청을 보낸 뒤 서버가 "처리 중"으로 바뀌는 것을 아직 못 본 상태
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null); // 홈 화면의 서버 작업 목록(실패하면 null)
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // 주소가 작업을 가리키고 로그인돼 있을 때만 세션을 불러온다(주소가 같은 작업 안에서 바뀌면 폴링은 그대로 이어진다).
  const sessionId = loggedIn && route.kind === "session" ? route.id : null;
  const { session, messages, error: sessionError, errorStatus: sessionErrorStatus, refresh, addMessages } = useSessionState(sessionId);
  const data: StartData = session ? dataFromSession(session) : EMPTY;

  // 로그인이 만료되면(401) 로그인 화면으로 보내고, 다시 로그인하면 보던 주소로 돌아온다.
  const expire = useCallback(() => {
    setLoggedIn(false);
    setProfile(EMPTY_PROFILE);
    setWorkspace(null);
    setLoginNotice(EXPIRED);
  }, [setProfile, setWorkspace]);

  // 홈 화면의 작업 목록. 실패하면 목록을 비우고(null) 오류를 남겨 "0건"으로 보이지 않게 한다.
  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.listSessions());
      setSessionsError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        expire();
        return;
      }
      setSessions(null);
      setSessionsError((e as Error).message);
    }
  }, [expire]);

  const screenKey = route.kind === "home" ? route.page : route.kind;
  useEffect(() => {
    if (loggedIn && route.kind === "home") void loadSessions();
  }, [loggedIn, screenKey, route.kind, loadSessions]);

  // 이미 로그인된 쿠키가 있으면 로그인 화면을 건너뛰고, 서버가 준 사용자 정보로 프로필을 채운다.
  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        setProfile(profileFromUser(user));
        setLoggedIn(true);
      })
      .catch(() => undefined)
      .finally(() => setAuthChecked(true));
  }, [setProfile]);

  // 세션을 불러오다 401 이 나오면 로그인 만료로 본다(404·403·서버 오류는 SessionGateScreen 이 구분해 보여 준다).
  useEffect(() => {
    if (sessionErrorStatus === 401) expire();
  }, [sessionErrorStatus, expire]);

  // 서버가 늦게 떠서 실패했더라도 화면을 옮길 때 다시 불러온다.
  useEffect(() => {
    if (config || !loggedIn) return;
    api.config().then(setConfig).catch(() => setConfig(null));
  }, [config, loggedIn, screenKey]);

  // 현재 작업 화면. 주소의 step 이 서버 단계와 맞지 않으면 단계 기본 화면으로 돌리고 주소도 그에 맞춘다(뒤로·앞으로 가기가 일관되게).
  const step: StepScreen | null = session && route.kind === "session" ? resolveStep(route.step, session) : null;
  useEffect(() => {
    if (!session || route.kind !== "session" || !step || route.step === step) return;
    navigate({ kind: "session", id: route.id, step }, { replace: true });
  }, [session, route, step, navigate]);

  const goStep = useCallback(
    (next: StepScreen, options: { replace?: boolean } = {}) => {
      if (route.kind !== "session") return;
      setError(null);
      navigate({ kind: "session", id: route.id, step: next }, options);
    },
    [route, navigate],
  );

  // AI 단계가 끝나면 화면을 이어서 넘긴다: 질의응답 중 문서 작성이 시작되면 생성 중 화면, 기다리던 버전이 나오면 문서 화면
  const stage = session?.stage;
  const status = session?.status;
  const documentVersion = session?.document_version ?? 0;
  const prevStage = useRef(stage);
  useEffect(() => {
    const changed = prevStage.current !== stage;
    prevStage.current = stage;
    if (!stage || !changed) return;
    if (step === "question" && stage === "composing") {
      setTargetVersion(documentVersion + 1);
      goStep("generating", { replace: true });
    } else if (step === "question" && stage === "review") {
      goStep("document", { replace: true });
    }
  }, [step, stage, documentVersion, goStep]);

  // 생성 중 → 문서: 기다리던 버전이 나왔거나, (요청 직후가 아닌데) 서버가 검토 단계로 돌아와 있으면 문서 화면으로.
  // 두 번째 조건은 새로고침 복원처럼 버전 계산이 어긋난 경우를 위한 안전장치다.
  useEffect(() => {
    if (status === "running" || stage === "composing") awaitingStart.current = false;
    if (step !== "generating" || status === "running") return;
    if (documentVersion >= targetVersion || (!awaitingStart.current && stage === "review" && documentVersion > 0)) goStep("document", { replace: true });
  }, [step, documentVersion, targetVersion, status, stage, goStep]);

  // 새로고침·직접 접속으로 생성 중 화면에 들어오면 다음 버전을 기다린다.
  useEffect(() => {
    if (step === "generating" && stage === "composing") setTargetVersion((current) => Math.max(current, documentVersion + 1));
  }, [step, stage, documentVersion]);

  useEffect(() => {
    if (step !== "document" || !sessionId || documentVersion === 0) return;
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
  }, [step, sessionId, documentVersion]);

  // 문서·완료 화면의 '출처 N개' 는 문서에 번호가 달린 근거 수로 보여 준다(못 받으면 항목별 근거 합계로 대신).
  useEffect(() => {
    if ((step !== "document" && step !== "complete") || !sessionId || documentVersion === 0) return;
    let cancelled = false;
    api
      .citations(sessionId)
      .then((result) => !cancelled && setCitationTotal(result.citations.length))
      .catch(() => !cancelled && setCitationTotal(null));
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, documentVersion]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setError(null);
      setActing(true);
      try {
        const result = await action();
        if (result && typeof result === "object" && "message" in result) {
          const message = (result as { message?: Parameters<typeof addMessages>[0][number] }).message;
          if (message) addMessages([message]);
        }
        return result;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) expire();
        setError((e as Error).message);
        return undefined;
      } finally {
        setActing(false);
        void refresh();
      }
    },
    [addMessages, refresh, expire],
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

  // 기본 정보 → 세션 생성 → 자료 등록. busy 동안 다시 부르지 않아 두 번 눌러도 세션이 두 개 생기지 않는다.
  const start = async (form: StartData) => {
    if (busy) return;
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
        successor: form.successor,
        successor_login_id: form.successorLoginId,
        handover_date: form.date,
      });
      setMarkdown("");
      navigate({ kind: "session", id: created.id, step: "upload" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire();
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
    if (!sessionId || !session || busy) return;
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
    if (result) goStep("processing");
  };

  // 문서 생성·수정 요청: 서버가 202 로 받으면 생성 중 화면에서 기다리던 버전이 나올 때까지 폴링 결과를 보여 준다.
  const generate = async () => {
    if (!sessionId || acting) return;
    const next = (session?.document_version ?? 0) + 1;
    const result = await run(() => api.generate(sessionId));
    if (result) {
      awaitingStart.current = true;
      setTargetVersion(next);
      goStep("generating");
    }
  };

  const revise = async (text: string) => {
    if (!sessionId || acting) return;
    const next = (session?.document_version ?? 0) + 1;
    const result = await run(() => api.chat(sessionId, text));
    if (result) {
      awaitingStart.current = true;
      setTargetVersion(next);
      goStep("generating");
    }
  };

  const go = (next: Route) => {
    setError(null);
    navigate(next);
  };
  const goHome = () => go(HOME);
  const startNew = () => go({ kind: "new", mode: null }); // 새 인수인계는 유형 선택부터

  // 홈 목록에서 삭제. 성공하면 목록을 다시 불러오고, 실패하면 오류 문구를 돌려준다.
  const deleteSession = async (id: string): Promise<string | null> => {
    try {
      await api.deleteSession(id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire();
      return (e as Error).message;
    }
    await loadSessions();
    return null;
  };

  const login = async (loginId: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(loginId, password);
      setProfile(profileFromUser(result.user));
      setLoginNotice(null);
      setLoggedIn(true); // 주소는 그대로이므로 보던 작업·화면으로 바로 돌아간다
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
    setMarkdown("");
    setError(null);
    setLoginNotice(null);
    setProfile(EMPTY_PROFILE);
    setWorkspace(null);
    setLoggedIn(false);
    navigate(HOME, { replace: true });
  };

  const nav: HomeNav = {
    onHome: goHome,
    onHandover: () => go({ kind: "home", page: "handover" }),
    onDocuments: () => go({ kind: "home", page: "documents" }),
    onReceived: () => go({ kind: "home", page: "received" }),
    onLogout: logout,
  };
  const list: SessionList = {
    sessions,
    error: sessionsError,
    reload: () => void loadSessions(),
    open: (id) => go({ kind: "session", id, step: null }), // 서버 단계로 복원
    openDocument: (id) => go({ kind: "session", id, step: "document" }), // 받은 인수인계·팀 관리에서 문서만 본다
    remove: deleteSession,
  };

  if (!authChecked) return null;
  if (!loggedIn) {
    return (
      <>
        <LoginScreen onLogin={login} onSignup={() => setAuthPanel("signup")} onForgot={() => setAuthPanel("forgot")} busy={busy} error={error} notice={loginNotice} />
        {authPanel === "signup" && <SignupScreen onBack={() => setAuthPanel(null)} onRegistered={(message) => { setError(null); setLoginNotice(message); }} />}
        {authPanel === "forgot" && <ForgotPasswordScreen onBack={() => setAuthPanel(null)} />}
      </>
    );
  }

  // 팀장(관리자)은 로그인 뒤 일반 모드(내 인수인계)와 팀 관리 모드 중 하나를 고른다. 일반 구성원은 바로 홈으로.
  if (profile.isAdmin && !workspace) {
    return (
      <WorkspaceSelectScreen
        onSelect={(next) => {
          setWorkspace(next);
          go(next === "admin" ? { kind: "admin", section: "dashboard" } : HOME);
        }}
        onLogout={logout}
      />
    );
  }
  const enterAdmin = () => {
    setWorkspace("admin");
    go({ kind: "admin", section: "dashboard" });
  };
  const exitAdmin = () => {
    setWorkspace("user");
    goHome();
  };

  if (route.kind === "admin") {
    if (profile.isAdmin) {
      return (
        <AdminDashboardScreen
          section={route.section}
          onSection={(section) => go({ kind: "admin", section })}
          onExit={exitAdmin}
          onOpenDocument={(id, from) => {
            setAdminReturn(from);
            list.openDocument(id);
          }}
          onExpire={expire}
        />
      );
    }
    return <DashboardScreen {...nav} list={list} onNew={startNew} isAdmin={false} onAdmin={() => undefined} />;
  }
  if (route.kind === "home") {
    if (route.page === "handover") return <OngoingHandoverScreen {...nav} list={list} onNew={startNew} />;
    if (route.page === "documents") return <CompletedDocumentsScreen {...nav} list={list} />;
    if (route.page === "received") return <ReceivedHandoverScreen {...nav} list={list} />;
    return <DashboardScreen {...nav} list={list} notice={homeNotice} onDismissNotice={() => setHomeNotice(null)} onNew={startNew} isAdmin={profile.isAdmin} onAdmin={enterAdmin} />;
  }
  if (route.kind === "new") {
    if (!route.mode) return <HandoverTypeScreen onSelect={(mode) => go({ kind: "new", mode })} onLogout={logout} onHome={goHome} />;
    return <StartScreen key={route.mode} mode={route.mode} onStart={start} onLogout={logout} onHome={goHome} busy={busy} error={error} />;
  }

  // route.kind === "session": 세션을 불러오는 동안·실패했을 때는 원인별 안내 화면.
  // 작업 중 다른 곳에서 삭제돼 404 가 오면 이전에 받아 둔 상태가 있어도 안내 화면으로 바꾼다.
  const gone = sessionErrorStatus === 404 || sessionErrorStatus === 403;
  if (!session || !step || gone) {
    let gate: GateState = { kind: "loading" };
    if (sessionError && sessionErrorStatus !== 401) {
      gate = gone ? { kind: "missing" } : { kind: "server", message: sessionError };
    }
    return (
      <SessionGateScreen
        state={gate}
        onRetry={() => void refresh()}
        onHome={() => {
          if (gate.kind === "missing") setHomeNotice("열 수 없는 작업이었어요. 삭제됐거나 내 계정의 작업이 아니에요.");
          goHome();
        }}
      />
    );
  }

  if (step === "upload") {
    return (
      <UploadStepScreen
        mode={data.mode}
        sources={session.sources}
        error={error}
        busy={busy}
        onBack={() => go({ kind: "new", mode: session.mode })}
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
  if (step === "processing") {
    return <ProcessingScreen mode={data.mode} session={session} onBack={() => goStep("upload")} onNext={() => goStep("question")} onRetry={() => sessionId && void run(() => api.retry(sessionId))} onLogout={logout} onHome={goHome} />;
  }
  if (step === "question") {
    return (
      <QuestionScreen
        mode={data.mode}
        session={session}
        messages={messages}
        config={config}
        error={error}
        busy={acting}
        onBack={() => goStep("upload")}
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
  if (step === "generating") {
    return (
      <GeneratingDocumentScreen
        mode={data.mode}
        session={session}
        targetVersion={targetVersion}
        onRetry={() => sessionId && void run(() => api.retry(sessionId))}
        onBack={() => goStep("question")}
        onLogout={logout}
        onHome={goHome}
      />
    );
  }
  if (step === "document") {
    // 인계자가 아닌 사람(인수자·팀장)이 열면 읽기 전용: 수정·완료 없이 보고 내려받기만. 돌아가기는 왔던 목록으로.
    const isOwner = !session.owner_login_id || session.owner_login_id === profile.employeeId;
    const isSuccessor = !!session.successor_login_id && session.successor_login_id === profile.employeeId;
    const readOnly = isOwner
      ? null
      : {
          badge: isSuccessor ? "전달받은 인수인계서" : "팀 구성원 인수인계서",
          note: `${session.owner_name}님이 작성한 인수인계서예요. 내용을 보고 PDF·Word 로 내려받을 수 있고, 수정은 인계자만 할 수 있어요.`,
          exitLabel: isSuccessor ? "받은 인수인계로 돌아가기" : "팀 관리로 돌아가기",
          onExit: () => go(isSuccessor ? { kind: "home", page: "received" } : { kind: "admin", section: adminReturn }),
        };
    return (
      <FinalDocumentScreen
        data={data}
        readOnly={readOnly}
        sessionId={session.id}
        markdown={markdown}
        onGanttEdit={(name, nth, months) => api.editGantt(session.id, name, nth, months).then((d) => setMarkdown(d.markdown))}
        loading={docLoading}
        sourceCount={citationTotal ?? citationCount(session)}
        failedMessage={session.status === "error" ? session.error : null}
        revising={acting || session.status === "running"}
        onRevise={(text) => void revise(text)}
        onRetry={() => sessionId && void run(() => api.retry(sessionId))}
        onBack={() => goStep("question")}
        onComplete={() => goStep("complete")}
        onLogout={logout}
        onHome={goHome}
      />
    );
  }
  return (
    <CompletionScreen
      mode={data.mode}
      sourceCount={session.sources.length}
      questionCount={session.question_count}
      citationCount={citationTotal ?? citationCount(session)}
      onViewDocument={() => goStep("document")}
      onNew={startNew}
      onHome={goHome}
    />
  );
}
