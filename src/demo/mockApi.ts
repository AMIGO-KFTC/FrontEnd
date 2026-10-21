// 설치 없이 브라우저에서 화면을 둘러보기 위한 예시 API.
// BackEnd 의 가상 응답 모드(AMIGO_MOCK_MODE)를 한 번 끝까지 실행해 저장한 응답(rec.json)을 순서대로 재생한다.
// 서버·네트워크 없이 이 파일만으로 로그인 → 자료 등록 → 분석 → 질의응답 → 인수인계서 화면이 모두 동작한다.
import rec from "./rec.json";
import type { AppConfig, AuthUser, ChatMessage, LoginResult, SessionCreate, SessionDetail, SessionSummary, Source, UsageTotal } from "../shared/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const R = rec as any;
const ANALYZE_TICK_MS = 650;
const COMPOSE_MS = 2600;

type Phase = "setup" | "analyzing" | "qna" | "composing" | "review";

let loggedIn = false;
let created: SessionDetail | null = null;
let sources: Source[] = [];
let phase: Phase = "setup";
let phaseStart = 0;
let step = 0; // 질의응답에서 지금까지 보낸 답변 수
const typed = new Map<number, string>(); // 녹화된 사용자 메시지 ID → 사용자가 실제로 입력한 문장
let extra: ChatMessage[] = [];
let nextExtraId = 1000;
let docMarkdown: string = R.document.markdown;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

function analyzingSnapshot(): any {
  const [first, last] = R.analyzing as any[];
  const total = first.session.progress.total || 6;
  const index = Math.floor((Date.now() - phaseStart) / ANALYZE_TICK_MS);
  if (index >= total) return last;
  const snap = clone(first);
  snap.session.progress.current = index;
  return snap;
}

function qnaSnapshot(): any {
  return step === 0 ? R.state_after_analysis : R.chats[Math.min(step, R.chats.length) - 1].state;
}

function composingSnapshot(): any {
  const snap = clone(R.chats[R.chats.length - 1].state);
  snap.session.stage = "composing";
  snap.session.status = "running";
  snap.session.document_version = 0;
  snap.session.progress = { message: "근거를 모아 인수인계서를 작성하고 있어요", current: Math.min(4, Math.floor((Date.now() - phaseStart) / 650)), total: 5 };
  return snap;
}

function currentSnapshot(): any {
  if (phase === "analyzing") {
    const snap = analyzingSnapshot();
    if (snap === R.analyzing[1]) phase = "qna";
    return phase === "qna" ? qnaSnapshot() : snap;
  }
  if (phase === "composing") {
    if (Date.now() - phaseStart >= COMPOSE_MS) {
      phase = "review";
      return R.final_state;
    }
    return composingSnapshot();
  }
  if (phase === "review") return R.final_state;
  if (phase === "qna") return qnaSnapshot();
  return { session: created ?? R.create, messages: R.state_upload.messages };
}

function build(after: number) {
  const snap = clone(currentSnapshot());
  const session: SessionDetail = snap.session;
  if (created) {
    Object.assign(session, {
      id: created.id, title: created.title, owner_name: created.owner_name, organization: created.organization,
      position: created.position, mode: created.mode, task_name: created.task_name, duties: created.duties, handover_date: created.handover_date,
    });
  }
  session.sources = sources;
  const messages: ChatMessage[] = snap.messages
    .map((m: ChatMessage) => (typed.has(m.id) ? { ...m, content: typed.get(m.id) as string } : m))
    .concat(extra)
    .filter((m: ChatMessage) => m.id > after);
  session.last_message_id = Math.max(session.last_message_id ?? 0, ...snap.messages.map((m: ChatMessage) => m.id), ...extra.map((m) => m.id));
  return { session, messages, usage_total: usage() };
}

function usage(): UsageTotal {
  return { requests: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0, sessions: 1, budget_usd: 0, remaining_usd: null };
}

