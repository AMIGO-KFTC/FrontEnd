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
}

export interface SessionSummary {
  id: string;
  title: string;
  owner_name: string;
  organization: string;
  position: string;
  mode: HandoverMode;
  task_name: string;
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
  successor: string;
  handover_date: string;
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
  handover_date: string;
  mode: HandoverMode;
  task_name: string;
}

// 로그인(BackEnd /api/auth). 세션 쿠키(amigo_session)는 서버가 내려 주고 브라우저가 알아서 보낸다.
export interface AuthUser {
  id: number;
  login_id: string;
  name: string;
  email: string;
  is_admin: boolean; // 관리자 권한(관리자 페이지)
  profile: { department: string; position: string; team: string; name: string } | null;
}

// 마이페이지(BackEnd /api/me)
export interface MyPage {
  message: string;
  user: AuthUser;
  created_at: string;
  last_login_at: string | null;
  password_changed_at: string | null;
  stats: { unit_tasks: number; documents: number; document_versions: number };
}

export interface MyInfoUpdate {
  name?: string;
  department?: string;
  team?: string;
  position?: string;
  email?: string;
}

// 내가 작성한 인수인계서(BackEnd /api/documents)
export interface MyDocument {
  session_id: string;
  task_id: string | null;
  title: string;
  task_name: string;
  stage: string;
  version: number;
  origin: "ai" | "user" | "restore";
  origin_label: string;
  version_count: number;
  updated_at: string;
}

export interface LoginResult {
  message: string;
  name: string;
  user: AuthUser;
  expires_at: string;
}

// 인수인계서 직접 수정·버전 기록(BackEnd /api/sessions/{id}/document)
export type DocumentOrigin = "ai" | "user" | "restore";

export interface HandoverDocument {
  markdown: string;
  version: number;
  origin: DocumentOrigin;
  origin_label: string;
  author_name: string;
  updated_at: string | null;
  version_count: number;
}

export interface DocumentVersionSummary {
  version: number;
  origin: DocumentOrigin;
  origin_label: string;
  ai_version: number;
  based_on: number;
  note: string;
  author_name: string;
  char_count: number;
  is_current: boolean;
  created_at: string;
}

export interface DocumentVersion extends DocumentVersionSummary {
  markdown: string;
}

export interface DocumentSaved {
  success: boolean;
  message: string;
  saved: boolean;
  document: DocumentVersion;
}

// 메일 조회 API(BackEnd /api/mail, 지금은 가상 메일함)
export interface MailAddress {
  name: string;
  email: string;
}

export interface MailSummary {
  id: string;
  folder: "inbox" | "sent";
  subject: string;
  sender: MailAddress;
  to: MailAddress[];
  sent_at: string;
  snippet: string;
  has_attachments: boolean;
  attachment_count: number;
  important: boolean;
  relevance: number;
  recommended: boolean;
  imported: boolean;
}

export interface MailList {
  message: string;
  provider: string;
  mailbox: MailAddress;
  messages: MailSummary[];
  total: number;
  page: number;
  size: number;
  has_next: boolean;
  keywords: string[];
}

export interface MailImportResult {
  success: boolean;
  message: string;
  session_id: string;
  files: Source[];
  skipped: string[];
  analysis_scheduled: boolean;
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

// 관리자: 팀 인수인계 현황(BackEnd /api/admin/teams, /teams/report, /members/{id}/report)
export interface TeamInfo {
  department: string;
  team: string;
  label: string;
  member_count: number;
  task_count: number;
  document_count: number;
  completion_rate: number | null;
}

export interface MemberPerformance {
  user_id: number;
  login_id: string;
  name: string;
  position: string;
  is_admin: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  task_count: number;
  document_count: number;
  completion_rate: number | null;
  stages: { preparing: number; analyzing: number; answering: number; completed: number };
  source_count: number;
  answer_count: number;
  questions_answered: number;
  questions_skipped: number;
  questions_open: number;
  answer_rate: number | null;
  coverage_rate: number | null;
  ai_versions: number;
  user_versions: number;
  avg_hours_to_first_document: number | null;
  cost_usd: number;
}

export interface TeamReport {
  message: string;
  department: string;
  team: string;
  label: string;
  summary: {
    member_count: number;
    active_member_count: number;
    task_count: number;
    document_count: number;
    completion_rate: number | null;
    answer_rate: number | null;
    coverage_rate: number | null;
    avg_hours_to_first_document: number | null;
    user_versions: number;
    cost_usd: number;
  };
  members: MemberPerformance[];
}

export interface MemberTask {
  task_id: string;
  session_id: string;
  name: string;
  stage: string;
  stage_group: "preparing" | "analyzing" | "answering" | "completed";
  status: string;
  document_version: number;
  has_document: boolean;
  source_count: number;
  answer_count: number;
  questions_answered: number;
  questions_skipped: number;
  questions_open: number;
  coverage_rate: number | null;
  ai_versions: number;
  user_versions: number;
  hours_to_first_document: number | null;
  created_at: string;
  last_activity_at: string | null;
}

export interface MemberActivity {
  kind: string;
  label: string;
  at: string | null;
  task_id: string;
  task_name: string;
  detail: string;
}

export interface MemberReport {
  member: MemberPerformance;
  department: string;
  team: string;
  tasks: MemberTask[];
  activity: MemberActivity[];
}
