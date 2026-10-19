import { useState } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";

export default function LandingScreen({ onBegin, onLogin }: { onBegin: () => void; onLogin: () => void }) {
  const [request, setRequest] = useState("");
  const suggestions = ["플랫폼 운영 업무", "프로젝트 진행 현황", "고객 대응 프로세스"];
  const begin = () => {
    if (request.trim()) onBegin();
  };

  return (
    <main className="amigo-landing">
      <header className="landing-header">
        <Brand />
        <nav>
          <button>AMIGO 소개</button>
          <button>활용 방법</button>
          <button>보안</button>
        </nav>
        <button className="landing-login" onClick={onLogin}>로그인</button>
      </header>
      <section className="landing-hero">
        <div className="landing-aura aura-one" />
        <div className="landing-aura aura-two" />
        <div className="landing-aura aura-three" />
        <div className="landing-copy">
          <div className="landing-label"><span><Icon name="sparkle" size={13} /></span> Ask Me Interactively</div>
          <h1>업무의 맥락을 묻고,<br /><em>다음 사람에게 연결합니다.</em></h1>
          <p>AMIGO는 흩어진 자료를 근거로 이해하고, 대화를 통해 빈틈을 채워<br className="desktop-break" /> 바로 활용할 수 있는 인수인계서를 완성하는 AI 동료입니다.</p>
          <div className="landing-prompt">
            <div className="prompt-label"><Icon name="sparkle" size={15} /><span>AMIGO에게 인수인계를 설명해 주세요</span></div>
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  begin();
                }
              }}
              placeholder="예: 3년간 담당한 B2B 플랫폼 운영 업무를 인계하고 싶어요."
              autoFocus
            />
            <div className="landing-prompt-bottom">
              <div className="landing-tools">
                <button title="자료 첨부"><Icon name="paperclip" size={18} /></button>
                <button><Icon name="folder" size={16} /> 자료 첨부</button>
              </div>
              <button className="landing-submit" onClick={begin} aria-label="AMIGO 시작하기"><Icon name="arrow" size={19} /></button>
            </div>
          </div>
          <div className="prompt-suggestions">
            <span>이렇게 시작해 보세요</span>
            {suggestions.map((suggestion) => <button key={suggestion} onClick={() => setRequest(`${suggestion}를 인계하고 싶어요.`)}>{suggestion}</button>)}
          </div>
        </div>
      </section>
      <footer className="landing-footer">
        <div><Icon name="shield" size={15} /><span>기업 데이터 암호화</span></div>
        <p><strong>Grounding</strong>으로 근거 있게 · <strong>Orchestration</strong>으로 빈틈없이</p>
        <span>AMIGO © 2025</span>
      </footer>
    </main>
  );
}