function makeSource(file: File | { name: string; size: number }): Source {
  const name = file.name;
  return {
    id: Math.random().toString(16).slice(2, 14), kind: "file", name, url: "", link_type: "", extension: name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "",
    size: file.size, status: "ready", error: "", chunk_count: 6, warnings: [], added_stage: "setup", created_at: now(),
  };
}

function userMessage(text: string, kind = "answer"): ChatMessage {
  return { id: nextExtraId++, role: "user", kind, content: text, meta: {}, created_at: now() };
}

function advance(text: string): ChatMessage {
  if (step < R.chats.length) {
    const recorded = R.chats[step].resp.message as ChatMessage;
    typed.set(recorded.id, text);
    step += 1;
    return { ...recorded, content: text };
  }
  // 녹화된 질문을 모두 소진한 뒤: 문서 만들기를 안내한다.
  const mine = userMessage(text);
  extra = extra.concat(mine, {
    id: nextExtraId++, role: "assistant", kind: "info", meta: {}, created_at: now(),
    content: "예시 화면에 준비된 질문은 여기까지예요. 아래의 인수인계서 생성 버튼을 눌러 완성된 문서를 확인해 보세요.",
  });
  return mine;
}

export const demoApi = {
  async health() { return { status: "ok", engine: "demo", model: null }; },
  async config(): Promise<AppConfig> { await wait(80); return clone(R.config); },

  async login(_id: string, _pw: string): Promise<LoginResult> { await wait(400); loggedIn = true; return clone(R.login); },
  async logout() { loggedIn = false; return { message: "ok" }; },
  async me(): Promise<{ user: AuthUser }> {
    if (!loggedIn) throw new Error("로그인이 필요해요.");
    return clone(R.me);
  },

  async listSessions(): Promise<SessionSummary[]> { return created ? [created] : []; },
  async createSession(body: SessionCreate): Promise<SessionDetail> {
    await wait(350);
    phase = "setup"; step = 0; sources = []; typed.clear(); extra = []; docMarkdown = R.document.markdown;
    created = { ...clone(R.create), ...body, title: `${body.task_name || "인수인계"} 인수인계`, sources: [] };
    return clone(created as SessionDetail);
  },
  async deleteSession(_id: string) { created = null; },
  async state(_id: string, after: number) { return build(after); },
  async usage() { return usage(); },

  async upload(_id: string, files: File[]): Promise<Source[]> {
    await wait(500);
    const added = files.map(makeSource);
    sources = sources.concat(added);
    return added;
  },
  async addLinks(_id: string, urls: string[], linkType: string): Promise<Source[]> {
    await wait(500);
    const added = urls.map((url) => ({ ...makeSource({ name: url.replace(/^https?:\/\//, ""), size: 0 }), kind: "link" as const, url, link_type: linkType, extension: "" }));
    sources = sources.concat(added);
    return added;
  },
  async deleteSource(_id: string, sourceId: string) { sources = sources.filter((s) => s.id !== sourceId); },

  async analyze(_id: string): Promise<SessionDetail> {
    phase = "analyzing"; phaseStart = Date.now(); step = 0;
    return build(0).session;
  },
  async chat(_id: string, text: string) { await wait(300); return { ok: true, message: advance(text) }; },
  async skip(_id: string) { await wait(300); return { ok: true, message: advance("건너뛰기") }; },
  async generate(_id: string) {
    phase = "composing"; phaseStart = Date.now();
    const recorded = R.generate.message as ChatMessage;
    return { ok: true, message: recorded };
  },
  async retry(_id: string): Promise<SessionDetail> { return build(0).session; },

  async document(_id: string) { await wait(200); return { markdown: docMarkdown, version: R.document.version }; },
  async editGantt(_id: string, _name: string, _nth: number, _months: number[]) { return { markdown: docMarkdown, version: R.document.version }; },
  downloadUrl(_id: string, _format: "pdf" | "docx" | "md") { return "#"; },
};

export const DEMO = true;
