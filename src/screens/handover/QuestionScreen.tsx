// STEP 03 질의응답. 서버가 한 번에 하나씩 묻는 질문(messages 의 question)과 빈 항목 목록(session.gaps)을 새 디자인에 맞춰 보여 준다.
// 왼쪽 목록은 서버가 정한 순서와 상태를 보여 줄 뿐, 다른 질문으로 건너가는 기능은 서버에 없어 넣지 않았다.
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/shared/Brand";
import { PeriodPicker } from "@/screens/handover/PeriodPicker";
import { ErrorNote } from "@/shared/ErrorNote";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { AppConfig, ChatMessage, Gap, HandoverMode, SessionDetail } from "@/shared/types";

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

// 질문 목록 번호. 본 질문은 1, 2, 3 … 으로 매기고, 보조질문은 따로 번호를 먹이지 않고 바로 앞 본 질문에 붙여 4-1, 4-2 로 매긴다.
// 같은 단위 업무(item_id)의 본 질문이 있으면 서버가 낸 순서와 상관없이 그 본 질문 바로 뒤로 모은다.
function numberGaps(gaps: Gap[]): { gap: Gap; label: string }[] {
  // 번호는 실제로 묻는 순서(서버의 질문 목록 순서) 그대로 매긴다: 본 질문은 1, 2, …, 보조질문은 바로 앞 본 질문의 하위 번호(1-1, 1-2).
  // (보조질문을 같은 업무의 첫 본 질문 밑으로 끌어오면 1 → 2 → 1-1 처럼 번호와 묻는 순서가 어긋난다)
  // 다른 세부업무(항목)로 넘어가면 보조질문이어도 새 번호를 받는다(앞 업무의 질문 밑에 붙지 않게).
  const rows: { gap: Gap; label: string }[] = [];
  const itemOf = (g: Gap) => `${g.slot}|${g.item_id ?? ""}`;
  let main = 0;
  let sub = 0;
  let owner = "";
  for (const g of gaps) {
    if (g.aux && main > 0 && itemOf(g) === owner) rows.push({ gap: g, label: `${main}-${++sub}` });
    else {
      rows.push({ gap: g, label: String(++main) });
      sub = 0;
      owner = itemOf(g);
    }
  }
  return rows;
}

