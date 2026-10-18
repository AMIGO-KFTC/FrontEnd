// BackEnd(FastAPI) 호출 모음. 개발 중에는 Vite 프록시가 /api 를 8000 포트로 넘긴다.
import type {
  AppConfig,
  AuthUser,
  ChatMessage,
  DocumentSaved,
  DocumentVersion,
  DocumentVersionSummary,
  HandoverDocument,
  LoginResult,
  MailImportResult,
  MailList,
  SessionCreate,
  SessionDetail,
  SessionSummary,
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
};
