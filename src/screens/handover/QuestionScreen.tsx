// STEP 03 질의응답. 서버가 한 번에 하나씩 묻는 질문(messages 의 question)과 빈 항목 목록(session.gaps)을 새 디자인에 맞춰 보여 준다.
// 왼쪽 목록은 서버가 정한 순서와 상태를 보여 줄 뿐, 다른 질문으로 건너가는 기능은 서버에 없어 넣지 않았다.
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { AppConfig, ChatMessage, Coverage, Gap, HandoverMode, SessionDetail } from "@/shared/types";

const COVERAGE_LABEL: Record<Coverage, string> = { sufficient: "충분", partial: "부분", missing: "부족" };

type Props = {
  mode: HandoverMode;
  session: SessionDetail;
  messages: ChatMessage[];
  config: AppConfig | null;
  error: string | null;
  busy: boolean; // 보내기·건너뛰기·생성 요청이 서버에 가 있는 동안
  onBack: () => void;
  onSend: (text: string) => void;
  onSkip: () => void;
  onReopen: (gapId: string) => void; // 이미 답한·건너뛴 질문으로 돌아가 다시 답한다
  onUploadFiles: (files: File[]) => void | Promise<void>;
  onRetry: () => void;
  onComplete: () => void;
  onLogout: () => void;
  onHome: () => void;
};

// 질문·확인 문구의 Markdown 강조와 앞머리 "[항목명]"은 화면의 분류 배지가 대신하므로 걷어 낸다.
function plain(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^\[[^\]]+\]\s*/, "").trim();
}

// review(문서 검토) 단계에서는 묻는 중인 질문이 없다(문서를 만들 때 묻던 질문도 '대기'로 보여 준다).
function gapState(gap: Gap, inReview: boolean): "active" | "done" | "waiting" {
  if (gap.status === "asked") return inReview ? "waiting" : "active";
  if (gap.status === "open") return "waiting";
  return "done";
}

