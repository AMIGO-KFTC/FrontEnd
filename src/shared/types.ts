// BackEnd API 응답 타입 (BackEnd/app/schemas.py 와 맞춘다)

export type Stage = "setup" | "analyzing" | "summary" | "qna" | "composing" | "review";
export type Status = "idle" | "running" | "waiting" | "error";
export type HandoverMode = "reassignment" | "leave"; // 인사발령 / 장기휴가
export type Coverage = "sufficient" | "partial" | "missing";

export interface Source {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string;
  link_type: string;
  extension: string;
  size: number;
  status: "pending" | "processing" | "ready" | "failed";
  error: string;
  chunk_count: number;
  warnings: string[];
  added_stage: string;
  created_at: string;
}

export interface Citation {
  source_id: string;
  label: string;
  chunk_id?: string;
  quote?: string;
}

// 인수인계서의 근거 번호별 출처(GET /api/sessions/{id}/citations). 번호는 문서의 '근거 자료' 목록과 같다.
export interface DocumentCitation extends Citation {
  number: number;
  kind: "document" | "answer";
  source_name: string;
  text: string;
  slot: string;
  item_title: string;
}

export interface CitationsResult {
  document_version: number;
  citations: DocumentCitation[];
}

export interface SlotItem {
  id: string;
  title: string;
  fields: Record<string, string>;
  citations: Citation[];
  origin: "document" | "user" | "mixed";
  confirmed?: boolean;
}

export interface SlotState {
  key: string;
  items: SlotItem[];
  coverage: Coverage;
  summary?: string;
  note?: string;
}

export interface Gap {
  id: string;
  slot: string;
  item_id?: string;
  description: string;
  question: string;
  priority: number;
  status: "open" | "asked" | "answered" | "resolved" | "skipped";
  aux?: boolean; // 보조질문(꼭 답하지 않아도 되는 질문)
  gate?: string; // 예/아니요로 먼저 묻는 질문(ask | confirm). 예/아니요에 답하면 비워지고 이어지는 주관식 질문이 된다
  picker?: string; // 답을 고르는 방식: period(주기 선택 또는 달력 기간 선택)
}

export interface SessionSummary {
  id: string;
  title: string;
  owner_name: string;
  organization: string;
  position: string;
  mode: HandoverMode;
  task_name: string;
  successor: string;
  successor_login_id: string; // 인수자가 이 시스템 계정이면 그 아이디(그 계정의 '받은 인수인계'에 나타난다)
  handover_date: string;
  leave_start?: string; // 장기휴가 시작일(YYYY-MM-DD)
  leave_end?: string; // 장기휴가 종료일
  stage: Stage;
  status: Status;
  document_version: number;
  created_at: string;
  updated_at: string;
}

// Claude API 사용량. cost_usd 는 모델 단가로 계산한 추정치(실제 청구액은 Anthropic Console)
export interface Usage {
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
}

export interface UsageTotal extends Usage {
  sessions: number;
  budget_usd: number; // 0 이면 제한 없음
  remaining_usd: number | null;
}

export interface SessionDetail extends SessionSummary {
  duties: string;
  units?: HandoverUnit[]; // 인계자 정보에서 고른 단위업무와 세부업무(예전 세션·예전 서버는 없거나 빈 목록)
  owner_login_id: string; // 인계자 계정의 아이디. 로그인한 사용자와 다르면(인수자·팀장) 문서 화면을 읽기 전용으로 그린다
  viewer?: "owner" | "recipient" | "team" | ""; // 지금 계정과의 관계: 인계자 · 전송받은 사람 · 같은 팀 팀장
  progress: { message: string; current: number; total: number };
  error: string;
  engine: string;
  slots: Record<string, SlotState>;
  gaps: Gap[];
  open_gap_count: number;
  question_count: number;
  sources: Source[];
  last_message_id: number;
  usage: Usage;
}

export interface MessageMeta {
  gap_id?: string;
  slot?: string;
  number?: number;
  remaining?: number;
  quick_replies?: string[];
  allow_files?: boolean;
  choice?: "yesno"; // 예/아니요 두 선택지로 답하는 질문
  picker?: "period"; // 주기(choices)를 고르거나, 정기적이지 않으면 달력에서 기간을 고르는 질문
  choices?: string[];
  aux?: boolean; // 보조질문: 질문 왼편에 '보조질문' 태그와 aux_note 안내를 붙인다
  aux_note?: string;
  retry?: boolean;
  coverage?: Record<string, Coverage>;
  version?: number;
}

export interface ChatMessage {
  id: number;
  role: "assistant" | "user" | "system";
  kind: string;
  content: string;
  meta: MessageMeta;
  created_at: string;
}

export interface SlotSpec {
  key: string;
  title: string;
  description: string;
  fields: { key: string; label: string }[];
  required: string[];
  leave: boolean;
}

