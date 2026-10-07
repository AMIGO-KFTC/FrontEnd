// BackEnd(FastAPI) 호출 모음. 개발 중에는 Vite 프록시가 /api 를 8000 포트로 넘긴다.
import type { AppConfig, ChatMessage, SessionCreate, SessionDetail, SessionSummary, Source } from "./types";

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

  listSessions: () => request<SessionSummary[]>("/api/sessions"),
  createSession: (body: SessionCreate) => post<SessionDetail>("/api/sessions", body),
  deleteSession: (id: string) => request<void>(`/api/sessions/${id}`, { method: "DELETE" }),
  state: (id: string, after: number) =>
    request<{ session: SessionDetail; messages: ChatMessage[] }>(`/api/sessions/${id}/state?after=${after}`),

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

  document: (id: string) => request<{ markdown: string; version: number }>(`/api/sessions/${id}/document`),
  downloadUrl: (id: string, format: "pdf" | "docx" | "md") => `${BASE}/api/sessions/${id}/download?format=${format}`,
};
