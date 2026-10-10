import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";

export function CompletionScreen({ sourceCount, questionCount, citationCount, onViewDocument, onNew }: { sourceCount: number; questionCount: number; citationCount: number; onViewDocument: () => void; onNew: () => void }) {
  return (
    <div className="completion-page">
      <header className="completion-header"><Brand /></header>
      <main className="completion-main">
        <div className="completion-visual">
          <span><Icon name="check" size={30} /></span>
          <i className="complete-spark spark-one" />
          <i className="complete-spark spark-two" />
          <i className="complete-spark spark-three" />
          <i className="complete-spark spark-four" />
        </div>
        <span className="completion-kicker">HANDOVER COMPLETE</span>
        <h1>인수인계가 완료됐어요.<br />그동안 정말 수고하셨습니다.</h1>
        <p>AMIGO가 정리한 업무의 맥락과 경험이<br />다음 담당자에게 안전하게 이어질 거예요.</p>
        <section className="completion-summary">
          <div><span><Icon name="file" size={18} /></span><strong>{sourceCount}</strong><small>분석한 자료</small></div>
          <i />
          <div><span><Icon name="message" size={18} /></span><strong>{questionCount}</strong><small>완료한 확인</small></div>
          <i />
          <div><span><Icon name="link" size={18} /></span><strong>{citationCount}</strong><small>연결된 출처</small></div>
        </section>
        <div className="completion-actions">
          <button className="secondary-completion" onClick={onViewDocument}><Icon name="file" size={16} /> 완성 문서 다시 보기</button>
          <button className="primary-button new-handover" onClick={onNew}>새 인수인계 시작하기 <Icon name="arrow" size={17} /></button>
        </div>
        <div className="completion-note"><Icon name="sparkle" size={14} /> 문서는 언제든 다시 열어 수정하거나 내려받을 수 있어요.</div>
      </main>
      <footer className="onboarding-footer"><Icon name="shield" size={13} /> 입력한 정보는 안전하게 암호화되어 저장됩니다.</footer>
    </div>
  );
}
