import { useState } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import LeaveSeasideBackground from "@/components/LeaveSeasideBackground";
import StepUserMenu from "@/components/StepUserMenu";
import { firstAnswerReply, followUpReply, questions } from "@/screens/handover/questions";
import { type HandoverVariant } from "@/screens/handover/types";
import { useDraftState } from "@/store/AppStore";

export default function QuestionScreen({ onBack, onComplete, onLogout, onHome, variant }: { onBack: () => void; onComplete: () => void; onLogout: () => void; onHome: () => void; variant: HandoverVariant }) {
  const [questionIndex, setQuestionIndex] = useDraftState("questionIndex");
  const [answer, setAnswer] = useState("");
  const [conversations, setConversations] = useDraftState("conversations");
  const [completedQuestions, setCompletedQuestions] = useDraftState("completedQuestions");
  const current = questions[questionIndex];
  const isLast = questionIndex === questions.length - 1;
  const currentConversation = conversations[questionIndex] ?? [];
  const submitAnswer = (value = answer) => {
    const nextAnswer = value.trim();
    if (!nextAnswer) return;
    const aiReply = currentConversation.length === 0
      ? firstAnswerReply
      : followUpReply;
    setConversations((currentItems) => ({
      ...currentItems,
      [questionIndex]: [
        ...(currentItems[questionIndex] ?? []),
        { role: "user", text: nextAnswer },
        { role: "ai", text: aiReply },
      ],
    }));
    setAnswer("");
  };
  const moveToQuestion = (index: number) => {
    setQuestionIndex(index);
    setAnswer("");
  };
  const completeCurrentQuestion = () => {
    setCompletedQuestions((items) => items.includes(questionIndex) ? items : [...items, questionIndex]);
    if (isLast) onComplete();
    else moveToQuestion(questionIndex + 1);
  };
  const skip = () => {
    setConversations((items) => ({
      ...items,
      [questionIndex]: [...(items[questionIndex] ?? []), { role: "ai", text: "이 질문은 건너뛰었어요. 필요하면 왼쪽 목록에서 다시 돌아올 수 있어요." }],
    }));
    setCompletedQuestions((items) => items.includes(questionIndex) ? items : [...items, questionIndex]);
    if (isLast) onComplete();
    else moveToQuestion(questionIndex + 1);
  };

  return (
    <div className={`question-page ${variant === "leave" ? "leave-theme" : ""}`}>
      {variant === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand />
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
            <em>{questionIndex + 1} / {questions.length}</em>
          </div>
          <div className="question-list-progress"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
          <div className="question-list-items">
            {questions.map((question, index) => {
              const state = index === questionIndex ? "active" : completedQuestions.includes(index) ? "done" : "waiting";
              return (
                <button className={`question-list-item ${state}`} key={question.category} onClick={() => moveToQuestion(index)}>
                  <span>{completedQuestions.includes(index) ? <Icon name="check" size={13} /> : index + 1}</span>
                  <div><small>{question.category}</small><strong>{question.text}</strong></div>
                  {state === "active" && <i>현재</i>}
                </button>
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
          <div className="question-scroll-area">
            <div className="question-counter">
              <span>확인 질문</span>
              <strong>{questionIndex + 1} <small>/ {questions.length}</small></strong>
            </div>
            <section className="amigo-question-card">
              <div className="question-card-top">
                <span className="question-ai"><Icon name="sparkle" size={16} /></span>
                <div><strong>AMIGO</strong><small>자료 분석을 바탕으로 질문드려요</small></div>
                <em>{current.category}</em>
              </div>
              <h2>{current.text}</h2>
              <p>{current.hint}</p>
            </section>
            {currentConversation.length > 0 && (
              <div className="question-chat-thread" aria-live="polite">
                {currentConversation.map((message, index) => (
                  <div className={`question-chat-message ${message.role}`} key={`${message.role}-${index}`}>
                    {message.role === "ai" && <span><Icon name="sparkle" size={12} /></span>}
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="answer-suggestions">
              {current.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setAnswer(suggestion)}>{suggestion}</button>)}
            </div>
          </div>
          <section className="answer-compose">
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitAnswer();
                }
              }}
              placeholder="답변을 입력해 주세요"
            />
            <div>
              <button className="answer-attach"><Icon name="paperclip" size={17} /> 자료 첨부</button>
              <button className="answer-send" onClick={() => submitAnswer()}>답변 보내기 <Icon name="arrow" size={17} /></button>
            </div>
          </section>
          <div className="question-complete-row">
            <button className="question-skip" onClick={skip}>이 질문 건너뛰기</button>
            {currentConversation.some((message) => message.role === "user") && (
              <button className="question-complete" onClick={completeCurrentQuestion}>
                {isLast ? "질문 완료하고 문서 생성" : "이 질문 완료하고 다음"} <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
        </section>
        <div className="question-page-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" onClick={onComplete}>인수인계서 생성하기 <Icon name="arrow" size={18} /></button>
        </div>
      </main>
    </div>
  );
}
