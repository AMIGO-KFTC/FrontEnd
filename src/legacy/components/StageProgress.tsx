// STAGE 1(분석) ➔ 2(요약) ➔ 3(Q&A) ➔ 4(최종 생성) 진행 상태 표시
import { Check, Loader2 } from "lucide-react";
import type { SessionDetail, Stage } from "../../shared/types";

const STEPS = [
  { n: 1, label: "자료 분석", desc: "문서·메일·링크에서 업무 정보 추출" },
  { n: 2, label: "분석 요약", desc: "항목별 충족 수준 판별" },
  { n: 3, label: "질의응답", desc: "부족한 정보를 하나씩 확인" },
  { n: 4, label: "문서 생성", desc: "근거가 표시된 인수인계서" },
];

const STEP_OF: Record<Stage, number> = { setup: 0, analyzing: 1, summary: 2, qna: 3, composing: 4, review: 4 };

function percent(session: SessionDetail): number {
  const { stage, progress, question_count, open_gap_count } = session;
  if (stage === "setup") return 0;
  if (stage === "analyzing") {
    const ratio = progress.total ? progress.current / progress.total : 0;
    return Math.round(5 + ratio * 20);
  }
  if (stage === "summary") return 30;
  if (stage === "qna") {
    const total = question_count + open_gap_count;
    return Math.round(35 + (total ? question_count / total : 0) * 45);
  }
  if (stage === "composing") return 90;
  return 100;
}

function statusText(session: SessionDetail): string {
  const { stage, status, progress, question_count, open_gap_count, document_version } = session;
  if (status === "error") return session.error || "오류가 발생했습니다.";
  if (status === "running") {
    const counter = stage === "analyzing" && progress.total ? ` (${Math.min(progress.current, progress.total)}/${progress.total})` : "";
    return (progress.message || "AI가 처리하고 있어요") + counter;
  }
  switch (stage) {
    case "setup":
      return "자료를 등록한 뒤 '분석 시작'을 눌러 주세요.";
    case "qna":
      return `질문 ${question_count}개 진행 · 남은 질문 ${open_gap_count}개`;
    case "review":
      return `인수인계서 초안 v${document_version} 완성 · 수정할 내용은 채팅으로 알려 주세요`;
    default:
      return "";
  }
}

export function StageProgress({ session }: { session: SessionDetail }) {
  const current = STEP_OF[session.stage] ?? 0;
  const running = session.status === "running";
  const finished = session.stage === "review";
  const value = percent(session);

  return (
    <section className="stage-card" aria-label="진행 단계">
      <ol className="stepper">
        {STEPS.map((step) => {
          const done = step.n < current || (finished && step.n === 4);
          const active = step.n === current && !done;
          return (
            <li key={step.n} className={`step ${done ? "done" : ""} ${active ? "active" : ""}`} aria-current={active ? "step" : undefined}>
              <span className="step-dot">
                {done ? <Check size={16} strokeWidth={3} /> : active && running ? <Loader2 size={16} className="spin" /> : step.n}
              </span>
              <span className="step-text">
                <span className="step-label">
                  <small>STAGE {step.n}</small> {step.label}
                </span>
                <span className="step-desc">{step.desc}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="stage-status">
        <div className={`progress ${running ? "running" : ""}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${value}%` }} />
        </div>
        <p className={`status-line ${session.status === "error" ? "error" : ""}`}>
          {running && <Loader2 size={14} className="spin" />}
          {statusText(session)}
        </p>
      </div>
    </section>
  );
}
