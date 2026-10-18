// BackEnd(FastAPI) 호출 모음. 개발 중에는 Vite 프록시가 /api 를 8000 포트로 넘긴다.
import type {
  AppConfig,
  AuthUser,
  ChatMessage,
  ConfluencePage,
  ConfluenceSearchResult,
  DocumentSaved,
  DocumentVersion,
  DocumentVersionSummary,
  HandoverDocument,
  IntegrationImportResult,
  LoginResult,
  MailImportResult,
  MailList,
  MattermostConversation,
  MattermostConversationDetail,
  MemberReport,
  MyDocument,
  MyInfoUpdate,
  MyPage,
  SessionCreate,
  SessionDetail,
  SessionSummary,
  Source,
  TeamInfo,
  TeamReport,
  UsageTotal,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 프로토타입용 사용자 구분: 브라우저마다 임의 ID 를 만들어 X-User-Id 헤더로 보낸다(실서비스는 SSO 로 대체).
function userId(): string {
  const key = "amigo-user-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    localStorage.setItem(key, id);
  }
  return id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-User-Id", userId());
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다. BackEnd 가 실행 중인지 확인해 주세요.");
  }
  if (!res.ok) {
    let message = `요청에 실패했습니다 (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.message === "string" && data.message) message = data.message; // BackEnd 가 화면용으로 정리한 문구(입력값 오류 포함)
      else if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {
      /* 본문이 JSON 이 아니면 기본 메시지 */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request<{ status: string; engine: string; model: string | null }>("/api/health"),
  config: () => request<AppConfig>("/api/config"),

  login: (loginId: string, password: string) => post<LoginResult>("/api/auth/login", { login_id: loginId, password }),
  logout: () => post<{ message: string }>("/api/auth/logout"),
  me: () => request<{ user: AuthUser }>("/api/auth/me"),

  // 비밀번호 찾기: 아이디와 등록한 이메일이 맞으면 재설정 안내(개발용 설정에서는 reset_token 이 함께 온다)
  forgotPassword: (loginId: string, email: string) =>
    post<{ message: string; expires_in_minutes: number; reset_token: string | null }>("/api/auth/password/forgot", { login_id: loginId, email }),
  resetPassword: (token: string, newPassword: string) => post<{ message: string }>("/api/auth/password/reset", { token, new_password: newPassword }),

  // 마이페이지: 내 정보 조회·수정(보낸 항목만), 비밀번호 바꾸기, 내가 작성한 인수인계서
  myPage: () => request<MyPage>("/api/me"),
  updateMe: (body: MyInfoUpdate) => request<MyPage>("/api/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/me/password", { method: "PUT", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
  // 관리자: 팀 목록 → 팀원별 인수인계 작성 현황 → 팀원 상세(관리자가 아니면 403)
  adminTeams: () => request<{ teams: TeamInfo[] }>("/api/admin/teams"),
  adminTeamReport: (department: string, team: string, dateFrom = "", dateTo = "") =>
    request<TeamReport>(`/api/admin/teams/report?${new URLSearchParams({ department, team, ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) })}`),
  adminMemberReport: (userId: number, dateFrom = "", dateTo = "") =>
    request<MemberReport>(`/api/admin/members/${userId}/report?${new URLSearchParams({ ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) })}`),
  myDocuments: () => request<{ documents: MyDocument[] }>("/api/documents"),

  listSessions: () => request<SessionSummary[]>("/api/sessions"),
  createSession: (body: SessionCreate) => post<SessionDetail>("/api/sessions", body),
  deleteSession: (id: string) => request<void>(`/api/sessions/${id}`, { method: "DELETE" }),
  state: (id: string, after: number) =>
    request<{ session: SessionDetail; messages: ChatMessage[]; usage_total: UsageTotal }>(`/api/sessions/${id}/state?after=${after}`),
  usage: () => request<UsageTotal>("/api/usage"),

  upload: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f, f.name));
    return request<Source[]>(`/api/sessions/${id}/upload`, { method: "POST", body: form });
  },
  addLinks: (id: string, urls: string[], linkType: string) =>
    post<Source[]>(`/api/sessions/${id}/links`, { urls, link_type: linkType }),
  deleteSource: (id: string, sourceId: string) =>
    request<void>(`/api/sessions/${id}/sources/${sourceId}`, { method: "DELETE" }),

  analyze: (id: string) => post<SessionDetail>(`/api/sessions/${id}/analyze`),
  // 답변 보내기: replyTo 는 화면에 띄운 질문의 메시지 ID. 그사이 질문이 바뀌었으면 409(엉뚱한 질문에 답이 붙지 않게)
  chat: (id: string, text: string, replyTo?: number) =>
    post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/chat`, replyTo ? { text, reply_to: replyTo } : { text }),
  skip: (id: string, replyTo?: number) =>
    post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/skip${replyTo ? `?reply_to=${replyTo}` : ""}`),
  generate: (id: string) => post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/generate`),
  retry: (id: string) => post<SessionDetail>(`/api/sessions/${id}/retry`),

  document: (id: string) => request<HandoverDocument>(`/api/sessions/${id}/document`),
  // 화면에서 고친 인수인계서를 새 버전으로 저장. baseVersion 은 수정을 시작할 때의 version(그사이 바뀌었으면 409)
  saveDocument: (id: string, markdown: string, baseVersion: number, note = "") =>
    request<DocumentSaved>(`/api/sessions/${id}/document`, { method: "PUT", body: JSON.stringify({ markdown, base_version: baseVersion, note }) }),
  documentVersions: (id: string) =>
    request<{ current_version: number; versions: DocumentVersionSummary[] }>(`/api/sessions/${id}/document/versions`),
  documentVersion: (id: string, version: number) => request<DocumentVersion>(`/api/sessions/${id}/document/versions/${version}`),
  restoreDocument: (id: string, version: number, baseVersion: number) =>
    post<DocumentSaved>(`/api/sessions/${id}/document/versions/${version}/restore`, { base_version: baseVersion }),
  downloadUrl: (id: string, format: "pdf" | "docx" | "md", version?: number) =>
    `${BASE}/api/sessions/${id}/download?format=${format}${version ? `&version=${version}` : ""}`,

  // 메일 조회 API: session_id 를 주면 인수인계 업무와 관련 있는 메일부터, 이미 가져온 메일은 imported 로 온다
  mails: (sessionId: string, q = "", page = 1) =>
    request<MailList>(`/api/mail/messages?${new URLSearchParams({ session_id: sessionId, q, page: String(page), size: "20" })}`),
  importMails: (sessionId: string, messageIds: string[]) => post<MailImportResult>(`/api/sessions/${sessionId}/mails`, { message_ids: messageIds }),
  editGantt: (id: string, name: string, nth: number, months: number[]) =>
    request<HandoverDocument>(`/api/sessions/${id}/document/gantt`, { method: "PUT", body: JSON.stringify({ name, nth, months }) }),

  // 가상 Mattermost · Confluence(실제 API 대신 BackEnd 의 예시 데이터)
  mattermostConversations: (q = "") =>
    request<{ me: string; total: number; conversations: MattermostConversation[] }>(`/api/integrations/mattermost/conversations?q=${encodeURIComponent(q)}`),
  mattermostConversation: (conversationId: string) => request<MattermostConversationDetail>(`/api/integrations/mattermost/conversations/${conversationId}`),
  importMattermost: (id: string, conversationIds: string[]) =>
    post<IntegrationImportResult>(`/api/sessions/${id}/integrations/mattermost`, { conversation_ids: conversationIds }),
  confluenceSearch: (q: string, space = "") =>
    request<ConfluenceSearchResult>(`/api/integrations/confluence/search?q=${encodeURIComponent(q)}&space=${encodeURIComponent(space)}`),
  confluencePage: (pageId: string) => request<ConfluencePage & { body: string }>(`/api/integrations/confluence/pages/${pageId}`),
  importConfluence: (id: string, pageIds: string[]) => post<IntegrationImportResult>(`/api/sessions/${id}/integrations/confluence`, { page_ids: pageIds }),
};