export function QuestionScreen({ mode, session, messages, config, error, busy, onBack, onSend, onSkip, onReopen, onUploadFiles, onRetry, onComplete, onLogout, onHome }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answer, setAnswer] = useState("");
  const [uploading, setUploading] = useState(false); // 대화 중 자료를 서버에 올리는 동안
  const [uploadedCount, setUploadedCount] = useState(0); // 방금 올린 자료 수(안내를 잠깐 보여 주는 데 쓴다)
  // 목록에서 눌러 '보기'만 하는 질문. 서버 상태는 바꾸지 않고 그 질문의 마지막 대화를 보여 준다('다시 답하기'를 눌러야 다시 묻는다).
  const [viewing, setViewing] = useState<string | null>(null);
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
  const currentThread = asking ? messages.filter((m) => m.id > asking.id && m.kind !== "error") : [];
  const viewGap = viewing ? session.gaps.find((g) => g.id === viewing) ?? null : null;
  // 보고 있는 질문의 마지막 질문 메시지와 그 뒤 다음 질문 전까지의 대화(답변·확인)
  const viewAsked = viewGap ? messages.filter((m) => m.role === "assistant" && m.kind === "question" && m.meta.gap_id === viewGap.id).at(-1) : undefined;
  const viewNext = viewAsked ? messages.find((m) => m.id > viewAsked.id && m.role === "assistant" && m.kind === "question") : undefined;
  const viewThread = viewAsked ? messages.filter((m) => m.id > viewAsked.id && (!viewNext || m.id < viewNext.id) && m.kind !== "error") : [];
  const thread = viewGap ? viewThread : currentThread;
  const headline = viewGap
    ? plain(viewGap.question || viewGap.description)
    : asking ? plain(asking.content).replace(/^\[선택 질문\]\s*/, "") : lastAssistant && lastAssistant.kind !== "summary" ? plain(lastAssistant.content) : "";
  const gap = viewGap ?? session.gaps.find((g) => g.id === asking?.meta.gap_id);
  const category = viewGap ? slotTitle(viewGap.slot) : asking ? slotTitle(asking.meta.slot) : "";
  // 이 질문이 어떤 세부업무(항목)에 대한 것인지(예: 정기업무 · 월간 실적 보고). 항목이 없는 질문은 장 이름만 보인다.
  const itemName = gap?.slot && gap.item_id ? session.slots[gap.slot]?.items.find((item) => item.id === gap.item_id)?.title ?? "" : "";
  // 새 질문이 오면 보기를 닫고 지금 질문으로 돌아온다
  useEffect(() => setViewing(null), [asking?.id]);
  // "네, 맞아요" 는 정리한 내용이 맞는지 묻는 문장에만 보인다(예/아니요로 답할 수 없는 추가 질문에는 붙이지 않는다)
  const asksConfirmation = /맞(나요|을까요|습니까|죠|는지|으면|다면|으신가요)|확인해 주|확인 부탁|맞아요\?/.test(lastAssistant?.content ?? "");
  const suggestions = (lastAssistant?.meta.quick_replies ?? []).filter((q) => !q.includes("건너뛰기") && !q.includes("문서 생성") && !q.startsWith("수정") && (!q.startsWith("네, 맞") || asksConfirmation));
  // 지금 질문이 아직 답을 기다리는 상태(그 뒤에 확인 요청 등이 없을 때)에만 예/아니요·주기 선택을 보여 준다
  const awaiting = !viewGap && asking && lastAssistant?.id === asking.id ? asking.meta : null;
  const yesNo = awaiting?.choice === "yesno";
  const aux = viewGap ? Boolean(viewGap.aux) : Boolean(asking?.meta.aux);
  const numbered = numberGaps(session.gaps);
  const auxLabel = numbered.find((row) => row.gap.id === gap?.id)?.label; // 지금 보는 보조질문 번호(예: 4-1)
  const auxNote = asking?.meta.aux_note || "해당 사항이 없으실 경우 '이 질문 건너뛰기'를 클릭하여 넘어가세요.";
  const askedCount = Math.max(session.question_count, session.gaps.filter((g) => g.status !== "open").length);
  const total = askedCount + session.open_gap_count;
  const isLast = session.open_gap_count === 0;

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
            <div><strong>확인할 질문</strong></div>
            <em>{Math.min(askedCount, total)} / {total}</em>
          </div>
          <div className="question-list-progress"><span style={{ width: `${total ? (askedCount / total) * 100 : 0}%` }} /></div>
          <div className="question-list-items" role="list">
            {session.gaps.length === 0 && <div className="question-list-empty">{session.stage === "qna" ? "확인할 빈 항목이 없어요.\n바로 문서를 만들 수 있어요." : "AMIGO가 빈 항목을 정리하고 있어요."}</div>}
            {numbered.map(({ gap: item, label }) => {
              const state = gapState(item, inReview);
              // 지금 묻는 질문이 아니면 눌러서 그 질문으로 이동한다(답한·건너뛴 질문은 다시 답하기, 아직 안 물은 질문은 먼저 답하기).
              // 문서 검토 중에 고르면 답한 뒤 인수인계서를 다시 만든다.
              const canJump = !waiting && (inQna || inReview) && state !== "active";
              const jump = () => canJump && onReopen(item.id);
              // 항목을 누르면 '보기'만 한다(마지막 답변 기록이 그대로 보인다). 지금 질문을 누르면 보기를 닫는다.
              const view = () => setViewing(state === "active" || viewing === item.id ? null : item.id);
              return (
                <div
                  className={`question-list-item ${state}${item.status === "skipped" && !item.aux ? " unmet" : ""} jumpable${item.aux ? " aux" : ""}${viewing === item.id ? " viewing" : ""}`}
                  role="listitem"
                  key={item.id}
                  title="눌러서 이 질문과 지난 답변을 봅니다"
                  tabIndex={0}
                  onClick={view}
                  onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), view())}
                >
                  <span>{state === "done" ? <Icon name={item.status === "skipped" ? "close" : "check"} size={13} /> : label}</span>
                  {/* 장 이름은 쓰지 않는다. 건너뛴(답이 없어 아직 채워지지 않은) 질문만 표시하고 주황색으로 구분한다 */}
                  <div>{item.status === "skipped" && <small>건너뜀</small>}<strong>{plain(item.question)}</strong></div>
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
          <div className="question-scroll-area" ref={scrollRef}>
            <section className="amigo-question-card">
              <div className="question-card-top">
                <span className="question-ai"><Icon name="sparkle" size={16} /></span>
                <div><strong>AMIGO</strong><small>{viewGap ? (viewThread.length ? "지난 질문과 답변이에요" : "아직 답하지 않은 질문이에요") : "3단계 질의응답 · 빈틈을 함께 채워요"}</small></div>
                {category && <em title={itemName ? `${category} · ${itemName}` : category}>{itemName ? `${category} · ${itemName}` : category}</em>}
              </div>
              <h2 style={{ whiteSpace: "pre-line" }}>
                {aux && headline && <span className="question-aux-tag">선택 질문{auxLabel ? ` ${auxLabel}` : ""}</span>}
                {headline || (failed ? "처리 중 문제가 생겨 멈췄어요" : "AMIGO가 다음 질문을 준비하고 있어요")}
              </h2>
              {aux && headline ? <p className="question-aux-note">{auxNote}</p> : <p>{gap?.description ?? ""}</p>}
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
            {awaiting?.picker === "period" ? (
              <PeriodPicker choices={awaiting.choices ?? []} disabled={waiting} onPick={(value) => submitAnswer(value)} />
            ) : (
              <div className={`answer-suggestions${yesNo ? " yes-no" : ""}`}>
                {!viewGap && suggestions.map((suggestion) => <button key={suggestion} disabled={waiting} onClick={() => submitAnswer(suggestion)}>{suggestion}</button>)}
              </div>
            )}
          </div>
          <ErrorNote message={error ?? (failed ? session.error || "AI 처리 중 문제가 생겼어요. 다시 시도해 주세요." : null)} />
          {viewGap ? (
            // 보기 중: 답 입력 대신 '다시 답하기'(서버에서 다시 묻고 답을 고침) · '현재 질문으로' 만 둔다
            <div className="question-view-actions">
              <button type="button" className="answer-cancel" onClick={() => setViewing(null)}>현재 질문으로 돌아가기</button>
              <button
                type="button"
                className="answer-send"
                disabled={waiting || !(inQna || inReview)}
                onClick={() => { const id = viewGap.id; setViewing(null); onReopen(id); }}
              >
                {viewGap.status === "open" || viewGap.status === "asked" ? "이 질문에 답하기" : "다시 답하기"} <Icon name="arrow" size={17} />
              </button>
            </div>
          ) : (
          <>
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
              placeholder={failed ? "오류를 해결한 뒤 다시 시도해 주세요" : yesNo ? "예/아니요를 고르거나, 있으면 내용까지 바로 적어 주세요" : inQna ? "답변을 입력해 주세요" : "문서에 반영할 보충·수정 내용을 입력해 주세요"}
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
          </>
          )}
        </section>
        <div className="question-page-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" disabled={busy || session.status === "running"} onClick={onComplete}>{isLast ? "인수인계서 생성하기" : "지금까지 내용으로 생성하기"} <Icon name="arrow" size={18} /></button>
        </div>
      </main>
    </div>
  );
}
