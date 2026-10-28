// BackEnd(FastAPI) 호출 모음. 개발 중에는 Vite 프록시가 /api 를 8000 포트로 넘긴다.
import type {
  AdminHandover,
  AdminMember,
  AppConfig,
  AuthUser,
  BusinessPlans,
  ChatAnswer,
  ChatScope,
  JiraIssue,
  JiraIssueDetail,
  JiraProject,
  JiraSearchResult,
  NotificationsResult,
  ChatMessage,
  ChatTurn,
  CitationsResult,
  ConfluencePage,
  ConfluenceSearchResult,
  IntegrationImportResult,
  TeamDuties,
  TeamGuidelineItem,
  TeamDocument,
  TeamGlossaryTerm,
  TeamGuidelines,
  LoginResult,
  MailDetail,
  MailImportResult,
  MailList,
  MailQueryParams,
  MattermostConversation,
  MattermostConversationDetail,
  OrgDuties,
  HandoverCalendarResult,
  OnetelEvent,
  OnetelImportResult,
  PersonnelSchedule,
  PersonnelScheduleInput,
  TeamSchedule,
  TeamScheduleInput,
  PlannerData,
  PlannerEvent,
  PlannerTodo,
  PlannerWeekTask,
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
    throw new ApiError(0, "서버에 연결할 수 없습니다.\nBackEnd 가 실행 중인지 확인해 주세요.");
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
  // department·team: 가입과 동시에 팀 배정(내 정보를 고치지 않아도 인수인계에서 팀의 단위업무가 나온다)
  signup: (loginId: string, password: string, name: string, employeeNo = "", department = "", team = "") =>
    post<SignupResult>("/api/auth/signup", { login_id: loginId, password, name, employee_no: employeeNo, department, team }),
  // 회원가입에서 고를 본부·부와 팀(로그인 없이)
  orgTeams: () => request<{ divisions: { name: string; teams: string[] }[] }>("/api/auth/org-teams"),
  saveProfile: (body: ProfileInput) => request<ProfileResult>("/api/profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/me/password", { method: "PUT", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),

  // 구성원(인수자 선택용) · 받은 인수인계 · 관리자(팀장) 전용
  members: () => request<{ members: Member[] }>("/api/members"),
  orgDuties: () => request<OrgDuties>("/api/org-duties"),
  businessPlans: () => request<BusinessPlans>("/api/business-plans/me"), // 우리 팀 주요 사업계획(팀장용 인수인계서 1단계)
  sessionTransfers: (id: string) => request<{ transfers: SentTransfer[] }>(`/api/sessions/${id}/transfers`),
  sendTransfer: (id: string, recipientId: number, message: string) => post<{ message: string }>(`/api/sessions/${id}/transfers`, { recipient_id: recipientId, message }),
  // 인수인계 챗봇: 질문할 수 있는 업무(올린 자료 · 인수인계서)와 질문. 대화는 서버에 저장하지 않고 history 로 보낸다.
  chatScopes: () => request<{ scopes: ChatScope[] }>("/api/handover-chat/scopes"),
  askHandover: (question: string, history: ChatTurn[], scopeIds: string[] | null) =>
    post<ChatAnswer>("/api/handover-chat", { question, history, scope_ids: scopeIds }),
  notifications: () => request<NotificationsResult>("/api/notifications"),
  // ids 가 null 이면 모든 알림
  readNotifications: (ids: string[] | null) => post<NotificationsResult>("/api/notifications/read", { ids }),
  dismissNotifications: (ids: string[] | null) => post<NotificationsResult>("/api/notifications/dismiss", { ids }),
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
  // 부서·팀별 추가자료: 표의 항목(item)마다 파일을 올리면 서버가 등록 여부를 반영한 문서를 돌려준다
  uploadDeptFiles: (id: string, item: string, files: File[]) => {
    const form = new FormData();
    form.append("item", item);
    files.forEach((f) => form.append("files", f, f.name));
    return request<{ markdown: string; version: number }>(`/api/sessions/${id}/dept-files`, { method: "POST", body: form });
  },
  downloadUrl: (id: string, format: "pdf" | "docx" | "md") => `${BASE}/api/sessions/${id}/download?format=${format}`,
  session: (id: string) => request<SessionDetail>(`/api/sessions/${id}`), // 업무 상세(올린 자료 sources 포함)
  sourcesArchiveUrl: (id: string) => `${BASE}/api/sessions/${id}/sources/archive`, // 올린 파일 전체를 ZIP 한 개로
  sourceFileUrl: (id: string, sourceId: string) => `${BASE}/api/sessions/${id}/sources/${sourceId}/file`, // 올린 파일 원본 내려받기

  // 메일함: 목록·상세 조회와 고른 메일을 업무 자료(.eml)로 가져오기. 검색은 제목(subject)·관련 사람(person: 보낸 사람·받는 사람·참조)·폴더·첨부 여부로 한다.
  mailMessages: (params: MailQueryParams = {}) => {
    const query = new URLSearchParams({ page: String(params.page ?? 1), size: String(params.size ?? 20) });
    if (params.subject) query.set("subject", params.subject);
    if (params.person) query.set("person", params.person);
    if (params.folder) query.set("folder", params.folder);
    if (params.hasAttachments) query.set("has_attachments", "true");
    if (params.important) query.set("important", "true");
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    return request<MailList>(`/api/mail/messages?${query}`);
  },
  mailMessage: (messageId: string) => request<MailDetail>(`/api/mail/messages/${encodeURIComponent(messageId)}`),
  importMails: (sessionId: string, messageIds: string[]) => post<MailImportResult>(`/api/sessions/${sessionId}/mails`, { message_ids: messageIds }),

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
  saveTeamGuidelines: (body: { items?: TeamGuidelineItem[]; notes?: string; prompt?: string; intro?: string; glossary?: TeamGlossaryTerm[] }) =>
    request<TeamGuidelines>("/api/team-guidelines/me", { method: "PUT", body: JSON.stringify(body) }),
  // AI 팀 맞춤 설정 STEP3: 팀 공통 업무 자료 올리기·지우기
  uploadTeamDocuments: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<TeamDocument[]>("/api/team-guidelines/me/documents", { method: "POST", body: form });
  },
  deleteTeamDocument: (id: string) => request<void>(`/api/team-guidelines/me/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // 팀 담당 업무 목록. 읽기는 같은 소속 누구나, 추가·수정·삭제는 팀 관리자만(응답은 바뀐 뒤의 전체 목록)
  teamDuties: () => request<TeamDuties>("/api/team-duties/me"),
  addTeamDuty: (body: { name: string; description?: string }) => request<TeamDuties>("/api/team-duties/me", { method: "POST", body: JSON.stringify(body) }),
  updateTeamDuty: (id: string, body: { name?: string; description?: string; sort_order?: number }) =>
    request<TeamDuties>(`/api/team-duties/me/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTeamDuty: (id: string) => request<TeamDuties>(`/api/team-duties/me/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // 캘린더 일정·할 일(계정별로 서버에 저장). id 를 화면이 만들어 보내므로 응답을 기다리지 않고 바로 그려도 된다.
  planner: () => request<PlannerData>("/api/planner"),
  addPlannerEvent: (event: PlannerEvent) => post<{ event: PlannerEvent }>("/api/planner/events", event),
  updatePlannerEvent: (id: string, changes: { text?: string; memo?: string; done?: boolean }) =>
    request<{ event: PlannerEvent }>(`/api/planner/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
  updatePlannerWeekTask: (id: string, changes: { text?: string; memo?: string; done?: boolean }) =>
    request<{ task: PlannerWeekTask }>(`/api/planner/week-tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deletePlannerEvent: (id: string) => request<{ message: string }>(`/api/planner/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
  addPlannerTodo: (todo: PlannerTodo) => post<{ todo: PlannerTodo }>("/api/planner/todos", todo),
  updatePlannerTodo: (id: string, changes: Partial<Omit<PlannerTodo, "id">>) =>
    request<{ todo: PlannerTodo }>(`/api/planner/todos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deletePlannerTodo: (id: string) => request<{ message: string }>(`/api/planner/todos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  clearDonePlannerTodos: () => post<{ removed: number }>("/api/planner/todos/clear-done"),
  addPlannerWeekTask: (task: PlannerWeekTask) => post<{ task: PlannerWeekTask }>("/api/planner/week-tasks", task),
  deletePlannerWeekTask: (id: string) => request<{ message: string }>(`/api/planner/week-tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  deletePlannerRoutine: (id: string) => request<{ message: string }>(`/api/planner/routines/${encodeURIComponent(id)}`, { method: "DELETE" }),
  // 받은 인수인계서의 날짜는 캘린더 일정으로, 반복 업무는 정기 업무 칸으로(같은 내용은 두 번 넣지 않는다)
  onetelEvents: () => request<{ events: OnetelEvent[] }>("/api/planner/onetel/events"),
  // ids 를 주면 고른 일정만, 안 주면 모두
  importOnetelCalendar: (ids?: string[]) => post<OnetelImportResult>("/api/planner/onetel/import", { ids: ids ?? null }),
  applyReceivedToCalendar: (sessionId: string) => post<HandoverCalendarResult>(`/api/handovers/received/${encodeURIComponent(sessionId)}/calendar`),
  // 정기인사 일정: 조회는 누구나(전사 + 내 소속), 추가·수정·삭제는 관리자(팀장)
  personnelSchedules: () => request<{ schedules: PersonnelSchedule[]; organization: string; editable: boolean }>("/api/personnel-schedules"),
  addPersonnelSchedule: (body: PersonnelScheduleInput) => post<{ message: string; schedule: PersonnelSchedule }>("/api/admin/personnel-schedules", body),
  updatePersonnelSchedule: (id: number, body: PersonnelScheduleInput) =>
    request<{ message: string; schedule: PersonnelSchedule }>(`/api/admin/personnel-schedules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePersonnelSchedule: (id: number) => request<{ message: string }>(`/api/admin/personnel-schedules/${id}`, { method: "DELETE" }),
  teamSchedules: () => request<{ schedules: TeamSchedule[]; organization: string; editable: boolean }>("/api/team-schedules"),
  addTeamSchedule: (body: TeamScheduleInput) => post<{ message: string; schedule: TeamSchedule }>("/api/admin/team-schedules", body),
  updateTeamSchedule: (id: number, body: TeamScheduleInput) =>
    request<{ message: string; schedule: TeamSchedule }>(`/api/admin/team-schedules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTeamSchedule: (id: number) => request<{ message: string }>(`/api/admin/team-schedules/${id}`, { method: "DELETE" }),
  // 예전에 이 브라우저(localStorage)에만 저장해 둔 일정·할 일을 서버로 옮긴다. 같은 id 는 건너뛰어 다시 보내도 안전하다.
  importPlanner: (body: { events: PlannerEvent[]; todos: PlannerTodo[] }) => post<PlannerData>("/api/planner/import", body),
  confluencePage: (pageId: string) => request<ConfluencePage & { body: string }>(`/api/integrations/confluence/pages/${pageId}`),
  jiraProjects: () => request<{ today: string; projects: JiraProject[] }>("/api/integrations/jira/projects"),
  jiraSearch: (params: { q?: string; project?: string; status?: string; assignee?: string; type?: string }) =>
    request<JiraSearchResult>(`/api/integrations/jira/search?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`),
  jiraMoveIssue: (key: string, status: string) => request<JiraIssue>(`/api/integrations/jira/issues/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  jiraIssue: (key: string) => request<JiraIssueDetail>(`/api/integrations/jira/issues/${encodeURIComponent(key)}`),
  importJira: (id: string, itemIds: string[]) => post<IntegrationImportResult>(`/api/sessions/${id}/integrations/jira`, { item_ids: itemIds }),
  importConfluence: (id: string, pageIds: string[]) => post<IntegrationImportResult>(`/api/sessions/${id}/integrations/confluence`, { page_ids: pageIds }),
};
