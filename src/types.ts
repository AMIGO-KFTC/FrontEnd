// BackEnd API 응답 타입 (BackEnd/app/schemas.py 와 맞춘다)

export type Stage = "setup" | "analyzing" | "summary" | "qna" | "composing" | "review";
export type Status = "idle" | "running" | "waiting" | "error";
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
  stage: Stage;
  status: Status;
  document_version: number;
  created_at: string;
  updated_at: string;
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
}

export interface AppConfig {
  max_upload_mb: number;
  max_files_per_upload: number;
  allowed_extensions: string[];
  format_labels: Record<string, string>;
  link_types: { key: string; label: string }[];
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
}
