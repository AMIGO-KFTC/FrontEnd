import { useState, type FormEvent } from "react";
import { Brand } from "../shared/Brand";
import { ErrorNote } from "../shared/ErrorNote";
import { Icon } from "../shared/Icon";
import { api } from "../shared/api";

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
  busy?: boolean;
  error?: string | null;
  resetToken?: string | null; // 재설정 안내 링크(#/reset-password?token=…)로 들어왔을 때
  onResetDone?: () => void;
};

// 비밀번호 찾기(아이디 + 등록한 이메일) → 재설정(안내 메일의 토큰 + 새 비밀번호)
function PasswordHelp({ initialToken, onClose }: { initialToken: string | null; onClose: (message?: string) => void }) {
  const [token, setToken] = useState(initialToken ?? "");
  const [step, setStep] = useState<"forgot" | "reset">(initialToken ? "reset" : "forgot");
  const [loginId, setLoginId] = useState(savedLoginId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = (event: FormEvent) => {
    event.preventDefault();
    if (!loginId.trim() || !email.trim()) return;
    void act(async () => {
      const res = await api.forgotPassword(loginId.trim(), email.trim());
      setNotice(res.message);
      if (res.reset_token) {
        setToken(res.reset_token); // 메일 연동 전 개발 모드: 안내 메일 대신 바로 재설정
        setStep("reset");
      }
    });
  };

  const reset = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("새 비밀번호는 8자 이상이어야 합니다.");
    if (password !== confirm) return setError("새 비밀번호가 서로 다릅니다.");
    void act(async () => {
      const res = await api.resetPassword(token.trim(), password);
      onClose(res.message);
    });
  };

  return step === "forgot" ? (
    <form className="login-form" onSubmit={forgot}>
      <span className="eyebrow">FIND PASSWORD</span>
      <h2>비밀번호 찾기</h2>
      <p className="form-intro">아이디와 등록한 이메일을 입력하면 비밀번호 재설정 안내를 보내 드려요.</p>
      <label>아이디
        <div className="input-wrap"><Icon name="user" size={18} /><input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디" autoComplete="username" /></div>
      </label>
      <label>이메일
        <div className="input-wrap"><Icon name="mail" size={18} /><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="등록한 이메일" type="email" autoComplete="email" /></div>
      </label>
      {notice && <p className="form-notice">{notice}</p>}
      {error && <div style={{ marginBottom: 14 }}><ErrorNote message={error} /></div>}
      <button className="primary-button login-button" type="submit" disabled={busy}>재설정 안내 받기 <Icon name="arrow" size={18} /></button>
      <div className="login-options form-links">
        <button type="button" className="text-button" onClick={() => setStep("reset")}>안내받은 토큰이 있어요</button>
        <button type="button" className="text-button" onClick={() => onClose()}>로그인으로 돌아가기</button>
      </div>
    </form>
  ) : (
    <form className="login-form" onSubmit={reset}>
      <span className="eyebrow">RESET PASSWORD</span>
      <h2>새 비밀번호 정하기</h2>
      <p className="form-intro">재설정하면 모든 기기에서 로그아웃돼요. 새 비밀번호로 다시 로그인해 주세요.</p>
      {notice && <p className="form-notice">{notice}</p>}
      {!initialToken && (
        <label>재설정 토큰
          <div className="input-wrap"><Icon name="shield" size={18} /><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="안내받은 토큰" /></div>
        </label>
      )}
      <label>새 비밀번호
        <div className="input-wrap"><Icon name="shield" size={18} /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" type="password" autoComplete="new-password" /></div>
      </label>
      <label>새 비밀번호 확인
        <div className="input-wrap"><Icon name="shield" size={18} /><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="한 번 더 입력" type="password" autoComplete="new-password" /></div>
      </label>
      {error && <div style={{ marginBottom: 14 }}><ErrorNote message={error} /></div>}
      <button className="primary-button login-button" type="submit" disabled={busy || !token.trim()}>비밀번호 바꾸기 <Icon name="arrow" size={18} /></button>
      <div className="login-options form-links">
        <span />
        <button type="button" className="text-button" onClick={() => onClose()}>로그인으로 돌아가기</button>
      </div>
    </form>
  );
}

export function LoginScreen({ onLogin, busy = false, error = null, resetToken = null, onResetDone }: Props) {
  const [id, setId] = useState(savedLoginId);
  const [password, setPassword] = useState("");
  const [saveId, setSaveId] = useState(() => savedLoginId() !== "");
  const [help, setHelp] = useState(resetToken !== null);
  const [notice, setNotice] = useState<string | null>(null);
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
        {help ? (
          <PasswordHelp
            initialToken={resetToken}
            onClose={(message) => {
              setHelp(false);
              setNotice(message ?? null);
              onResetDone?.();
            }}
          />
        ) : (
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
            <button type="button" className="text-button" onClick={() => { setNotice(null); setHelp(true); }}>비밀번호 찾기</button>
          </div>
          {notice && <p className="form-notice">{notice}</p>}
          {error && <div style={{ marginBottom: 14 }}><ErrorNote message={error} /></div>}
          <button className="primary-button login-button" type="submit" disabled={busy}>로그인 <Icon name="arrow" size={18} /></button>
          <p className="security-note"><Icon name="shield" size={14} /> 모든 자료는 암호화되어 안전하게 보호됩니다.</p>
        </form>
        )}
      </section>
    </main>
  );
}
