// 마이페이지: 내 정보 수정(이름·부서·팀명·직위·이메일), 비밀번호 바꾸기, 내가 작성한 인수인계서 불러오기.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../shared/api";
import { Brand } from "../shared/Brand";
import { ErrorNote } from "../shared/ErrorNote";
import { Icon } from "../shared/Icon";
import type { MyDocument, MyPage } from "../shared/types";

type Props = {
  onBack: () => void;
  onLogout: () => void;
  onOpenDocument: (sessionId: string) => void;
  onAdmin: () => void; // 관리자 페이지(관리자만 버튼이 보인다)
};

type InfoForm = { name: string; department: string; team: string; position: string; email: string };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formOf(page: MyPage): InfoForm {
  const p = page.user.profile;
  return { name: page.user.name, department: p?.department ?? "", team: p?.team ?? "", position: p?.position ?? "", email: page.user.email };
}

export function MyPageScreen({ onBack, onLogout, onOpenDocument, onAdmin }: Props) {
  const [page, setPage] = useState<MyPage | null>(null);
  const [documents, setDocuments] = useState<MyDocument[]>([]);
  const [form, setForm] = useState<InfoForm>({ name: "", department: "", team: "", position: "", email: "" });
  const [infoNote, setInfoNote] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwNote, setPwNote] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, docs] = await Promise.all([api.myPage(), api.myDocuments()]);
      setPage(me);
      setForm(formOf(me));
      setDocuments(docs.documents);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveInfo = async (event: FormEvent) => {
    event.preventDefault();
    if (!page) return;
    const before = formOf(page);
    const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) => value.trim() !== before[key as keyof InfoForm]).map(([key, value]) => [key, value.trim()]));
    if (!Object.keys(changes).length) return setInfoNote("바뀐 내용이 없어요.");
    setBusy(true);
    setInfoError(null);
    setInfoNote(null);
    try {
      const next = await api.updateMe(changes);
      setPage(next);
      setForm(formOf(next));
      setInfoNote(next.message);
    } catch (e) {
      setInfoError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPwNote(null);
    if (passwords.next.length < 8) return setPwError("새 비밀번호는 8자 이상이어야 합니다.");
    if (passwords.next !== passwords.confirm) return setPwError("새 비밀번호가 서로 다릅니다.");
    setBusy(true);
    setPwError(null);
    try {
      const res = await api.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setPwNote(res.message);
      void load();
    } catch (e) {
      setPwError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof InfoForm, label: string, placeholder: string, type = "text") => (
    <label>
      {label}
      <input type={type} value={form[key]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="onboarding-page mypage">
      <header className="onboarding-header">
        <Brand />
        <div className="mypage-actions">
          {page?.user.is_admin && <button className="admin-entry" onClick={onAdmin}><Icon name="shield" size={14} /> 관리자 페이지</button>}
          <button onClick={onBack}><Icon name="arrow" size={14} /> 작업으로 돌아가기</button>
          <button onClick={onLogout}>로그아웃</button>
        </div>
      </header>
      <main className="mypage-main">
        <div className="mypage-title">
          <span>MY PAGE</span>
          <h1>
            {page ? `${page.user.name}님의 정보` : "마이페이지"}
            {page?.user.is_admin && <em className="admin-badge">관리자</em>}
          </h1>
          {page && (
            <p>
              {page.user.login_id} · 가입 {formatDate(page.created_at)} · 마지막 로그인 {formatDate(page.last_login_at)}
            </p>
          )}
        </div>
        <ErrorNote message={loadError} />

        {page && (
          <section className="mypage-stats">
            <div><strong>{page.stats.unit_tasks}</strong><small>단위업무</small></div>
            <div><strong>{page.stats.documents}</strong><small>인수인계서</small></div>
            <div><strong>{page.stats.document_versions}</strong><small>저장된 버전</small></div>
          </section>
        )}

        <section className="mypage-card">
          <h2><Icon name="user" size={16} /> 내 정보 수정</h2>
          <form className="mypage-form" onSubmit={saveInfo}>
            {field("name", "이름", "이름")}
            {field("department", "부서", "예: 디지털전략부")}
            {field("team", "팀명", "예: 웹서비스팀(없으면 비워 두세요)")}
            {field("position", "직위", "예: 과장")}
            {field("email", "이메일", "비밀번호 찾기에 쓰는 이메일", "email")}
            <div className="mypage-form-footer">
              {infoNote && <span className="form-notice">{infoNote}</span>}
              <button className="primary-button" type="submit" disabled={busy || !page}>저장하기</button>
            </div>
            <ErrorNote message={infoError} />
          </form>
        </section>

        <section className="mypage-card">
          <h2><Icon name="shield" size={16} /> 비밀번호 바꾸기</h2>
          <form className="mypage-form" onSubmit={changePassword}>
            <label>지금 비밀번호<input type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></label>
            <label>새 비밀번호<input type="password" autoComplete="new-password" placeholder="8자 이상" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /></label>
            <label>새 비밀번호 확인<input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></label>
            <div className="mypage-form-footer">
              <small>{page?.password_changed_at ? `마지막 변경 ${formatDate(page.password_changed_at)}` : "다른 기기의 로그인은 끊겨요."}</small>
              {pwNote && <span className="form-notice">{pwNote}</span>}
              <button className="primary-button" type="submit" disabled={busy || !passwords.current}>비밀번호 바꾸기</button>
            </div>
            <ErrorNote message={pwError} />
          </form>
        </section>

        <section className="mypage-card">
          <h2><Icon name="file" size={16} /> 내 인수인계서</h2>
          {documents.length === 0 && <p className="mypage-empty">아직 만들어진 인수인계서가 없어요.</p>}
          {documents.map((doc) => (
            <div className="mypage-document" key={doc.session_id}>
              <div>
                <strong>{doc.task_name || doc.title}</strong>
                <small>v{doc.version} · {doc.origin_label} · 버전 {doc.version_count}개 · {formatDate(doc.updated_at)}</small>
              </div>
              <button onClick={() => onOpenDocument(doc.session_id)}>열기 <Icon name="chevron" size={12} /></button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
