import { useState } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import { ErrorNote } from "../shared/ErrorNote";
import type { IconName } from "../shared/Icon";
import type { AppConfig, ChatMessage, Coverage, SessionDetail } from "../shared/types";

const SLOT_ICON: Record<string, IconName> = { duties: "file", recurring: "arrow", projects: "check", contacts: "user", systems: "shield", issues: "sparkle" };
const COVERAGE_VIEW: Record<Coverage, { status: string; label: string }> = {
  sufficient: { status: "full", label: "충분" },
  partial: { status: "part", label: "부분" },
  missing: { status: "lack", label: "부족" },
};

type Props = {
  session: SessionDetail;
  messages: ChatMessage[];
  config: AppConfig | null;
  error: string | null;
  onBack: () => void;
  onSend: (text: string) => void;
  onSkip: () => void;
  onComplete: () => void;
};

export function QuestionScreen({ session, messages, config, error, onBack, onSend, onSkip, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const [expandedCoverage, setExpandedCoverage] = useState<number | null>(null);
  const specs = config?.slots ?? [];
  const asking = messages.filter((m) => m.role === "assistant" && (m.kind === "question" || m.kind === "confirm")).at(-1);
  const waiting = session.status === "running" || session.stage !== "qna";
  const gap = session.gaps.find((g) => g.id === asking?.meta.gap_id);
  const category = asking?.kind === "confirm" ? "확인 요청" : (specs.find((spec) => spec.key === asking?.meta.slot)?.title ?? "");
  const suggestions = (asking?.meta.quick_replies ?? []).filter((q) => !q.includes("건너뛰기") && !q.includes("문서 생성") && !q.startsWith("수정"));
  // 질문 본문의 Markdown 강조와 앞머리 "[항목명]"은 화면의 분류 배지가 대신하므로 걷어 낸다.
  const questionText = (asking?.content ?? "").replace(/\*\*/g, "").replace(/^\[[^\]]+\]\s*/, "").trim();
  const total = session.question_count + session.open_gap_count;
  const isLast = session.open_gap_count <= 1;
  const submitAnswer = (value = answer) => {
    const nextAnswer = value.trim();
    if (!nextAnswer || waiting) return;
    setAnswer("");
    onSend(nextAnswer);
  };
  const rows = specs.map((spec) => {
    const slot = session.slots[spec.key];
    const view = COVERAGE_VIEW[slot?.coverage ?? "missing"];
    const check = session.gaps.filter((g) => g.slot === spec.key && (g.status === "open" || g.status === "asked")).length;
    return { title: spec.title, count: slot?.items.length ?? 0, status: view.status, label: view.label, icon: SLOT_ICON[spec.key] ?? "file", check };
  });
  const countOf = (status: string) => rows.filter((row) => row.status === status).length;

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
            <strong>{Math.max(session.question_count, 1)} <small>/ {Math.max(total, 1)}</small></strong>
          </div>
          <section className="amigo-question-card">
            <div className="question-card-top">
              <span className="question-ai"><Icon name="sparkle" size={16} /></span>
              <div><strong>AMIGO</strong><small>자료 분석을 바탕으로 질문드려요</small></div>
              <em>{category}</em>
            </div>
            <h2 style={asking?.kind === "confirm" ? { whiteSpace: "pre-line" } : undefined}>{questionText || (waiting ? "AMIGO가 다음 질문을 준비하고 있어요" : "")}</h2>
            <p>{gap?.description ?? ""}</p>
          </section>
          <div className="answer-suggestions">
            {suggestions.map((suggestion) => <button key={suggestion} onClick={() => setAnswer(suggestion)}>{suggestion}</button>)}
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
              <button className="answer-send" disabled={waiting} onClick={() => submitAnswer()}>{isLast ? "문서 생성하기" : "답변 보내기"} <Icon name="arrow" size={17} /></button>
            </div>
          </section>
          <button className="question-skip" disabled={waiting} onClick={onSkip}>이 질문 건너뛰기</button>
        </section>
        <aside className="question-summary">
          <div className="coverage-head"><strong>항목 충족 현황</strong><span><em>충분 {countOf("full")}</em> · <i>부분 {countOf("part")}</i> · 부족 {countOf("lack")}</span></div>
          <div className="coverage-track"><span className="full" style={{ width: `${(countOf("full") / Math.max(rows.length, 1)) * 100}%` }} /><span className="part" style={{ width: `${(countOf("part") / Math.max(rows.length, 1)) * 100}%` }} /><span className="empty" style={{ width: `${(countOf("lack") / Math.max(rows.length, 1)) * 100}%` }} /></div>
          <div className="coverage-list">
            {rows.map((item, index) => {
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
        <ErrorNote message={error} />
        <div className="question-page-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" disabled={session.status === "running"} onClick={onComplete}>인수인계서 생성하기 <Icon name="arrow" size={18} /></button>
        </div>
      </main>
      <footer className="onboarding-footer"><Icon name="shield" size={13} /> 입력한 정보는 안전하게 암호화되어 저장됩니다.</footer>
    </div>
  );
}
