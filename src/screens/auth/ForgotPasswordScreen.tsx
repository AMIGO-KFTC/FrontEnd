// 비밀번호 재설정(새 디자인, 3단계). BackEnd 에 재설정 API 가 아직 없어 화면만 보여 주고 마지막 변경 버튼은 막아 둔다.
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/shared/Icon";
import { PendingNote } from "./PendingNote";

function generateCaptcha() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => characters[Math.floor(Math.random() * characters.length)]).join("");
}

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [id, setId] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [codeRequested, setCodeRequested] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!codeRequested || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeRequested, timeLeft]);

  // 1·2단계는 화면 흐름을 볼 수 있게 넘어가고, 3단계(실제 변경)는 서버 API 가 생길 때까지 막아 둔다.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 1) {
      if (!id.trim()) {
        setError("사번을 입력해 주세요.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!codeRequested) {
        setError("먼저 인증번호를 요청해 주세요.");
        return;
      }
      if (timeLeft <= 0) {
        setError("인증 시간이 만료되었습니다. 다시 요청해 주세요.");
        return;
      }
      if (!/^\d{6}$/.test(securityCode)) {
        setError("6자리 인증번호를 입력해 주세요.");
        return;
      }
      setError("");
      setStep(3);
    }
  };

  return (
    <div className="signup-overlay" role="presentation" onClick={onBack}>
      <section className={`signup-modal recovery-modal step-${step}`} role="dialog" aria-modal="true" aria-labelledby="recovery-title" onClick={(event) => event.stopPropagation()}>
        <button className="signup-close" type="button" onClick={onBack} aria-label="비밀번호 재설정 닫기"><Icon name="close" size={18} /></button>
        <form className={`login-form recovery-form step-${step}`} onSubmit={submit}>
          <span className="eyebrow">{step === 1 ? "RESET YOUR PASSWORD" : step === 2 ? "SECOND VERIFICATION" : "CREATE NEW PASSWORD"}</span>
          <h2 id="recovery-title">{step === 1 ? "비밀번호 재설정" : step === 2 ? "스마트보안카드 인증" : "새 비밀번호 설정"}</h2>
          <PendingNote>비밀번호 재설정은 아직 열리지 않았어요. 관리자에게 초기화를 요청해 주세요.</PendingNote>
          {step === 1 ? (
            <label>사번
              <div className="input-wrap"><Icon name="user" size={17} /><input value={id} onChange={(event) => setId(event.target.value)} placeholder="사번을 입력하세요" autoComplete="username" /></div>
            </label>
          ) : step === 2 ? (
            <label>스마트보안카드 인증번호
              <div className="security-request-row">
                <div className="input-wrap"><Icon name="key" size={17} /><input value={securityCode} onChange={(event) => setSecurityCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6자리 인증번호" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={!codeRequested || timeLeft <= 0} /></div>
                <button
                  type="button"
                  disabled={timeLeft > 0}
                  onClick={() => {
                    setCodeRequested(true);
                    setSecurityCode("");
                    setTimeLeft(30);
                    setError("");
                  }}
                >
                  {timeLeft > 0 ? `${timeLeft}초` : codeRequested ? "재요청" : "요청"}
                </button>
              </div>
            </label>
          ) : (
            <>
              <div className="password-guide"><Icon name="shield" size={17} /><span>9~20자의 영문, 숫자, 특수문자를 모두 사용해 주세요.</span></div>
              <div className="recovery-account"><span>사번</span><strong>{id}</strong></div>
              <label>새 비밀번호
                <div className="input-wrap"><Icon name="shield" size={17} /><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="새 비밀번호" type="password" autoComplete="new-password" autoFocus /></div>
              </label>
              <label>새 비밀번호 확인
                <div className="input-wrap"><Icon name="shield" size={17} /><input value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} placeholder="새 비밀번호 확인" type="password" autoComplete="new-password" /></div>
              </label>
              <div className="captcha-row">
                <div className="captcha-code" aria-label="CAPTCHA 이미지">{captcha.split("").map((character, index) => <span key={`${character}-${index}`}>{character}</span>)}</div>
                <button type="button" onClick={() => { setCaptcha(generateCaptcha()); setCaptchaInput(""); }}>새로고침</button>
              </div>
              <label>CAPTCHA
                <div className="input-wrap"><Icon name="key" size={17} /><input value={captchaInput} onChange={(event) => setCaptchaInput(event.target.value.slice(0, 5))} placeholder="위 문자를 입력하세요" autoComplete="off" /></div>
              </label>
            </>
          )}
          {error && <p className="signup-error">{error}</p>}
          {step === 3 ? (
            <button className="primary-button login-button" type="submit" disabled>비밀번호 변경 (준비 중)</button>
          ) : (
            <button className="primary-button login-button" type="submit">{step === 1 ? "다음" : "인증 완료"} <Icon name="arrow" size={17} /></button>
          )}
        </form>
      </section>
    </div>
  );
}