export interface AppConfig {
  max_upload_mb: number;
  max_files_per_upload: number;
  allowed_extensions: string[];
  format_labels: Record<string, string>;
  link_types: { key: string; label: string }[];
  modes: { key: HandoverMode; label: string }[];
  slots: SlotSpec[];
  engine: string;
  model: string | null;
}

export interface SessionCreate {
  owner_name: string;
  organization: string;
  position: string;
  duties: string;
  successor: string;
  successor_login_id?: string; // 인수자가 이 시스템 계정이면 그 아이디(예전 화면은 보내지 않는다)
  handover_date: string;
  leave_start?: string; // 장기휴가일 때 휴가 시작일
  leave_end?: string; // 장기휴가일 때 휴가 종료일
  mode: HandoverMode;
  task_name: string;
  units?: HandoverUnit[];
}

// 단위업무 1건과 그 세부업무(정기·비정기). 장기휴가는 단위업무 없이 이름을 비운 1건에 세부업무만 담는다.
export interface HandoverUnit {
  name: string;
  regular: string[];
  irregular: string[];
}

// 직제규정 시행세칙(GET /api/org-duties): 본부·부 → 팀 → 단위업무 목록. 지금은 가상 예시 자료다.
export interface OrgDuties {
  title: string;
  note: string;
  divisions: { name: string; teams: { name: string; duties: string[] }[] }[];
}

// 로그인(BackEnd /api/auth). 세션 쿠키(amigo_session)는 서버가 내려 주고 브라우저가 알아서 보낸다.
export interface AuthUser {
  id: number;
  login_id: string;
  name: string;
  email?: string;
  employee_no?: string; // 사번(로그인 아이디와 별개)
  is_admin: boolean; // 관리자 권한(users.is_admin). 팀장 계정이 팀 관리 모드를 연다
  profile: { department: string; position: string; team: string; name: string; employee_no?: string } | null;
}

// 회원가입(POST /api/auth/signup)과 프로필 저장(PUT /api/profile) 응답. message 는 화면에 그대로 띄운다.
export interface SignupResult {
  message: string;
  user: AuthUser;
}

export interface ProfileInput {
  department: string;
  position: string;
  team: string;
  name: string;
  employee_no?: string; // 보내지 않으면 서버가 그대로 두고, 빈 문자열이면 비운다
}

export interface ProfileResult {
  message: string;
  profile: ProfileInput;
}

export interface LoginResult {
  message: string;
  name: string;
  user: AuthUser;
  expires_at: string;
}

// 가상 Mattermost · Confluence 연동(BackEnd /api/integrations). 실제 API 가 아닌 예시 데이터를 돌려준다.
export interface MattermostConversation {
  id: string;
  type: "channel" | "private" | "group" | "dm";
  name: string;
  display_name: string;
  team: string;
  purpose: string;
  members: string[];
  member_count: number;
  message_count: number;
  first_post_at: string;
  last_post_at: string;
  last_message: { user_name: string; text: string };
  url: string;
}

export interface MattermostPost {
  id: string;
  user: string;
  user_name: string;
  user_org: string;
  created_at: string;
  text: string;
  mine: boolean;
}

export interface MattermostConversationDetail extends MattermostConversation {
  posts: MattermostPost[];
}

// 가상 Jira(BackEnd /api/integrations/jira). 프로젝트 진행 현황과 이슈를 인수인계 자료로 가져온다.
export type JiraStatusCounts = Record<string, number>;
export type JiraProgress = { total: number; done: number; counts: JiraStatusCounts; points: number; done_points: number; percent: number };
export type JiraEpicProgress = JiraProgress & { key: string; summary: string; status: string; assignee: string; due: string };
export type JiraProject = {
  key: string;
  name: string;
  lead: string;
  team: string;
  description: string;
  url: string;
  sprint: (JiraProgress & { name: string; start: string; end: string; goal: string; days_left: number }) | null;
  next_sprint: { name: string; start: string; end: string; goal: string } | null;
  epics: JiraEpicProgress[];
  progress: JiraProgress;
  open_by_assignee: Record<string, number>;
  blocked: { key: string; summary: string; assignee: string; reason: string }[];
  issue_count: number;
};
export type JiraIssue = {
  key: string;
  project: string;
  type: string;
  summary: string;
  status: string;
  category: "todo" | "progress" | "done";
  priority: string;
  assignee: string;
  reporter: string;
  epic: string;
  parent: string;
  epic_summary: string;
  sprint: string;
  points: number;
  due: string;
  labels: string[];
  created: string;
  updated: string;
  blocked: string;
  url: string;
  comment_count: number;
  progress?: JiraProgress;
};
export type JiraIssueDetail = JiraIssue & { description: string; comments: { author: string; date: string; body: string }[]; children: JiraIssue[]; subtasks: JiraIssue[] };
export type JiraSearchResult = { total: number; issues: JiraIssue[]; statuses: string[]; types: string[]; assignees: string[] };

