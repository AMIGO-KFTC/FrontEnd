// AI 와 핑퐁 대화를 나누는 메신저 형태의 화면
import { AlertTriangle, FileCheck2, Paperclip, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { ChatMessage, SessionDetail } from "../types";

interface Props {
  session: SessionDetail;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onSkip: () => void;
  onGenerate: () => void;
  onRetry: () => void;
  onUpload: (files: File[]) => void;
  onOpenDocument: () => void;
}

const KIND_LABEL: Record<string, string> = {
  summary: "분석 요약",
  question: "질문",
  confirm: "확인 요청",
  document: "문서 생성",
};

function timeOf(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ session, messages, onSend, onSkip, onGenerate, onRetry, onUpload, onOpenDocument }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = session.status === "running";
  const started = session.stage !== "setup";
  const canType = started && !running;
  const last = messages[messages.length - 1];
  const quickReplies = canType && last?.role === "assistant" ? (last.meta.quick_replies ?? []) : [];

  // 처음 열 때는 즉시, 새 메시지가 오면 부드럽게 맨 아래로
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [messages.length, running]);

  const send = () => {
    const value = text.trim();
    if (!value || !canType) return;
    onSend(value);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const quick = (label: string) => {
    if (label.includes("건너뛰기")) onSkip();
    else if (label.includes("문서 생성")) onGenerate();
    else if (label.startsWith("수정")) inputRef.current?.focus();
    else onSend(label);
  };

  const placeholder = !started
    ? "자료를 등록하고 '분석 시작'을 누르면 대화를 시작해요."
    : running
      ? "AI가 답변을 준비하고 있어요…"
      : session.stage === "review"
        ? "고칠 내용이나 빠진 내용을 알려 주세요. (Enter 전송 · Shift+Enter 줄바꿈)"
        : "답변을 입력하세요. (Enter 전송 · Shift+Enter 줄바꿈)";

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} aria-live="polite">
        {messages.map((m) => {
          if (m.role === "system") {
            return (
              <div key={m.id} className={`notice ${m.kind === "error" ? "error" : ""}`}>
                {m.kind === "error" && <AlertTriangle size={14} />}
                <span>{m.content}</span>
                {m.kind === "error" && m.meta.retry && m === last && (
                  <button className="btn tiny" onClick={onRetry} disabled={running}>
                    <RotateCcw size={12} /> 다시 시도
                  </button>
                )}
              </div>
            );
          }
          if (m.role === "user") {
            return (
              <div key={m.id} className="msg user">
                <div className="bubble">{m.content}</div>
                <time>{timeOf(m.created_at)}</time>
              </div>
            );
          }
          return (
            <div key={m.id} className={`msg assistant msg-${m.kind}`}>
              <span className="avatar" aria-hidden>
                <Sparkles size={16} />
              </span>
              <div className="msg-body">
                <div className="msg-head">
                  <strong>AMIGO</strong>
                  {KIND_LABEL[m.kind] && (
                    <span className={`kind kind-${m.kind}`}>
                      {m.kind === "question" && m.meta.number ? `질문 ${m.meta.number}` : KIND_LABEL[m.kind]}
                    </span>
                  )}
                  <time>{timeOf(m.created_at)}</time>
                </div>
                <div className="bubble markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{m.content}</ReactMarkdown>
                </div>
                {m.kind === "document" && (
                  <button className="btn secondary small" onClick={onOpenDocument}>
                    <FileCheck2 size={14} /> 인수인계서 보기
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {running && (
          <div className="msg assistant typing">
            <span className="avatar" aria-hidden>
              <Sparkles size={16} />
            </span>
            <div className="msg-body">
              <div className="bubble">
                <span className="dots" aria-label="AI가 입력 중">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="muted small">{session.progress.message || "생각하고 있어요"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {quickReplies.length > 0 && (
        <div className="quick-replies" aria-label="빠른 답장">
          {quickReplies.map((q) => (
            <button key={q} className="chip-btn" onClick={() => quick(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className={`composer ${canType ? "" : "disabled"}`}>
        <button
          className="icon-btn"
          onClick={() => fileRef.current?.click()}
          disabled={!canType}
          aria-label="자료 첨부"
          title="관련 자료 첨부(분석에 바로 반영)"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onUpload(files);
            e.target.value = "";
          }}
        />
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          placeholder={placeholder}
          disabled={!canType}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="메시지 입력"
        />
        <button className="btn primary send" onClick={send} disabled={!canType || !text.trim()} aria-label="보내기">
          <SendHorizontal size={18} />
        </button>
      </div>
      {started && session.stage === "qna" && (
        <div className="composer-actions">
          <button className="link-btn" onClick={onSkip} disabled={!canType}>
            이 질문 건너뛰기
          </button>
          <button className="link-btn" onClick={onGenerate} disabled={!canType}>
            지금까지 내용으로 문서 생성
          </button>
        </div>
      )}
    </div>
  );
}
