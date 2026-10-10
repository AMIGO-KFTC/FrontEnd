import { useEffect, useState } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";

export function ProcessingScreen({ onNext }: { onNext: () => void }) {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          return 100;
        }
        return Math.min(current + 5, 100);
      });
    }, 450);
    return () => window.clearInterval(timer);
  }, []);

  const currentFile = progress < 38 ? "플랫폼_운영가이드.pdf" : progress < 72 ? "2025_Q1_백로그.xlsx" : "플랫폼 운영 문서";
  const currentTask = progress < 38 ? "문서의 텍스트와 표를 읽고 있어요" : progress < 72 ? "업무 항목을 분류하고 있어요" : progress < 100 ? "근거와 출처를 연결하고 있어요" : "모든 자료의 분석이 끝났어요";

  return (
    <div className="processing-page">
      <header className="onboarding-header">
        <Brand />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span />
          <span />
          <small>2 / 4</small>
        </div>
      </header>
      <main className="processing-main">
        <div className={`processing-visual ${progress === 100 ? "complete" : ""}`}>
          <div className="processing-core"><Icon name={progress === 100 ? "check" : "sparkle"} size={27} /></div>
          <span className="processing-ring ring-one" />
          <span className="processing-ring ring-two" />
          <i className="processing-particle particle-one" />
          <i className="processing-particle particle-two" />
          <i className="processing-particle particle-three" />
        </div>
        <span className="processing-kicker">{progress === 100 ? "ANALYSIS COMPLETE" : "ANALYZING YOUR FILES"}</span>
        <h1>{progress === 100 ? "자료를 모두 읽었어요" : "AMIGO가 자료를 분석하고 있어요"}</h1>
        <p>{progress === 100 ? "자료 분석을 마쳤어요. 이제 빈틈을 채워볼까요?" : "자료의 양에 따라 잠시 시간이 걸릴 수 있어요. 창을 닫아도 분석은 계속됩니다."}</p>
        <section className="processing-status">
          <div className="processing-status-head"><span>{currentTask}</span><strong>{progress}%</strong></div>
          <div className="processing-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="processing-file">
            <span><Icon name="file" size={16} /></span>
            <div><small>{progress === 100 ? "분석 완료" : "현재 분석 중"}</small><strong>{currentFile}</strong></div>
            {progress === 100 ? <Icon name="check" size={16} /> : <i />}
          </div>
        </section>
        <div className="processing-stats">
          <div><strong>8</strong><span>등록한 자료</span></div>
          <i />
          <div><strong>{Math.min(Math.floor(progress / 13), 8)}</strong><span>분석 완료한 자료</span></div>
        </div>
        <button className="primary-button processing-next" disabled={progress < 100} onClick={onNext}>{progress === 100 ? "질의응답 시작" : "분석 중"} <Icon name="arrow" size={18} /></button>
      </main>
      <footer className="onboarding-footer"><Icon name="shield" size={13} /> 입력한 정보는 안전하게 암호화되어 저장됩니다.</footer>
    </div>
  );
}
