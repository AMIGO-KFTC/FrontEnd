import { useState, type FormEvent } from "react";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import { Icon } from "@/shared/Icon";
import { AuthVisual } from "./AuthVisual";

const SAVED_ID_KEY = "amigo-saved-login-id";

function savedLoginId(): string {
  try {
    return window.localStorage.getItem(SAVED_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

type Props = {
  onLogin: (loginId: string, password: string) => Promise<void>;
  onSignup: () => void;
  onForgot: () => void;
  busy?: boolean;
  error?: string | null;
};

export function LoginScreen({ onLogin, onSignup, onForgot, busy = false, error = null }: Props) {
  const [id, setId] = useState(savedLoginId);
  const [password, setPassword] = useState("");
  const [saveId, setSaveId] = useState(() => savedLoginId() !== "");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id.trim() || !password.trim() || busy) return;
    try {
      if (saveId) window.localStorage.setItem(SAVED_ID_KEY, id.trim());
      else window.localStorage.removeItem(SAVED_ID_KEY);
    } catch {
      /* 저장소를 못 쓰는 브라우저는 저장만 건너뛴다 */
    }
    await onLogin(id.trim(), password);
  };

  return (
    <main className="login-page">
      <AuthVisual />
      <section className="login-panel">
        <div className="mobile-brand"><Brand /></div>
        <form className="login-form" onSubmit={submit}>
          <span className="eyebrow">WELCOME TO AMIGO</span>
          <h2>업무의 다음을 이어가세요</h2>
          <p className="form-intro">AMIGO에 로그인하고 인수인계서를 손쉽게 작성해보세요.</p>
          <label>아이디
            <div className="input-wrap"><Icon name="user" size={18} /><input value={id} onChange={(e) => setId(e.target.value)} placeholder="업무용 아이디를 입력하세요" autoComplete="username" /></div>
          </label>
          <label>비밀번호
            <div className="input-wrap"><Icon name="shield" size={18} /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" type="password" autoComplete="current-password" /></div>
          </label>
          <div className="login-options">
            <label className="check-label"><input type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)} /> <span>아이디 저장</span></label>
            <div className="login-links">
              <button type="button" className="text-button" onClick={onForgot}>비밀번호 재설정</button>
              <span />
              <button type="button" className="text-button" onClick={onSignup}>회원가입</button>
            </div>
          </div>
          {error && <div style={{ marginBottom: 14 }}><ErrorNote message={error} /></div>}
          <button className="primary-button login-button" type="submit" disabled={busy}>로그인 <Icon name="arrow" size={18} /></button>
          <div className="login-divider"><span />OR<span /></div>
          <button className="sso-button" type="button"><Icon name="key" size={16} /> Use SSO Sign-In</button>
        </form>
      </section>
    </main>
  );
}
