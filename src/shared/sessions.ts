// 서버 세션 목록(GET /api/sessions)을 홈 화면에서 쓰기 위한 분류·표시 도우미.
import type { HandoverMode, SessionSummary, Stage, Status } from "./types";

// 세션 요약·받은 인수인계·관리자 목록이 공통으로 가진 진행 정보
export type StageInfo = { stage: Stage; document_version: number };

// 분류 기준: 문서가 한 번이라도 만들어졌으면(document_version > 0) "완성 문서", 아니면 "진행 중".
// 서버에는 "완료" 표시가 따로 없고, 문서가 있는 작업은 문서 화면에서 바로 열어 보거나 고칠 수 있다.
export function hasDocument(session: StageInfo): boolean {
  return session.document_version > 0;
}

const byUpdated = (a: SessionSummary, b: SessionSummary) => Date.parse(b.updated_at) - Date.parse(a.updated_at);

export function ongoingSessions(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.filter((session) => !hasDocument(session)).sort(byUpdated);
}

export function completedSessions(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.filter(hasDocument).sort(byUpdated);
}

export function recentSessions(sessions: SessionSummary[], count: number): SessionSummary[] {
  return [...sessions].sort(byUpdated).slice(0, count);
}

export const STAGE_LABEL: Record<Stage, string> = {
  setup: "자료 등록",
  analyzing: "자료 분석",
  summary: "분석 요약",
  qna: "질의응답",
  composing: "문서 생성",
  review: "문서 검토",
};

// 단계별 진행률(디자인의 단계 값). 서버는 진행률을 따로 주지 않는다.
const STAGE_PROGRESS: Record<Stage, number> = { setup: 25, analyzing: 38, summary: 50, qna: 60, composing: 85, review: 95 };

export function sessionProgress(session: StageInfo): number {
  return hasDocument(session) ? 100 : STAGE_PROGRESS[session.stage];
}

// 관리자 화면의 굵은 단계 구분(자료 분석 → 질의응답 → 문서 생성 → 완료)
export type BroadStage = "자료 분석" | "질의응답" | "문서 생성" | "완료";
export const BROAD_STAGES: BroadStage[] = ["자료 분석", "질의응답", "문서 생성", "완료"];

export function broadStage(session: StageInfo): BroadStage {
  if (hasDocument(session)) return "완료";
  if (session.stage === "setup" || session.stage === "analyzing") return "자료 분석";
  if (session.stage === "composing" || session.stage === "review") return "문서 생성";
  return "질의응답";
}

export const STATUS_LABEL: Record<Status, string> = { idle: "대기 중", running: "AI 처리 중", waiting: "답변 기다리는 중", error: "오류" };

export const MODE_LABEL: Record<HandoverMode, string> = { reassignment: "인사발령", leave: "장기휴가" };

export function sessionTitle(session: SessionSummary): string {
  if (session.title) return session.title;
  return session.task_name ? `${session.task_name} 인수인계` : "새 인수인계";
}

// 카드 색은 세션 ID 로 정해 같은 작업이 늘 같은 색으로 보이게 한다.
export function sessionTone(id: string): "violet" | "coral" | "blue" {
  const tones = ["violet", "coral", "blue"] as const;
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

// "2026-10-19T03:10:00" → "2026. 10. 19"
export function formatDate(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value || "미정";
  const date = new Date(time);
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function formatRelativeTime(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  const diff = Date.now() - time;
  if (diff < MINUTE) return "방금 전";
  if (diff < 60 * MINUTE) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / (60 * MINUTE))}시간 전`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  return formatDate(value);
}
