// BackEnd(FastAPI) 호출 모음. 개발 중에는 Vite 프록시가 /api 를 8000 포트로 넘긴다.
import type {
  AdminHandover,
  AdminMember,
  AppConfig,
  AuthUser,
  ChatMessage,
  CitationsResult,
  ConfluencePage,
  ConfluenceSearchResult,
  IntegrationImportResult,
  TeamGuidelineItem,
  TeamGuidelines,
  LoginResult,
  MattermostConversation,
  MattermostConversationDetail,
  ProfileInput,
  Member,
  ProfileResult,
  ReceivedHandover,
  SentTransfer,
  SessionCreate,
  SessionDetail,
  SessionSummary,
  SignupResult,
  Source,
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
      if (typeof data.detail === "string") message = data.detail;
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
  signup: (loginId: string, password: string, name: string, employeeNo = "") => post<SignupResult>("/api/auth/signup", { login_id: loginId, password, name, employee_no: employeeNo }),
  saveProfile: (body: ProfileInput) => request<ProfileResult>("/api/profile", { method: "PUT", body: JSON.stringify(body) }),

  // 구성원(인수자 선택용) · 받은 인수인계 · 관리자(팀장) 전용
  members: () => request<{ members: Member[] }>("/api/members"),
  sessionTransfers: (id: string) => request<{ transfers: SentTransfer[] }>(`/api/sessions/${id}/transfers`),
  sendTransfer: (id: string, recipientId: number, message: string) => post<{ message: string }>(`/api/sessions/${id}/transfers`, { recipient_id: recipientId, message }),
  receivedHandovers: () => request<{ handovers: ReceivedHandover[] }>("/api/handovers/received"),
  adminMembers: () => request<{ organization: string; members: AdminMember[] }>("/api/admin/members"),
  adminHandovers: () => request<{ organization: string; handovers: AdminHandover[] }>("/api/admin/handovers"),
  deleteMember: (id: number) => request<{ message: string }>(`/api/admin/members/${id}`, { method: "DELETE" }),

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
  chat: (id: string, text: string) => post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/chat`, { text }),
  skip: (id: string) => post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/skip`),
  // 이미 답했거나 건너뛴 질문으로 돌아가 다시 묻는다(질의응답 중에만). 새로 답하면 앞의 답을 고친다.
  reopen: (id: string, gapId: string) => post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/reopen`, { gap_id: gapId }),
  generate: (id: string) => post<{ ok: boolean; message: ChatMessage }>(`/api/sessions/${id}/generate`),
  retry: (id: string) => post<SessionDetail>(`/api/sessions/${id}/retry`),

  document: (id: string) => request<{ markdown: string; version: number }>(`/api/sessions/${id}/document`),
  // 화면에서 직접 고친 문서 전체를 새 버전으로 저장한다(PUT /document). baseVersion 이 현재 버전과 다르면 서버가 409 로 막는다.
  saveDocument: (id: string, markdown: string, baseVersion: number) =>
    request<{ message: string; saved: boolean }>(`/api/sessions/${id}/document`, { method: "PUT", body: JSON.stringify({ markdown, base_version: baseVersion }) }),
  // 내가 작성한 인수인계서 목록(GET /api/documents). origin 은 현재 버전을 만든 쪽(ai | user | restore).
  myDocuments: () => request<{ documents: { session_id: string; version: number; origin: string; origin_label: string; updated_at: string }[] }>("/api/documents"),
  citations: (id: string) => request<CitationsResult>(`/api/sessions/${id}/citations`),
  editGantt: (id: string, name: string, nth: number, months: number[]) =>
    request<{ markdown: string; version: number }>(`/api/sessions/${id}/document/gantt`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nth, months }),
    }),
  downloadUrl: (id: string, format: "pdf" | "docx" | "md") => `${BASE}/api/sessions/${id}/download?format=${format}`,
  sourceFileUrl: (id: string, sourceId: string) => `${BASE}/api/sessions/${id}/sources/${sourceId}/file`, // 올린 파일 원본 내려받기

  // 가상 Mattermost · Confluence(실제 API 대신 BackEnd 의 예시 데이터)
  mattermostConversations: (q = "") =>
    request<{ me: string; total: number; conversations: MattermostConversation[] }>(`/api/integrations/mattermost/conversations?q=${encodeURIComponent(q)}`),
  mattermostConversation: (conversationId: string) => request<MattermostConversationDetail>(`/api/integrations/mattermost/conversations/${conversationId}`),
  importMattermost: (id: string, conversationIds: string[]) =>
    post<IntegrationImportResult>(`/api/sessions/${id}/integrations/mattermost`, { conversation_ids: conversationIds }),
  confluenceSearch: (q: string, space = "") =>
    request<ConfluenceSearchResult>(`/api/integrations/confluence/search?q=${encodeURIComponent(q)}&space=${encodeURIComponent(space)}`),
  teamGuidelines: () => request<TeamGuidelines>("/api/team-guidelines/me"),
  // 보낸 필드만 서버에서 바뀐다(항목 화면은 items·notes, AI 맞춤 설정 화면은 prompt 만 보낸다)
  saveTeamGuidelines: (body: { items?: TeamGuidelineItem[]; notes?: string; prompt?: string }) =>
    request<TeamGuidelines>("/api/team-guidelines/me", { method: "PUT", body: JSON.stringify(body) }),
  confluencePage: (pageId: string) => request<ConfluencePage & { body: string }>(`/api/integrations/confluence/pages/${pageId}`),
  importConfluence: (id: string, pageIds: string[]) => post<IntegrationImportResult>(`/api/sessions/${id}/integrations/confluence`, { page_ids: pageIds }),
};