export function QuestionScreen({ mode, session, messages, config, error, busy, onBack, onSend, onSkip, onReopen, onUploadFiles, onRetry, onComplete, onLogout, onHome }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState("");
  const [uploading, setUploading] = useState(false); // 대화 중 자료를 서버에 올리는 동안
  const [uploadedCount, setUploadedCount] = useState(0); // 방금 올린 자료 수(안내를 잠깐 보여 주는 데 쓴다)
  const specs = config?.slots ?? [];
  const slotTitle = (key: string | undefined) => specs.find((spec) => spec.key === key)?.title ?? "";
  const failed = session.status === "error";
  // 문서가 만들어진 뒤(review)에도 서버는 답변·검토 의견을 받는다. 그때 질의응답으로 돌아와도 입력이 막히지 않게 한다.
  const inQna = session.stage === "qna";
  const inReview = session.stage === "review";
  const waiting = busy || session.status === "running" || !(inQna || session.stage === "review");

  // 현재 질문 = 마지막 question 메시지. 그 뒤의 답변·확인 요청·안내가 이 질문의 대화 묶음이다.
  const asking = messages.filter((m) => m.role === "assistant" && m.kind === "question").at(-1);
  const lastAssistant = messages.filter((m) => m.role === "assistant").at(-1);
  const thread = asking ? messages.filter((m) => m.id > asking.id && m.kind !== "error") : [];
  const headline = asking ? plain(asking.content) : lastAssistant && lastAssistant.kind !== "summary" ? plain(lastAssistant.content) : "";
  const gap = session.gaps.find((g) => g.id === asking?.meta.gap_id);
  const category = asking ? slotTitle(asking.meta.slot) : "";
  const suggestions = (lastAssistant?.meta.quick_replies ?? []).filter((q) => !q.includes("건너뛰기") && !q.includes("문서 생성") && !q.startsWith("수정"));
  const askedCount = Math.max(session.question_count, session.gaps.filter((g) => g.status !== "open").length);
  const total = askedCount + session.open_gap_count;
  const isLast = session.open_gap_count === 0;

  // 충족 현황은 이 세션의 양식에 있는 장만 센다. 서버 설정(config.slots)에는 인사발령·장기휴가 양식의 장이 모두 들어 있어
  // 그대로 세면 다른 양식의 장이 '부족'으로 잡힌다. 분석 뒤에는 session.slots 에 이 양식의 장만 들어 있다.
  const activeSpecs = specs.filter((spec) => spec.key in session.slots);
  const coverage = (activeSpecs.length ? activeSpecs : specs).map((spec) => session.slots[spec.key]?.coverage ?? "missing");
  const countOf = (value: Coverage) => coverage.filter((c) => c === value).length;
  // 방금 이 대화에서 올린 자료 안내. 질문마다 계속 떠 있으면 방금 올린 건지 헷갈리므로, 올린 직후에만 대화 맨 아래에 보이고
  // 다음 답변을 보내거나 시간이 지나면 사라진다.
  const extraReading = session.sources.some((source) => source.added_stage !== "setup" && (source.status === "pending" || source.status === "processing"));
  const extraNote = uploadedCount ? `올린 자료 ${uploadedCount}건${extraReading ? "을 읽고 있어요" : "이 분석에 반영됐어요"}` : null;

  // 새 메시지가 오면(답변·확인 요청·다음 질문) 대화 영역을 맨 아래로 내려 최신 내용이 보이게 한다.
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, session.status]);

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    try {
      await onUploadFiles(files);
      setUploadedCount(files.length);
    } finally {
      setUploading(false);
    }
  };
  useEffect(() => {
    if (!uploadedCount || extraReading) return;
    const timer = window.setTimeout(() => setUploadedCount(0), 8000); // 다 읽은 뒤 8초 지나면 안내를 걷는다
    return () => window.clearTimeout(timer);
  }, [uploadedCount, extraReading]);

  const submitAnswer = (value = answer) => {
    const nextAnswer = value.trim();
    if (!nextAnswer || waiting) return;
    setAnswer("");
    setUploadedCount(0);
    onSend(nextAnswer);
  };

  return (
    <div className={`question-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand onClick={onHome} />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <span />
          <small>3 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="question-main">
        <aside className="question-list-panel">
          <div className="question-list-head">
            <div><span>QUESTION LIST</span><strong>확인할 질문</strong></div>
            <em>{Math.min(askedCount, total)} / {total}</em>
          </div>
          <div className="question-list-progress"><span style={{ width: `${total ? (askedCount / total) * 100 : 0}%` }} /></div>
          <div className="coverage-head question-coverage">
            <strong>항목 충족 현황</strong>
            <span><em>충분 {countOf("sufficient")}</em> · <i>부분 {countOf("partial")}</i> · 부족 {countOf("missing")}</span>
          </div>
          <div className="coverage-track">
            <span className="full" style={{ width: `${(countOf("sufficient") / Math.max(coverage.length, 1)) * 100}%` }} />
            <span className="part" style={{ width: `${(countOf("partial") / Math.max(coverage.length, 1)) * 100}%` }} />
            <span className="empty" style={{ width: `${(countOf("missing") / Math.max(coverage.length, 1)) * 100}%` }} />
          </div>
          <div className="question-list-items" role="list">
            {session.gaps.length === 0 && <div className="question-list-empty">{session.stage === "qna" ? "확인할 빈 항목이 없어요. 바로 문서를 만들 수 있어요." : "AMIGO가 빈 항목을 정리하고 있어요."}</div>}
            {session.gaps.map((item, index) => {
              const state = gapState(item, inReview);
              // 지금 묻는 질문이 아니면 눌러서 그 질문으로 이동한다(답한·건너뛴 질문은 다시 답하기, 아직 안 물은 질문은 먼저 답하기).
              // 문서 검토 중에 고르면 답한 뒤 인수인계서를 다시 만든다.
              const canJump = !waiting && (inQna || inReview) && state !== "active";
              const jump = () => canJump && onReopen(item.id);
              return (
                <div
                  className={`question-list-item ${state}${canJump ? " jumpable" : ""}`}
                  role="listitem"
                  key={item.id}
                  title={canJump ? "이 질문으로 이동해 답합니다" : `${slotTitle(item.slot)} · ${COVERAGE_LABEL[session.slots[item.slot]?.coverage ?? "missing"]}`}
                  tabIndex={canJump ? 0 : -1}
                  onClick={jump}
                  onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), jump())}
                >
                  <span>{state === "done" ? <Icon name={item.status === "skipped" ? "close" : "check"} size={13} /> : index + 1}</span>
                  <div><small>{slotTitle(item.slot)}{item.status === "skipped" ? " · 건너뜀" : ""}</small><strong>{plain(item.question)}</strong></div>
                  {state === "active" && <i>현재</i>}
                  {state === "done" && (
                    <button type="button" className="question-reopen" disabled={!canJump} onClick={(event) => { event.stopPropagation(); jump(); }} title="이 질문으로 돌아가 답을 고칩니다">
                      {item.status === "skipped" ? "답하러 가기" : "다시 답하기"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="question-list-note"><Icon name="sparkle" size={14} /><p><strong>답변은 자동으로 정리돼요</strong><br />편하게 말하듯 작성해 주세요.</p></div>
        </aside>
        <section className="question-conversation">
          <div className="question-intro">
            <span>STEP 03 · 질의응답</span>
            <h1>빈틈을 함께 채워볼게요</h1>
            <p>자료에서 확인하기 어려운 내용만 간단히 여쭤볼게요.</p>
          </div>
          <div className="question-scroll-area" ref={scrollRef}>
            <div className="question-counter">
              <span>확인 질문</span>
              {total > 0 ? <strong>{Math.min(Math.max(askedCount, 1), total)} <small>/ {total}</small></strong> : <strong>—</strong>}
            </div>
            <section className="amigo-question-card">
              <div className="question-card-top">
                <span className="question-ai"><Icon name="sparkle" size={16} /></span>
                <div><strong>AMIGO</strong><small>자료 분석을 바탕으로 질문드려요</small></div>
                {category && <em>{category}</em>}
              </div>
              <h2 style={{ whiteSpace: "pre-line" }}>{headline || (failed ? "처리 중 문제가 생겨 멈췄어요" : "AMIGO가 다음 질문을 준비하고 있어요")}</h2>
              <p>{gap?.description ?? ""}</p>
            </section>
            {thread.length > 0 && (
              <div className="question-chat-thread" aria-live="polite">
                {thread.map((message) => (
                  <div className={`question-chat-message ${message.role === "user" ? "user" : "ai"}`} key={message.id}>
                    {message.role !== "user" && <span><Icon name="sparkle" size={12} /></span>}
                    <p>{plain(message.content)}</p>
                  </div>
                ))}
              </div>
            )}
            {!failed && (session.status === "running" || (busy && !uploading)) && (
              <div className="question-chat-thread" role="status"><div className="question-chat-message ai"><span><Icon name="sparkle" size={12} /></span><p><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{session.progress.message || "AMIGO가 답변을 정리하고 있어요…"}</p></div></div>
            )}
            {extraNote && !uploading && <ErrorNote message={extraNote} tone="info" />}
            {uploading && (
              <div className="question-chat-thread" role="status"><div className="question-chat-message ai"><span><Icon name="paperclip" size={12} /></span><p><span className="spinner" aria-hidden="true" />자료를 AMIGO에게 보내는 중이에요…</p></div></div>
            )}
            <div className="answer-suggestions">
              {suggestions.map((suggestion) => <button key={suggestion} disabled={waiting} onClick={() => submitAnswer(suggestion)}>{suggestion}</button>)}
            </div>
          </div>
          <ErrorNote message={error ?? (failed ? session.error || "AI 처리 중 문제가 생겼어요. 다시 시도해 주세요." : null)} />
          <section className="answer-compose">
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 보내지 않는다
                  event.preventDefault();
                  submitAnswer();
                }
              }}
              placeholder={failed ? "오류를 해결한 뒤 다시 시도해 주세요" : inQna ? "답변을 입력해 주세요" : "문서에 반영할 보충·수정 내용을 입력해 주세요"}
            />
            <div>
              <input ref={fileRef} type="file" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void uploadFiles(files); event.target.value = ""; }} />
              <button className="answer-attach" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <><span className="spinner" aria-hidden="true" /> 올리는 중…</> : <><Icon name="paperclip" size={17} /> 자료 첨부</>}</button>
              <button className="answer-send" disabled={waiting && !failed} onClick={() => (failed ? onRetry() : submitAnswer())}>{failed ? "다시 시도" : busy ? "보내는 중…" : "답변 보내기"} <Icon name="arrow" size={17} /></button>
            </div>
          </section>
          <div className="question-complete-row">
            <button className="question-skip" disabled={waiting || !inQna} onClick={onSkip}>이 질문 건너뛰기</button>
          </div>
        </section>
        <div className="question-page-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" disabled={busy || session.status === "running"} onClick={onComplete}>{isLast ? "인수인계서 생성하기" : "지금까지 내용으로 생성하기"} <Icon name="arrow" size={18} /></button>
        </div>
      </main>
    </div>
  );
}
