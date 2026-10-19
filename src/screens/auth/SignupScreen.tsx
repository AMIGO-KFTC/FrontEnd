// 회원가입(새 디자인). BackEnd 에 회원가입 API 가 아직 없어 화면만 보여 주고 가입 버튼은 막아 둔다.
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/shared/Icon";
import { PendingNote } from "./PendingNote";

export function SignupScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [securityCard, setSecurityCard] = useState("");
  const [password, setPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!codeRequested || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeRequested, timeLeft]);

  const submit = (event: FormEvent) => {
    event.preventDefault(); // 준비 중: 서버 API 가 생기면 여기서 호출한다
  };

  return (
    <div className="signup-overlay" role="presentation" onClick={onBack}>
      <section className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-title" onClick={(event) => event.stopPropagation()}>
        <button className="signup-close" type="button" onClick={onBack} aria-label="회원가입 닫기"><Icon name="close" size={18} /></button>
        <form className="login-form signup-form" onSubmit={submit}>
          <span className="eyebrow">CREATE YOUR ACCOUNT</span>
          <h2 id="signup-title">AMIGO 시작하기</h2>
          <PendingNote>회원가입은 아직 열리지 않았어요. 계정은 관리자에게 요청해 주세요.</PendingNote>
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
                }}
              >
                {timeLeft > 0 ? `${timeLeft}초` : codeRequested ? "재요청" : "요청"}
              </button>
            </div>
          </label>
          <button className="primary-button login-button" type="submit" disabled>회원가입 (준비 중)</button>
        </form>
      </section>
    </div>
  );
}