export interface ConfluencePage {
  id: string;
  title: string;
  space_key: string;
  space_name: string;
  labels: string[];
  author: string;
  updated_at: string;
  version: number;
  ancestors: string[];
  url: string;
  excerpt: string;
  matched_in?: string[];
}

export interface ConfluenceSearchResult {
  query: string;
  terms: string[];
  total: number;
  results: ConfluencePage[];
  spaces: { key: string; name: string }[];
}

export interface IntegrationImportResult {
  message: string;
  sources: Source[];
  skipped: string[];
}

// 구성원(프로필을 입력한 계정). 인수자 선택 목록과 관리자 구성원 목록에 쓴다.
export interface Member {
  id: number;
  login_id: string;
  name: string;
  is_admin: boolean;
  department: string;
  team: string;
  position: string;
  organization: string;
}

// 인계자가 이 인수인계서를 보낸 기록(GET /api/sessions/{id}/transfers). 받는 사람마다 한 건이다.
export interface SentTransfer {
  id: string;
  recipient: { user_id: number; name: string; login_id: string; department: string; team: string; position: string };
  created_at: string;
  is_read: boolean;
}

// 받은 인수인계(GET /api/handovers/received): 인계자가 나에게 전송한 세션. 읽기(문서·PDF)만 할 수 있다.
export interface ReceivedHandover {
  id: string;
  title: string;
  task_name: string;
  duties?: string[]; // 이 인수인계서에 담긴 담당 업무 이름(여러 개일 수 있다)
  mode: HandoverMode;
  leave_start?: string; // 장기휴가 기간(장기휴가일 때만)
  leave_end?: string;
  owner_name: string;
  owner_login_id: string;
  organization: string;
  position: string;
  handover_date: string;
  stage: Stage;
  status: Status;
  document_version: number;
  file_count: number;
  created_at: string;
  updated_at: string;
}

// 관리자(팀장) 화면: 우리 팀 구성원과 팀의 인수인계
export interface AdminMember extends Member {
  handover_count: number;
  completed_count: number;
  last_login_at: string | null;
}

export interface AdminHandover extends ReceivedHandover {
  successor: string;
  successor_login_id: string;
  question_count: number;
  open_gap_count: number;
}

// 팀 인수인계서 지침(관리자 화면). 소속(부서 + 팀) 단위로 BackEnd 에 저장되고, 그 소속의 AI 분석 프롬프트에 반영된다.
export interface TeamGuidelineItem {
  id: string;
  name: string;
  instruction: string;
}

export interface TeamGlossaryTerm {
  term: string;
  meaning: string;
}

export interface TeamDocument {
  id: string;
  name: string;
  size: number;
  uploaded_by: string;
  uploaded_at: string | null;
}

export interface TeamGuidelines {
  message: string;
  organization: string;
  items: TeamGuidelineItem[];
  notes: string; // STEP4 기타 중요 포인트
  prompt: string;
  intro: string; // STEP1 팀 소개
  glossary: TeamGlossaryTerm[]; // STEP2 업무 용어집
  documents: TeamDocument[]; // STEP3 팀 업무 문서
  updated_at: string | null;
  updated_by: string;
  editable: boolean;
  prompt_preview: string;
}

// 팀 담당 업무 목록(GET·POST /api/team-duties/me, PATCH·DELETE /api/team-duties/me/<id>). 팀장이 관리하고, 구성원은 1단계에서 고른다.
export interface TeamDuty {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  updated_by: string;
  updated_at: string | null;
}

export interface TeamDuties {
  message: string;
  organization: string;
  duties: TeamDuty[];
  editable: boolean;
}

// 알림(GET /api/notifications, POST /api/notifications/read · /dismiss): 받은 인수인계서 도착·수정. 확인·지움 상태는 서버에 계정별로 남는다.
export type AppNotification = {
  id: string;
  kind: "received" | "updated";
  session_id: string | null;
  title: string;
  text: string;
  sender_name: string;
  task_name: string;
  created_at: string;
  read: boolean;
};
export type NotificationsResult = { message: string; notifications: AppNotification[]; unread: number };

