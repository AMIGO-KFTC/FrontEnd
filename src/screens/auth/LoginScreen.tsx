import { useState, type FormEvent } from "react";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import { Icon } from "@/shared/Icon";
import { useCapsLock } from "@/shared/useCapsLock";
import { AuthVisual } from "./AuthVisual";

const SAVED_ID_KEY = "amigo-saved-login-id";

// 임시: Onetel SSO 연동 전까지 SSO 로그인은 시연 계정(계장 김민준)으로 들어간다. 연동되면 이 계정 정보를 지우고 SSO 응답으로 바꾼다.
const SSO_DEMO_ACCOUNT = { loginId: "1111111", password: "amigo1234" }; // 시드 계정: IT아미고팀 계장 김민준(아이디 = 사번)

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
  notice?: string | null; // 로그인 만료 등 오류가 아닌 안내
};

export function LoginScreen({ onLogin, onSignup, onForgot, busy = false, error = null, notice = null }: Props) {
  const [id, setId] = useState(savedLoginId);
  const [password, setPassword] = useState("");
  const [saveId, setSaveId] = useState(() => savedLoginId() !== "");
  const [ssoOpen, setSsoOpen] = useState(false);
  const caps = useCapsLock();
  const ssoLogin = async () => {
    if (busy) return;
    setSsoOpen(false);
    await onLogin(SSO_DEMO_ACCOUNT.loginId, SSO_DEMO_ACCOUNT.password);
  };
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
          <p className="form-intro">AMIGO에 로그인하고,<br />인수인계서를 손쉽게 작성해보세요.</p>
          <label>사번
            <div className="input-wrap"><Icon name="user" size={18} /><input value={id} onChange={(e) => setId(e.target.value)} placeholder="사번을 입력하세요" autoComplete="username" /></div>
          </label>
          <label>비밀번호
            <div className="input-wrap"><Icon name="shield" size={18} /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" type="password" autoComplete="current-password" {...caps.handlers} /></div>
            {caps.capsLock && <p className="caps-warning" role="status"><Icon name="alert" size={14} /> Caps Lock이 켜져 있어요. 대문자로 입력될 수 있어요.</p>}
          </label>
          <div className="login-options">
            <label className="check-label"><input type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)} /> <span>사번 저장</span></label>
            <div className="login-links">
              <button type="button" className="text-button" onClick={onForgot}>비밀번호 재설정</button>
              <span />
              <button type="button" className="text-button" onClick={onSignup}>회원가입</button>
            </div>
          </div>
          {(error || notice) && <div style={{ marginBottom: 14 }}><ErrorNote message={error ?? notice} tone={error ? "error" : "info"} /></div>}
          <button className="primary-button login-button" type="submit" disabled={busy}>로그인 <Icon name="arrow" size={18} /></button>
          <div className="login-divider"><span />OR<span /></div>
          <button className="sso-button" type="button" onClick={() => setSsoOpen(true)}><Icon name="key" size={16} /> Use SSO Sign-In</button>
        </form>
      </section>
      {ssoOpen && (
        <div className="logout-overlay" role="presentation" onClick={() => setSsoOpen(false)}>
          <section className="logout-modal sso-modal" role="alertdialog" aria-modal="true" aria-labelledby="sso-title" onClick={(event) => event.stopPropagation()}>
            <span><Icon name="key" size={22} /></span>
            <h2 id="sso-title">SSO 로그인</h2>
            <p>현재 Onetel에서 로그인된 사번으로 로그인합니다.</p>
            <div><button type="button" onClick={() => setSsoOpen(false)}>취소</button><button type="button" autoFocus onClick={ssoLogin}>로그인</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
