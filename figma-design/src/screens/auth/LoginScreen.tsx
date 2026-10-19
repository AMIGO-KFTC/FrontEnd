import { FormEvent, useState } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import AuthVisual from "@/screens/auth/AuthVisual";

export default function LoginScreen({ onLogin, onSignup, onForgot }: { onLogin: () => void; onSignup: () => void; onForgot: () => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (id.trim() && password.trim()) onLogin();
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
            <label className="check-label"><input type="checkbox" /> <span>아이디 저장</span></label>
            <div className="login-links">
              <button type="button" className="text-button" onClick={onForgot}>비밀번호 재설정</button>
              <span />
              <button type="button" className="text-button" onClick={onSignup}>회원가입</button>
            </div>
          </div>
          <button className="primary-button login-button" type="submit">로그인 <Icon name="arrow" size={18} /></button>
          <div className="login-divider"><span />OR<span /></div>
          <button className="sso-button" type="button"><Icon name="key" size={16} /> Use SSO Sign-In</button>
        </form>
      </section>
    </main>
  );
}
