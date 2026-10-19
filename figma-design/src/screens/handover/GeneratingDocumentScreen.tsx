import { useEffect, useState } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import LeaveSeasideBackground from "@/components/LeaveSeasideBackground";
import StepUserMenu from "@/components/StepUserMenu";
import { type HandoverVariant } from "@/screens/handover/types";

export default function GeneratingDocumentScreen({ onComplete, onLogout, onHome, variant }: { onComplete: () => void; onLogout: () => void; onHome: () => void; variant: HandoverVariant }) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(current + 4, 100));
    }, 180);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress < 100) return;
    const timer = window.setTimeout(onComplete, 900);
    return () => window.clearTimeout(timer);
  }, [progress, onComplete]);

  const steps = [
    { label: "등록 자료와 답변 정리", threshold: 25 },
    { label: "인수인계 항목과 목차 구성", threshold: 58 },
    { label: "근거 자료와 출처 연결", threshold: 88 },
  ];

  return (
    <div className={`generation-page ${variant === "leave" ? "leave-theme" : ""}`}>
      {variant === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand />
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
        <div className={`generation-visual ${progress === 100 ? "complete" : ""}`}>
          <span className="generation-sheet sheet-back" />
          <span className="generation-sheet sheet-middle" />
          <span className="generation-sheet sheet-front">
            <Icon name={progress === 100 ? "check" : "file"} size={27} />
            <i /><i /><i />
          </span>
          <span className="generation-spark"><Icon name="sparkle" size={17} /></span>
        </div>
        <span className="generation-kicker">{progress === 100 ? "DOCUMENT READY" : "GENERATING HANDOVER"}</span>
        <h1>{progress === 100 ? "인수인계서가 완성됐어요" : "인수인계서를 생성하고 있어요"}</h1>
        <p>{progress === 100 ? "완성된 문서 화면으로 이동합니다." : "등록한 자료와 답변을 바탕으로 바로 활용할 수 있는 문서를 구성하고 있어요."}</p>
        <section className="generation-progress-card">
          <div className="generation-progress-head"><strong>{progress === 100 ? "문서 생성 완료" : "AMIGO가 문서를 작성 중이에요"}</strong><span>{progress}%</span></div>
          <div className="generation-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="generation-step-list">
            {steps.map((step) => {
              const done = progress >= step.threshold;
              const active = !done && progress >= step.threshold - 32;
              return (
                <div className={done ? "done" : active ? "active" : ""} key={step.label}>
                  <span>{done ? <Icon name="check" size={13} /> : active ? <i /> : null}</span>
                  <strong>{step.label}</strong>
                  <small>{done ? "완료" : active ? "진행 중" : "대기"}</small>
                </div>
              );
            })}
          </div>
        </section>
        <div className="generation-note"><Icon name="shield" size={13} /> 생성 중에는 창을 닫지 않아도 자동으로 다음 화면으로 이동해요.</div>
      </main>
    </div>
  );
}
