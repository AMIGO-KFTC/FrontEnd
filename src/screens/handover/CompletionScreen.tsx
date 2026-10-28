import { useState } from "react";
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import type { HandoverMode } from "@/shared/types";
import { TransferDialog } from "./TransferDialog";

type Props = { mode: HandoverMode; sessionId: string; selfLoginId: string; sourceCount: number; questionCount: number; citationCount: number; onViewDocument: () => void; onNew: () => void; onHome: () => void };

// 완료 화면. 완성 문서 화면과 같은 '인수자에게 전송하기'(TransferDialog)를 여기서도 바로 열 수 있다.
export function CompletionScreen({ mode, sessionId, selfLoginId, sourceCount, questionCount, citationCount, onViewDocument, onNew, onHome }: Props) {
  const [transferOpen, setTransferOpen] = useState(false);
  return (
    <div className={`completion-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="completion-header"><Brand onClick={onHome} /></header>
      <main className="completion-main">
        <div className="completion-visual">
          <span><Icon name="check" size={30} /></span>
          <i className="complete-spark spark-one" />
          <i className="complete-spark spark-two" />
          <i className="complete-spark spark-three" />
          <i className="complete-spark spark-four" />
        </div>
        {mode === "leave" ? (
          <>
            <h1>인수인계가 완료됐어요.<br />휴가 잘 다녀오세요~</h1>
            <p>AMIGO가 정리한 업무의 맥락이<br />자리를 비운 동안에도 업무가 안전하게 이어지도록 도와줄 거예요.</p>
          </>
        ) : (
          <>
            <h1>인수인계가 완료됐어요.<br />그동안 정말 수고하셨습니다.</h1>
            <p>AMIGO가 정리한 업무의 맥락과 경험이<br />다음 담당자에게 안전하게 이어질 거예요.</p>
          </>
        )}
        <section className="completion-summary">
          <div><span><Icon name="file" size={18} /></span><strong>{sourceCount}</strong><small>분석한 자료</small></div>
          <i />
          <div><span><Icon name="message" size={18} /></span><strong>{questionCount}</strong><small>진행한 확인 질문</small></div>
          <i />
          <div><span><Icon name="link" size={18} /></span><strong>{citationCount}</strong><small>연결된 출처</small></div>
        </section>
        <button className="completion-transfer" onClick={() => setTransferOpen(true)}><Icon name="send" size={17} /> 인수자에게 전송하기</button>
        <div className="completion-actions">
          <button className="secondary-completion" onClick={onViewDocument}><Icon name="file" size={16} /> 완성 문서 다시 보기</button>
          <button className="secondary-completion" onClick={onHome}><Icon name="home" size={16} /> 홈으로 돌아가기</button>
          <button className="primary-button new-handover" onClick={onNew}>새 인수인계 시작하기 <Icon name="arrow" size={17} /></button>
        </div>
        <div className="completion-note"><Icon name="sparkle" size={14} /> 문서는 언제든 다시 열어 수정하거나 내려받을 수 있어요.</div>
      </main>
      {transferOpen && <TransferDialog sessionId={sessionId} selfLoginId={selfLoginId} onClose={() => setTransferOpen(false)} />}
    </div>
  );
}
