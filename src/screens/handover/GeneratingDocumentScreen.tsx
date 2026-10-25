// STEP 04 문서 생성 중. 서버가 composing 단계에서 보내는 진행 문구와 상태로 그린다. 서버가 퍼센트를 주지 않아 바의 퍼센트는 추정치(useEstimatedProgress)다.
// 문서가 만들어지면(document_version 증가, stage=review) App 이 문서 화면으로 넘긴다.
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import { useEstimatedProgress, WorkQuips } from "@/shared/WorkQuips";
import type { HandoverMode, SessionDetail } from "@/shared/types";

type Props = {
  mode: HandoverMode;
  session: SessionDetail;
  targetVersion: number; // 기다리는 문서 버전(처음 생성이면 1, 수정 요청이면 현재 버전 + 1)
  onRetry: () => void;
  onBack: () => void;
  onLogout: () => void;
  onHome: () => void;
};

export function GeneratingDocumentScreen({ mode, session, targetVersion, onRetry, onBack, onLogout, onHome }: Props) {
  const failed = session.status === "error";
  const done = session.document_version >= targetVersion && session.status !== "running";
  const percent = useEstimatedProgress(!failed && !done, done);
  const readySources = session.sources.filter((source) => source.status === "ready").length;
  const steps = [
    { label: `등록 자료 ${readySources}건 정리`, state: "done" as const },
    { label: `확인 질문 ${session.question_count}건 진행`, state: "done" as const },
    { label: `인수인계서 작성 (v${targetVersion})`, state: failed ? ("failed" as const) : done ? ("done" as const) : ("active" as const) },
  ];
  const headline = failed ? "문서를 만들지 못했어요" : done ? "인수인계서가 완성됐어요" : "인수인계서를 생성하고 있어요";
  const progressText = failed ? session.error || "문서를 만드는 중 문제가 생겼어요." : done ? "문서 생성 완료" : session.progress.message || "AMIGO가 문서를 작성 중이에요";

  return (
    <div className={`generation-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand onClick={onHome} />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <small>4 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="generation-main">
        <div className={`generation-visual ${done ? "complete" : ""}`}>
          <span className="generation-sheet sheet-back" />
          <span className="generation-sheet sheet-middle" />
          <span className="generation-sheet sheet-front">
            <Icon name={done ? "check" : failed ? "close" : "file"} size={27} />
            <i /><i /><i />
          </span>
          <span className="generation-spark"><Icon name="sparkle" size={17} /></span>
        </div>
        <h1>{headline}</h1>
        <p>{failed ? "다시 시도하거나 질의응답으로 돌아가 내용을 보완한 뒤 다시 생성할 수 있어요." : done ? "완성된 문서 화면으로 이동합니다." : "등록한 자료와 답변을 바탕으로 바로 활용할 수 있는 문서를 구성하고 있어요."}</p>
        {!failed && !done && <WorkQuips />}
        <section className="generation-progress-card">
          <div className="generation-progress-head"><strong>{progressText}</strong><span>{failed ? "중단" : `${percent}%`}</span></div>
          <div className="generation-track"><span className={done ? "" : failed ? "stopped" : "running"} style={failed ? undefined : { width: `${percent}%` }} /></div>
          <div className="generation-step-list">
            {steps.map((step) => (
              <div className={step.state === "done" ? "done" : step.state === "active" ? "active" : step.state === "failed" ? "failed" : ""} key={step.label}>
                <span>{step.state === "done" ? <Icon name="check" size={13} /> : step.state === "active" ? <i /> : step.state === "failed" ? <Icon name="close" size={13} /> : null}</span>
                <strong>{step.label}</strong>
                <small>{step.state === "done" ? "완료" : step.state === "active" ? "진행 중" : step.state === "failed" ? "실패" : "대기"}</small>
              </div>
            ))}
          </div>
        </section>
        {failed && (
          <div className="generation-actions">
            <ErrorNote message={session.error || "문서를 만드는 중 문제가 생겼어요."} />
            <div>
              <button className="primary-button onboarding-next" onClick={onRetry}>다시 시도 <Icon name="arrow" size={16} /></button>
              <button className="processing-back" onClick={onBack}><Icon name="arrow" size={14} /> 질의응답으로 돌아가기</button>
            </div>
          </div>
        )}
        {!failed && <div className="generation-note"><Icon name="shield" size={13} /> 창을 닫아도 서버에서 계속 작성되며, 홈의 진행 중 목록에서 다시 열면 이어서 볼 수 있어요.</div>}
      </main>
    </div>
  );
}