// 인수인계 챗봇(GET /api/handover-chat/scopes, POST /api/handover-chat): 올린 자료·인계자 답변·인수인계서를 근거로 답한다.
export type ChatScope = {
  id: string; // 질문 범위 = 업무(세션) ID. 지워진 인계 세션의 보낸 시점 문서는 'transfer:<ID>'
  title: string;
  task_name: string;
  owner_name: string;
  kind: "mine" | "received" | "team"; // received 는 인계자가 전송한 인수인계서만 근거(원본 자료는 공유되지 않는다), team 은 팀장이 검토하는 팀원 인수인계(자료·문서 모두)
  version: number; // 인수인계서 버전(아직 없으면 0)
  has_document: boolean;
  source_count: number; // 근거가 되는 올린 자료 수
  session_id: string | null; // 인수인계서를 열 수 있는 세션(없으면 null)
  updated_at: string;
  duties?: string[]; // 인수인계서에 담긴 담당 업무 이름
  recipients?: string[]; // 내 업무(mine)를 보낸 인수자 이름
};
export type ChatSourceKind = "document" | "answer" | "mail" | "link" | "file" | "note";
export type ChatSource = { scope_id: string; scope_title: string; scope_task: string; scope_kind: "mine" | "received" | "team"; scope_owner: string; session_id: string | null; kind: ChatSourceKind; label: string; source_id: string | null }; // source_id: 올린 파일·메일의 ID(원본 내려받기에 쓴다)
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatAnswer = { answer: string; grounded: boolean; sources: ChatSource[]; searched: number; engine: string };

// 메일함(GET /api/mail/messages, GET /api/mail/messages/{id}, POST /api/sessions/{id}/mails). 지금은 가상 메일함이 응답한다.
export type MailAddress = { name: string; email: string };
export type MailSummary = {
  id: string;
  folder: "inbox" | "sent" | string;
  subject: string;
  sender: MailAddress;
  to: MailAddress[];
  sent_at: string;
  snippet: string;
  has_attachments: boolean;
  attachment_count: number;
  important: boolean;
  relevance: number;
  recommended: boolean; // 이 업무와 관련 있어 보이는 메일
  imported: boolean; // 이미 이 업무 자료로 가져온 메일
};
export type MailAttachment = { name: string; size: number; content_type: string };
export type MailDetail = MailSummary & { cc: MailAddress[]; body: string; attachments: MailAttachment[] };
export type MailList = { message: string; provider: string; mailbox: MailAddress; messages: MailSummary[]; total: number; page: number; size: number; has_next: boolean; keywords: string[] };
export type MailQueryParams = { subject?: string; person?: string; folder?: "" | "inbox" | "sent"; hasAttachments?: boolean; important?: boolean; dateFrom?: string; page?: number; size?: number };
export type MailImportResult = { success: boolean; message: string; session_id: string; files: Source[]; skipped: string[]; analysis_scheduled: boolean };

// 캘린더 일정·할 일(GET /api/planner 등). 로그인 계정마다 서버에 저장한다. id 는 화면이 만들어 보낼 수 있다(같은 id 는 두 번 쌓이지 않음).
export type PlannerEvent = { id: string; date: string; text: string; memo?: string; done?: boolean }; // date: 'YYYY-MM-DD', memo: 짧은 메모
export type PlannerTodo = { id: string; text: string; done: boolean; date: string | null; memo?: string }; // date 가 null 이면 날짜 없는 할 일
// 정기 업무: 받은 인수인계서에서 가져온 반복 업무(날짜로 풀지 않고 캘린더 화면의 '정기 업무' 칸에 주기별로 보여 준다)
export type RoutineCadence = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "other";
export type PlannerRoutine = { id: string; cadence: RoutineCadence; name: string; timing: string; months: number[]; source: string }; // months: 분기·반기·매년 업무의 해당 월(비면 매달 또는 모름)
// 정기인사 일정(팀장이 등록, GET /api/personnel-schedules). 언제나 등록한 팀장의 소속(부서 팀) 단위
export type PersonnelSchedule = { id: number; name: string; announce_date: string | null; appoint_date: string; organization: string; created_by: string };
export type PersonnelScheduleInput = { name: string; announce_date: string | null; appoint_date: string };
// 팀 공유 일정(팀장이 등록, GET /api/team-schedules). 워크숍·회의·마감 등, 우리 팀 단위. end_date 는 여러 날짜리일 때만 있다
export type TeamSchedule = { id: number; title: string; start_date: string; end_date: string | null; memo: string; organization: string; created_by: string };
export type TeamScheduleInput = { title: string; start_date: string; end_date: string | null; memo: string };
// 주간 업무: 캘린더에서 주(달력 한 줄)를 골라 직접 적은 그 주에만 할 일. week 는 그 주 일요일 'YYYY-MM-DD'
export type PlannerWeekTask = { id: string; week: string; text: string; memo?: string; done?: boolean };
export type PlannerData = { message: string; events: PlannerEvent[]; todos: PlannerTodo[]; routines?: PlannerRoutine[]; week_tasks?: PlannerWeekTask[] };
// 받은 인수인계서 적용하기(POST /api/handovers/received/{id}/calendar)
export type HandoverCalendarResult = { message: string; events: number; routines: number; skipped: number };
