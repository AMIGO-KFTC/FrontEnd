// 홈 화면(대시보드 · 진행 중 · 내가 작성한 문서 · 받은 인수인계 · 근거 자료)의 왼쪽 사이드바.
// 진행 중 개수와 최근 작업은 서버 세션 목록으로 채운다. 받은 인수인계는 아직 서버 API 가 없어 개수를 표시하지 않는다.
import { useRef, useState, type FormEvent } from "react";
import { Brand } from "@/shared/Brand";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import { LogoutConfirmModal } from "@/shared/LogoutConfirmModal";
import { saveProfilePhoto, useProfile } from "@/shared/profile";
import { ongoingSessions, recentSessions, sessionTitle, sessionTone } from "@/shared/sessions";
import type { SessionSummary } from "@/shared/types";
import { useCapsLock } from "@/shared/useCapsLock";

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };

export function AppSidebar({
  active = "home",
  sessions,
  onOpenSession,
  onLogout,
  onHome,
  onHandover,
  onDocuments,
  onReceived,
  onChat,
  onCalendar,
  onMaterials,
}: {
  active?: "home" | "handover" | "received" | "documents" | "chat" | "calendar" | "materials";
  sessions: SessionSummary[] | null;
  onOpenSession: (id: string) => void;
  onLogout?: () => void;
  onHome?: () => void;
  onHandover?: () => void;
  onDocuments?: () => void;
  onReceived?: () => void;
  onChat?: () => void;
  onCalendar?: () => void;
  onMaterials?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [profile, setProfile] = useProfile();
  const [profileDraft, setProfileDraft] = useState(profile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const caps = useCapsLock();
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const ongoingCount = sessions ? ongoingSessions(sessions).length : null;
  const recent = sessions ? recentSessions(sessions, 2) : [];
  const openProfileEdit = () => {
    setProfileDraft(profile);
    setProfileError(null);
    setProfileNotice(null);
    setPasswords(EMPTY_PASSWORDS);
    setProfileOpen(false);
    setProfileEditOpen(true);
  };
  // 이름·사번·소속·팀·직책은 인사 정보라 여기서 바꾸지 않는다(읽기 전용). 사진은 서버에 자리가 없어 이 브라우저에서만 쓰고,
  // 비밀번호 칸을 채웠으면 PUT /api/me/password 로 바꾼다(지금 쓰는 기기를 뺀 다른 기기의 로그인은 끊긴다).
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const changingPassword = Boolean(passwords.current || passwords.next || passwords.confirm);
    if (changingPassword) {
      if (!passwords.current || !passwords.next || !passwords.confirm) {
        setProfileError("비밀번호를 바꾸려면 지금 비밀번호, 새 비밀번호, 새 비밀번호 확인을 모두 입력해 주세요.");
        return;
      }
      if (passwords.next.length < 8) {
        setProfileError("새 비밀번호는 8자 이상이어야 해요.");
        return;
      }
      if (passwords.next !== passwords.confirm) {
        setProfileError("새 비밀번호와 확인이 서로 달라요.");
        return;
      }
      if (passwords.next === passwords.current) {
        setProfileError("지금과 다른 비밀번호를 입력해 주세요.");
        return;
      }
    }
    setProfileError(null);
    setProfileNotice(null);
    if (!changingPassword) {
      saveProfilePhoto(profile.loginId, profileDraft.photo);
      setProfile({ ...profile, photo: profileDraft.photo });
      setProfileEditOpen(false);
      return;
    }
    setProfileSaving(true);
    try {
      const result = await api.changePassword(passwords.current, passwords.next);
      saveProfilePhoto(profile.loginId, profileDraft.photo);
      setProfile({ ...profile, photo: profileDraft.photo });
      setPasswords(EMPTY_PASSWORDS);
      setProfileNotice(result.message || "비밀번호를 바꿨어요.");
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setProfileSaving(false);
    }
  };
  const changeProfilePhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileDraft((current) => ({ ...current, photo: typeof reader.result === "string" ? reader.result : "" }));
    reader.readAsDataURL(file);
  };

  return (
    <>
    <aside className="app-sidebar">
      <div className="sidebar-top">
        <Brand onClick={onHome} />
      </div>
      <nav className="sidebar-nav">
        <button className={active === "home" ? "active" : ""} onClick={onHome}><Icon name="home" size={17} /><span>홈</span></button>
        <button className={active === "handover" ? "active" : ""} onClick={onHandover}><Icon name="message" size={17} /><span>진행 중인 인수인계</span>{ongoingCount !== null && <small>{ongoingCount}</small>}</button>
      </nav>
      {recent.length > 0 && (
        <div className="sidebar-section">
          <p>최근 작업</p>
          {recent.map((session) => (
            <button key={session.id} onClick={() => onOpenSession(session.id)} title={sessionTitle(session)}><span className={`project-dot ${sessionTone(session.id)}`} /><span className="sidebar-recent-title">{sessionTitle(session)}</span></button>
          ))}
        </div>
      )}
      <nav className="sidebar-nav sidebar-nav-secondary">
        <button className={active === "documents" ? "active" : ""} onClick={onDocuments}><Icon name="file" size={17} /><span>내가 작성한 문서</span></button>
        <button className={active === "received" ? "active" : ""} onClick={onReceived}><Icon name="download" size={17} /><span>받은 인수인계</span></button>
        {onMaterials && <button className={active === "materials" ? "active" : ""} onClick={onMaterials}><Icon name="folder" size={17} /><span>근거 자료</span></button>}
        {onCalendar && <button className={active === "calendar" ? "active" : ""} onClick={onCalendar}><Icon name="calendar" size={17} /><span>캘린더</span></button>}
        {onChat && <button className={active === "chat" ? "active" : ""} onClick={onChat}><Icon name="sparkle" size={17} /><span>인수인계 챗봇</span></button>}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-profile">
          <span>{profile.photo ? <img src={profile.photo} alt="" /> : profile.name.slice(0, 1)}</span>
          <div><strong>{profile.name}</strong><small>{profile.role}</small></div>
          <button className="profile-more" onClick={() => setProfileOpen((current) => !current)} aria-label="내 프로필 열기" aria-expanded={profileOpen}><Icon name="more" size={16} /></button>
          {profileOpen && (
            <div className="profile-popover">
              <header><span>{profile.photo ? <img src={profile.photo} alt="" /> : profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>사번 {profile.employeeId || "미등록"}</small></div></header>
              <dl>
                <div><dt>소속</dt><dd>{profile.division} · {profile.team}</dd></div>
                <div><dt>직책</dt><dd>{profile.role}</dd></div>
              </dl>
              <div className="profile-actions">
                <button onClick={openProfileEdit}>내 프로필 수정</button>
                <button className="profile-logout" onClick={() => { setProfileOpen(false); setLogoutConfirmOpen(true); }}>로그아웃</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
    {profileEditOpen && (
      <div className="profile-edit-overlay" role="presentation" onClick={() => setProfileEditOpen(false)}>
        <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" onClick={(event) => event.stopPropagation()}>
          <header>
            <div><h2 id="profile-edit-title">내 프로필 수정</h2></div>
            <button onClick={() => setProfileEditOpen(false)} aria-label="프로필 수정 닫기"><Icon name="close" size={17} /></button>
          </header>
          <form onSubmit={saveProfile}>
            <div className="profile-photo-editor">
              <span>{profileDraft.photo ? <img src={profileDraft.photo} alt="프로필 사진 미리보기" /> : profileDraft.name.slice(0, 1)}</span>
              <div><strong>프로필 사진</strong><small>JPG 또는 PNG 파일을 등록할 수 있어요.</small></div>
              <button type="button" onClick={() => profilePhotoRef.current?.click()}>사진 변경</button>
              <input ref={profilePhotoRef} type="file" accept="image/png,image/jpeg" onChange={(event) => changeProfilePhoto(event.target.files?.[0])} />
            </div>
            <label>이름<input value={profile.name} readOnly /></label>
            <label>사번<input value={profile.employeeId} readOnly placeholder="미등록" /></label>
            <label>소속<input value={profile.division} readOnly placeholder="미등록" /></label>
            <label>팀<input value={profile.team} readOnly placeholder="미등록" /></label>
            <label className="profile-role-field">직책<input value={profile.role} readOnly placeholder="미등록" /></label>
            <p className="profile-edit-readonly-note">이름·사번·소속·팀·직책은 인사 정보라 바꿀 수 없어요.</p>
            <div className="profile-password-section">
              <strong>비밀번호 변경<small>바꾸지 않으려면 비워 두세요.</small></strong>
              <label className="profile-password-current">지금 비밀번호
                <input type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} {...caps.handlers} />
              </label>
              <label>새 비밀번호
                <input type="password" autoComplete="new-password" placeholder="8자 이상" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} {...caps.handlers} />
              </label>
              <label>새 비밀번호 확인
                <input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} {...caps.handlers} />
              </label>
              {caps.capsLock && <p className="profile-password-caps">Caps Lock 이 켜져 있어요.</p>}
            </div>
            {profileError && <p className="profile-edit-error" role="alert">{profileError}</p>}
            {profileNotice && <p className="profile-edit-success" role="status">{profileNotice}</p>}
            <div className="profile-edit-actions">
              <button type="button" onClick={() => setProfileEditOpen(false)} disabled={profileSaving}>{profileNotice ? "닫기" : "취소"}</button>
              <button type="submit" disabled={profileSaving}>{profileSaving ? "저장 중…" : "변경사항 저장"}</button>
            </div>
          </form>
        </section>
      </div>
    )}
    {logoutConfirmOpen && <LogoutConfirmModal onCancel={() => setLogoutConfirmOpen(false)} onConfirm={() => { setLogoutConfirmOpen(false); onLogout?.(); }} />}
    </>
  );
}
