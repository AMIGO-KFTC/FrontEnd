// 홈 화면(대시보드 · 진행 중 · 완성 문서 · 받은 인수인계)의 왼쪽 사이드바.
// 진행 중 개수와 최근 작업은 서버 세션 목록으로 채운다. 받은 인수인계는 아직 서버 API 가 없어 개수를 표시하지 않는다.
import { useRef, useState, type FormEvent } from "react";
import { Brand } from "@/shared/Brand";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import { LogoutConfirmModal } from "@/shared/LogoutConfirmModal";
import { useProfile } from "@/shared/profile";
import { ongoingSessions, recentSessions, sessionTitle, sessionTone } from "@/shared/sessions";
import type { SessionSummary } from "@/shared/types";

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
}: {
  active?: "home" | "handover" | "received" | "documents" | "chat";
  sessions: SessionSummary[] | null;
  onOpenSession: (id: string) => void;
  onLogout?: () => void;
  onHome?: () => void;
  onHandover?: () => void;
  onDocuments?: () => void;
  onReceived?: () => void;
  onChat?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [profile, setProfile] = useProfile();
  const [profileDraft, setProfileDraft] = useState(profile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const ongoingCount = sessions ? ongoingSessions(sessions).length : null;
  const recent = sessions ? recentSessions(sessions, 2) : [];
  const openProfileEdit = () => {
    setProfileDraft(profile);
    setProfileError(null);
    setProfileOpen(false);
    setProfileEditOpen(true);
  };
  // 이름·사번·소속·팀·직책은 서버(PUT /api/profile)에 저장한다. 사진은 서버에 자리가 없어 이 브라우저에서만 쓴다.
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const draft = { ...profileDraft, name: profileDraft.name.trim(), division: profileDraft.division.trim(), team: profileDraft.team.trim(), role: profileDraft.role.trim() };
    if (!draft.name || !draft.division || !draft.role) {
      setProfileError("이름, 소속, 직책은 비워 둘 수 없어요.");
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    try {
      const result = await api.saveProfile({ name: draft.name, department: draft.division, team: draft.team, position: draft.role }); // 사번은 바꿀 수 없어서 보내지 않는다
      setProfile({ ...draft, employeeId: result.profile.employee_no ?? draft.employeeId, name: result.profile.name, division: result.profile.department, team: result.profile.team, role: result.profile.position });
      setProfileEditOpen(false);
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
        <button className={active === "documents" ? "active" : ""} onClick={onDocuments}><Icon name="file" size={17} /><span>완성 문서</span></button>
        <button className={active === "received" ? "active" : ""} onClick={onReceived}><Icon name="download" size={17} /><span>받은 인수인계</span></button>
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
            <div><span>MY PROFILE</span><h2 id="profile-edit-title">내 프로필 수정</h2></div>
            <button onClick={() => setProfileEditOpen(false)} aria-label="프로필 수정 닫기"><Icon name="close" size={17} /></button>
          </header>
          <form onSubmit={saveProfile}>
            <div className="profile-photo-editor">
              <span>{profileDraft.photo ? <img src={profileDraft.photo} alt="프로필 사진 미리보기" /> : profileDraft.name.slice(0, 1)}</span>
              <div><strong>프로필 사진</strong><small>JPG 또는 PNG 파일을 등록할 수 있어요.</small></div>
              <button type="button" onClick={() => profilePhotoRef.current?.click()}>사진 변경</button>
              <input ref={profilePhotoRef} type="file" accept="image/png,image/jpeg" onChange={(event) => changeProfilePhoto(event.target.files?.[0])} />
            </div>
            <label>이름<input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} /></label>
            <label>사번<input value={profileDraft.employeeId} readOnly placeholder="미등록" title="사번은 바꿀 수 없어요." /></label>
            <label>소속<input value={profileDraft.division} onChange={(event) => setProfileDraft({ ...profileDraft, division: event.target.value })} /></label>
            <label>팀<input value={profileDraft.team} onChange={(event) => setProfileDraft({ ...profileDraft, team: event.target.value })} /></label>
            <label className="profile-role-field">직책<input value={profileDraft.role} onChange={(event) => setProfileDraft({ ...profileDraft, role: event.target.value })} /></label>
            {profileError && <p className="profile-edit-error" role="alert">{profileError}</p>}
            <div className="profile-edit-actions">
              <button type="button" onClick={() => setProfileEditOpen(false)} disabled={profileSaving}>취소</button>
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
