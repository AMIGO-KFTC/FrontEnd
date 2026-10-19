import { FormEvent, useEffect, useState } from "react";
import Icon from "@/components/Icon";

export default function SignupScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [securityCard, setSecurityCard] = useState("");
  const [password, setPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!codeRequested || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeRequested, timeLeft]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !id.trim() || !password.trim()) {
      setError("이름, 사번, 비밀번호를 입력해 주세요.");
      return;
    }
    if (!codeRequested) {
      setError("스마트보안카드 인증번호를 요청해 주세요.");
      return;
    }
    if (timeLeft <= 0) {
      setError("인증 시간이 만료되었습니다. 다시 요청해 주세요.");
      return;
    }
    if (!/^\d{6}$/.test(securityCard)) {
      setError("6자리 인증번호를 입력해 주세요.");
      return;
    }
    setCompleted(true);
  };

  return (
    <div className="signup-overlay" role="presentation" onClick={onBack}>
      <section className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-title" onClick={(event) => event.stopPropagation()}>
        <button className="signup-close" type="button" onClick={onBack} aria-label="회원가입 닫기"><Icon name="close" size={18} /></button>
        {completed ? (
          <div className="signup-complete">
            <span><Icon name="check" size={25} /></span>
            <small>WELCOME TO AMIGO</small>
            <h2 id="signup-title">회원가입이 완료되었습니다</h2>
            <p>이제 AMIGO에서 새로운 인수인계를 시작할 수 있어요.</p>
            <button className="primary-button login-button" type="button" onClick={onBack}>로그인 화면으로 이동 <Icon name="arrow" size={17} /></button>
          </div>
        ) : (
          <form className="login-form signup-form" onSubmit={submit}>
            <span className="eyebrow">CREATE YOUR ACCOUNT</span>
            <h2 id="signup-title">AMIGO 시작하기</h2>
            <label>이름
              <div className="input-wrap"><Icon name="user" size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력하세요" autoComplete="name" /></div>
            </label>
            <label>사번
              <div className="input-wrap"><Icon name="user" size={17} /><input value={id} onChange={(event) => setId(event.target.value)} placeholder="사번을 입력하세요" autoComplete="username" /></div>
            </label>
            <label>비밀번호
              <div className="input-wrap"><Icon name="shield" size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력하세요" type="password" autoComplete="new-password" /></div>
            </label>
            <label>스마트보안카드 인증번호
              <div className="security-request-row">
                <div className="input-wrap"><Icon name="key" size={17} /><input value={securityCard} onChange={(event) => setSecurityCard(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6자리 인증번호" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={!codeRequested || timeLeft <= 0} /></div>
                <button
                  type="button"
                  disabled={timeLeft > 0}
                  onClick={() => {
                    setCodeRequested(true);
                    setSecurityCard("");
                    setTimeLeft(30);
                    setError("");
                  }}
                >
                  {timeLeft > 0 ? `${timeLeft}초` : codeRequested ? "재요청" : "요청"}
                </button>
              </div>
            </label>
            {error && <p className="signup-error">{error}</p>}
            <button className="primary-button login-button" type="submit">회원가입 <Icon name="arrow" size={17} /></button>
          </form>
        )}
      </section>
    </div>
  );
}
