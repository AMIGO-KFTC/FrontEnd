import { useState, type FormEvent } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (id.trim() && password.trim()) onLogin();
  };

  return (
    <main className="login-page">
      <div className="login-art">
        <div className="art-grid" />
        <div className="art-content">
          <Brand />
          <div className="art-copy">
            <span className="eyebrow light"><Icon name="sparkle" size={15} /> ASK ME INTERACTIVELY</span>
            <h1>업무의 맥락까지,<br />온전히 이어지도록.</h1>
            <p>Grounding으로 근거를 찾고, Orchestration으로 흐름을 연결해<br />빈틈없는 인수인계서를 완성합니다.</p>
          </div>
          <div className="art-proof">
            <div className="proof-avatars"><span>김</span><span>이</span><span>박</span></div>
            <div><strong>누적 1,248건</strong><small>이어봄과 함께 인수인계를 완료했어요</small></div>
          </div>
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>
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
            <button type="button" className="text-button">비밀번호 찾기</button>
          </div>
          <button className="primary-button login-button" type="submit">로그인 <Icon name="arrow" size={18} /></button>
          <p className="security-note"><Icon name="shield" size={14} /> 모든 자료는 암호화되어 안전하게 보호됩니다.</p>
        </form>
      </section>
    </main>
  );
}
