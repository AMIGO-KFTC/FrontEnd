import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import { WorkQuips } from "@/shared/WorkQuips";
import type { HandoverMode, SessionDetail } from "@/shared/types";

type Props = { mode: HandoverMode; session: SessionDetail; onNext: () => void; onRetry: () => void; onBack: () => void; onLogout: () => void; onHome: () => void };

export function ProcessingScreen({ mode, session, onNext, onRetry, onBack, onLogout, onHome }: Props) {
  const { stage, status, progress, sources } = session;
  const total = sources.length;
  const finished = stage !== "setup" && stage !== "analyzing" && status !== "running" && status !== "error";
  const ratio = progress.total ? Math.min(progress.current / progress.total, 1) : 0;
  const percent = finished ? 100 : Math.max(5, Math.round(ratio * 100));
  const analyzed = finished ? total : Math.min(Math.floor(ratio * total), total);
  const currentFile = sources[Math.min(analyzed, Math.max(total - 1, 0))]?.name ?? "";
  const currentTask = status === "error" ? session.error || "오류가 발생했어요" : progress.message || "문서의 텍스트와 표를 읽고 있어요";
  const failed = status === "error";
  const progressValue = percent;
  return (
    <div className={`processing-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand onClick={onHome} />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span />
          <span />
          <small>2 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="processing-main">
        <div className={`processing-visual ${finished ? "complete" : ""}`}>
          <div className="processing-core"><Icon name={finished ? "check" : "sparkle"} size={27} /></div>
          <span className="processing-ring ring-one" />
          <span className="processing-ring ring-two" />
          <i className="processing-particle particle-one" />
          <i className="processing-particle particle-two" />
          <i className="processing-particle particle-three" />
        </div>
        <h1>{failed ? "분석을 끝내지 못했어요" : finished ? "자료를 모두 읽었어요" : "AMIGO가 자료를 분석하고 있어요"}</h1>
        <p>{failed ? "분석 중 문제가 생겼어요.\n다시 시도하거나, 자료 등록으로 돌아가 자료를 확인한 뒤 다시 시작할 수 있어요." : finished ? "자료 분석을 마쳤어요.\n이제 빈틈을 채워볼까요?" : "자료의 양에 따라 잠시 시간이 걸릴 수 있어요.\n창을 닫아도 분석은 계속됩니다."}</p>
        {!failed && !finished && <WorkQuips />}
        <section className="processing-status">
          <div className="processing-status-head"><span>{currentTask}</span><strong>{progressValue}%</strong></div>
          <div className="processing-track"><span className={!failed && !finished ? "running" : ""} style={{ width: `${progressValue}%` }} /></div>
          <div className="processing-file">
            <span><Icon name="file" size={16} /></span>
            <div><small>{failed ? "중단된 자료" : finished ? "분석 완료" : "현재 분석 중"}</small><strong>{currentFile}</strong></div>
            {finished ? <Icon name="check" size={16} /> : failed ? <Icon name="close" size={16} /> : <i />}
          </div>
        </section>
        <div className="processing-stats">
          <div><strong>{total}</strong><span>등록한 자료</span></div>
          <i />
          <div><strong>{analyzed}</strong><span>분석 완료한 자료</span></div>
        </div>
        <button className="primary-button processing-next" disabled={!finished && !failed} onClick={failed ? onRetry : onNext}>{failed ? "다시 시도" : finished ? "질의응답 시작" : "분석 중"} <Icon name="arrow" size={18} /></button>
        {failed && <button className="processing-back" onClick={onBack}><Icon name="arrow" size={14} /> 자료를 다시 확인하고 분석 시작하기</button>}
      </main>
    </div>
  );
}
