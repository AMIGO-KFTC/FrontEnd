// 회원가입(새 디자인). BackEnd 의 POST /api/auth/signup 에 아이디·비밀번호·이름을 보낸다.
// 서버 규칙: 아이디는 영문·숫자·._@- 3~50자, 비밀번호는 8자 이상. 같은 규칙을 화면에서 먼저 검사하고, 서버 오류 문구(중복 아이디 등)는 그대로 보여 준다.
import { useState, type FormEvent } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";

const LOGIN_ID = /^[A-Za-z0-9._@-]{3,50}$/;

type Props = { onBack: () => void; onRegistered?: (message: string) => void };

export function SignupScreen({ onBack, onRegistered }: Props) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null); // 서버가 준 완료 안내
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const loginId = id.trim();
    if (!name.trim() || !loginId || !password) {
      setError("이름, 아이디, 비밀번호를 입력해 주세요.");
      return;
    }
    if (!LOGIN_ID.test(loginId)) {
      setError("아이디는 영문·숫자·. _ @ - 로 3~50자여야 해요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 해요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.signup(loginId, password, name.trim());
      setCompleted(result.message || "회원가입이 완료되었습니다. 로그인해 주세요.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (completed) onRegistered?.(completed);
    onBack();
  };

  return (
    <div className="signup-overlay" role="presentation" onClick={completed ? finish : onBack}>
      <section className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-title" onClick={(event) => event.stopPropagation()}>
        <button className="signup-close" type="button" onClick={completed ? finish : onBack} aria-label="회원가입 닫기"><Icon name="close" size={18} /></button>
        {completed ? (
          <div className="signup-complete">
            <span><Icon name="check" size={25} /></span>
            <small>WELCOME TO AMIGO</small>
            <h2 id="signup-title">회원가입이 완료되었습니다</h2>
            <p>{completed}</p>
            <button className="primary-button login-button" type="button" onClick={finish}>로그인 화면으로 이동 <Icon name="arrow" size={17} /></button>
          </div>
        ) : (
          <form className="login-form signup-form" onSubmit={submit}>
            <span className="eyebrow">CREATE YOUR ACCOUNT</span>
            <h2 id="signup-title">AMIGO 시작하기</h2>
            <label>이름
              <div className="input-wrap"><Icon name="user" size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력하세요" autoComplete="name" maxLength={50} disabled={busy} /></div>
            </label>
            <label>아이디
              <div className="input-wrap"><Icon name="user" size={17} /><input value={id} onChange={(event) => setId(event.target.value)} placeholder="영문·숫자 3~50자 (예: 사번)" autoComplete="username" maxLength={50} disabled={busy} /></div>
            </label>
            <label>비밀번호
              <div className="input-wrap"><Icon name="shield" size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" type="password" autoComplete="new-password" maxLength={128} disabled={busy} /></div>
            </label>
            <label>비밀번호 확인
              <div className="input-wrap"><Icon name="shield" size={17} /><input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="비밀번호를 한 번 더 입력하세요" type="password" autoComplete="new-password" maxLength={128} disabled={busy} /></div>
            </label>
            {error && <p className="signup-error" role="alert">{error}</p>}
            <button className="primary-button login-button" type="submit" disabled={busy}>{busy ? "가입 중…" : "회원가입"} <Icon name="arrow" size={17} /></button>
          </form>
        )}
      </section>
    </div>
  );
}
