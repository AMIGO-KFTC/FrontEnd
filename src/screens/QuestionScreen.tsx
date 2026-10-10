import { useState } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import type { IconName } from "../shared/Icon";

export function QuestionScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const questions = [
    { category: "정기 업무", text: "매주 진행하는 ‘운영 지표 리뷰’에는 누가 참석하고, 결과는 어디에 공유하나요?", hint: "참석자와 공유 채널을 함께 알려주세요.", suggestions: ["플랫폼팀 전원", "관련 부서 리더", "별도 참석자 없음"] },
    { category: "장애 대응", text: "서비스 장애가 발생했을 때 가장 먼저 연락해야 하는 담당자는 누구인가요?", hint: "이름, 역할 또는 연락 채널을 알려주세요.", suggestions: ["팀장에게 보고", "당직 담당자 확인", "운영 채널에 공유"] },
    { category: "시스템 권한", text: "인수자가 미리 신청해야 하는 시스템이나 관리자 권한이 있나요?", hint: "시스템 이름과 신청 방법을 알려주세요.", suggestions: ["Jira 관리자", "AWS 콘솔", "추가 권한 없음"] },
    { category: "진행 중인 업무", text: "현재 진행 중인 업무 중 가장 먼저 확인해야 할 일정이나 이슈는 무엇인가요?", hint: "마감일이나 주의할 점을 함께 알려주세요.", suggestions: ["이번 주 배포", "고객사 요청", "특이사항 없음"] },
  ];
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [expandedCoverage, setExpandedCoverage] = useState<number | null>(null);
  const current = questions[questionIndex];
  const isLast = questionIndex === questions.length - 1;
  const submitAnswer = (value = answer) => {
    const nextAnswer = value.trim();
    if (!nextAnswer) return;
    setHistory((items) => [...items, { question: current.text, answer: nextAnswer }]);
    setAnswer("");
    if (isLast) {
      onComplete();
    } else {
      setQuestionIndex((index) => index + 1);
    }
  };
  const skip = () => {
    setHistory((items) => [...items, { question: current.text, answer: "건너뜀" }]);
    if (isLast) onComplete();
    else setQuestionIndex((index) => index + 1);
  };

  return (
    <div className="question-page">
      <header className="onboarding-header">
        <Brand />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <span />
          <small>3 / 4</small>
        </div>
      </header>
      <main className="question-main">
        <section className="question-conversation">
          <div className="question-intro">
            <span>STEP 03 · 질의응답</span>
            <h1>빈틈을 함께 채워볼게요</h1>
            <p>자료에서 확인하기 어려운 내용만 간단히 여쭤볼게요.</p>
          </div>
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
          <div className="answer-suggestions">
            {current.suggestions.map((suggestion) => <button key={suggestion} onClick={() => setAnswer(suggestion)}>{suggestion}</button>)}
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
              <button className="answer-send" onClick={() => submitAnswer()}>{isLast ? "문서 생성하기" : "답변 보내기"} <Icon name="arrow" size={17} /></button>
            </div>
          </section>
          <button className="question-skip" onClick={skip}>이 질문 건너뛰기</button>
        </section>
        <aside className="question-summary">
          <div className="coverage-head"><strong>항목 충족 현황</strong><span><em>충분 3</em> · <i>부분 1</i> · 부족 1</span></div>
          <div className="coverage-track"><span className="full" /><span className="part" /><span className="empty" /></div>
          <div className="coverage-list">
            {[
              { title: "담당 업무", count: 4, status: "full", label: "충분", icon: "file" as IconName, check: 0 },
              { title: "반복 수행 업무", count: 6, status: "full", label: "충분", icon: "arrow" as IconName, check: 0 },
              { title: "진행 중인 과제", count: 3, status: "full", label: "충분", icon: "check" as IconName, check: 0 },
              { title: "협업 관계", count: 5, status: "part", label: "부분", icon: "user" as IconName, check: 1 },
              { title: "시스템 및 권한", count: 2, status: "lack", label: "부족", icon: "shield" as IconName, check: 2 },
            ].map((item, index) => {
              const expanded = expandedCoverage === index;
              return (
                <div className={`coverage-item ${item.status} ${expanded ? "expanded" : ""}`} key={item.title} onClick={() => setExpandedCoverage(expanded ? null : index)}>
                  <div className="coverage-item-main">
                    <Icon name={item.icon} size={16} />
                    <div><strong>{item.title}</strong><small>항목 {item.count} · 확인 {item.check}</small></div>
                    <span>{item.label}</span>
                    <Icon name="chevron" size={13} />
                  </div>
                  {expanded && <p>{item.check > 0 ? `확인이 필요한 내용이 ${item.check}개 있어요.` : "현재 확인이 필요한 내용이 없어요."}</p>}
                </div>
              );
            })}
          </div>
          <div className="summary-note"><Icon name="sparkle" size={15} /><p><strong>답변은 자동으로 정리돼요</strong><br />편하게 말하듯 작성해 주세요.</p></div>
        </aside>
        <div className="question-page-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" onClick={onComplete}>인수인계서 생성하기 <Icon name="arrow" size={18} /></button>
        </div>
      </main>
      <footer className="onboarding-footer"><Icon name="shield" size={13} /> 입력한 정보는 안전하게 암호화되어 저장됩니다.</footer>
    </div>
  );
}
