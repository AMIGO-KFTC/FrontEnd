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
  profile: { department: string; position: string; team: string; name: string } | null;
}

export interface LoginResult {
  message: string;
  name: string;
  user: AuthUser;
  expires_at: string;
}

// 내 작업 목록(BackEnd /api/conversations): 각 작업이 어디까지 진행됐는지
export interface ConversationProgress {
  session_id: string;
  title: string;
  stage: Stage;
  stage_number: number;
  stage_label: string;
  status: Status;
  next_action: string;
  next_action_label: string;
  document_version: number;
  last_activity_at: string;
}

// 인수인계서 본문의 근거 번호([1], [2] …)별 원문(BackEnd /api/sessions/{id}/citations)
export interface CitationDetail {
  number: number;
  label: string; // 사람이 읽는 출처 표기. 예: 업무정의서.pdf p.3
  quote: string; // 근거로 쓴 문장 일부
  kind: "document" | "answer"; // 올린 자료 / 인계자 답변
  source_id: string;
  source_name: string;
  chunk_id: string;
  text: string; // 근거가 나온 조각 원문(Markdown)
  slot: string;
  item_title: string;
}

// 내 프로필(BackEnd /api/profile): 처음 한 번 저장해 두면 다음 인수인계 때 기본 정보를 미리 채운다
export interface UserProfile {
  department: string;
  team: string;
  position: string;
  name: string;
}
