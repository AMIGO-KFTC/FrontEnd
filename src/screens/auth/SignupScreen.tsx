// 회원가입(새 디자인). BackEnd 의 POST /api/auth/signup 에 사번·비밀번호·이름과 소속(본부·부서, 팀)을 보낸다. 사번(숫자 7자리)이 곧 로그인 아이디(login_id)다.
// 소속을 가입 때 정해 두면 내 정보를 따로 고치지 않아도 인수인계 시작 화면에 우리 팀의 단위업무가 나온다(목록은 GET /api/auth/org-teams).
// 비밀번호는 9~20자의 영문·숫자·특수문자 조합(비밀번호 재설정 화면과 같은 규칙). 화면에서 먼저 검사하고, 서버 오류 문구(중복 사번 등)는 그대로 보여 준다.
// 스마트보안카드 인증번호는 서버 검증 API 가 아직 없어 화면에서 고정 번호(shared/securityCard.ts)로 확인한다(요청 → 30초 안에 6자리 입력). API 가 생기면 submit 에서 함께 보낸다.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import { checkSecurityCard } from "@/shared/securityCard";

const EMPLOYEE_NO = /^\d{7}$/;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{9,20}$/;
const CODE_SECONDS = 30;

type Props = { onBack: () => void; onRegistered?: (message: string) => void };

export function SignupScreen({ onBack, onRegistered }: Props) {
  const [name, setName] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [divisions, setDivisions] = useState<{ name: string; teams: string[] }[] | null>(null); // null = 불러오는 중이거나 못 불러옴
  const [division, setDivision] = useState("");
  const [team, setTeam] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [securityCard, setSecurityCard] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null); // 서버가 준 완료 안내
  const [error, setError] = useState("");

  useEffect(() => {
    api.orgTeams().then(({ divisions: rows }) => setDivisions(rows)).catch(() => setDivisions(null));
  }, []);

  useEffect(() => {
    if (!codeRequested || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeRequested, timeLeft]);

  const requestCode = () => {
    setCodeRequested(true);
    setSecurityCard("");
    setTimeLeft(CODE_SECONDS);
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !employeeNo || !password) {
      setError("이름, 사번, 비밀번호를 입력해 주세요.");
      return;
    }
    if (!EMPLOYEE_NO.test(employeeNo)) {
      setError("사번은 숫자 7자리여야 해요.");
      return;
    }
    if (divisions && divisions.length > 0 && (!division || !team)) {
      setError("소속 본부·부서와 팀을 골라 주세요.");
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      setError("비밀번호는 9~20자의 영문, 숫자, 특수문자를 모두 포함해야 해요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않아요.");
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
    const cardError = checkSecurityCard(securityCard); // 6자리 숫자면 아무 번호나 통과
    if (cardError) {
      setError(cardError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.signup(employeeNo, password, name.trim(), employeeNo, division, team);
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
            <h2 id="signup-title">회원가입이 완료되었습니다</h2>
            <p>{completed}</p>
            <button className="primary-button login-button" type="button" onClick={finish}>로그인 화면으로 이동 <Icon name="arrow" size={17} /></button>
          </div>
        ) : (
          <form className="login-form signup-form" onSubmit={submit}>
            <h2 id="signup-title">AMIGO 시작하기</h2>
            <label>이름
              <div className="input-wrap"><Icon name="user" size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력하세요" autoComplete="name" maxLength={50} disabled={busy} /></div>
            </label>
            <label>사번
              <div className="input-wrap"><Icon name="user" size={17} /><input value={employeeNo} onChange={(event) => setEmployeeNo(event.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="사번 7자리 숫자 (로그인에 사용)" inputMode="numeric" autoComplete="username" maxLength={7} disabled={busy} /></div>
            </label>
            {divisions && divisions.length > 0 && (
              <>
                <label>소속 본부·부서
                  <div className="input-wrap"><Icon name="folder" size={17} /><select value={division} onChange={(event) => { setDivision(event.target.value); setTeam(""); }} disabled={busy}>
                    <option value="">본부·부서를 골라 주세요</option>
                    {divisions.map((row) => <option key={row.name} value={row.name}>{row.name}</option>)}
                  </select></div>
                </label>
                <label>팀
                  <div className="input-wrap"><Icon name="folder" size={17} /><select value={team} onChange={(event) => setTeam(event.target.value)} disabled={busy || !division}>
                    <option value="">{division ? "팀을 골라 주세요" : "먼저 본부·부서를 골라 주세요"}</option>
                    {(divisions.find((row) => row.name === division)?.teams ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select></div>
                </label>
              </>
            )}
            <label>비밀번호
              <div className="input-wrap"><Icon name="shield" size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="9~20자, 영문·숫자·특수문자 포함" type="password" autoComplete="new-password" maxLength={20} disabled={busy} /></div>
            </label>
            <label>비밀번호 확인
              <div className="input-wrap"><Icon name="shield" size={17} /><input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="비밀번호를 한 번 더 입력하세요" type="password" autoComplete="new-password" maxLength={128} disabled={busy} /></div>
            </label>
            <label>스마트보안카드 인증번호
              <div className="security-request-row">
                <div className="input-wrap"><Icon name="key" size={17} /><input value={securityCard} onChange={(event) => setSecurityCard(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6자리 인증번호" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy || !codeRequested || timeLeft <= 0} /></div>
                <button type="button" disabled={busy || timeLeft > 0} onClick={requestCode}>
                  {timeLeft > 0 ? `${timeLeft}초` : codeRequested ? "재요청" : "요청"}
                </button>
              </div>
            </label>
            {error && <p className="signup-error" role="alert">{error}</p>}
            <button className="primary-button login-button" type="submit" disabled={busy}>{busy ? "가입 중…" : "회원가입"} <Icon name="arrow" size={17} /></button>
          </form>
        )}
      </section>
    </div>
  );
}
