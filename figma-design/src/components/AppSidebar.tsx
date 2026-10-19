import { FormEvent, useRef, useState } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import LogoutConfirmModal from "@/components/LogoutConfirmModal";
import { useOngoingDrafts, useProfile } from "@/store/AppStore";

export default function AppSidebar({
  active = "home",
  onLogout,
  onHome,
  onHandover,
  onDocuments,
  onReceived,
}: {
  active?: "home" | "handover" | "received" | "documents";
  onLogout?: () => void;
  onHome?: () => void;
  onHandover?: () => void;
  onDocuments?: () => void;
  onReceived?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [profile, setProfile] = useProfile();
  const ongoingCount = useOngoingDrafts().length;
  const [profileDraft, setProfileDraft] = useState(profile);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const openProfileEdit = () => {
    setProfileDraft(profile);
    setProfileOpen(false);
    setProfileEditOpen(true);
  };
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    setProfile(profileDraft);
    setProfileEditOpen(false);
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
        <Brand />
      </div>
      <nav className="sidebar-nav">
        <button className={active === "home" ? "active" : ""} onClick={onHome}><Icon name="home" size={17} /><span>홈</span></button>
        <button className={active === "handover" ? "active" : ""} onClick={onHandover}><Icon name="message" size={17} /><span>진행 중인 인수인계</span><small>{ongoingCount}</small></button>
      </nav>
      <div className="sidebar-section">
        <p>최근 작업</p>
        <button><span className="project-dot coral" />플랫폼 운영 인수인계</button>
        <button><span className="project-dot blue" />Q1 프로젝트 정리</button>
      </div>
      <nav className="sidebar-nav sidebar-nav-secondary">
        <button className={active === "documents" ? "active" : ""} onClick={onDocuments}><Icon name="file" size={17} /><span>완성 문서</span></button>
        <button className={active === "received" ? "active" : ""} onClick={onReceived}><Icon name="download" size={17} /><span>받은 인수인계</span><small>2</small></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-profile">
          <span>{profile.photo ? <img src={profile.photo} alt="" /> : profile.name.slice(0, 1)}</span>
          <div><strong>{profile.name}</strong><small>{profile.role}</small></div>
          <button className="profile-more" onClick={() => setProfileOpen((current) => !current)} aria-label="내 프로필 열기" aria-expanded={profileOpen}><Icon name="more" size={16} /></button>
          {profileOpen && (
            <div className="profile-popover">
              <header><span>{profile.photo ? <img src={profile.photo} alt="" /> : profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>사번 {profile.employeeId}</small></div></header>
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
            <label>사번<input value={profileDraft.employeeId} disabled /></label>
            <label>소속<input value={profileDraft.division} onChange={(event) => setProfileDraft({ ...profileDraft, division: event.target.value })} /></label>
            <label>팀<input value={profileDraft.team} onChange={(event) => setProfileDraft({ ...profileDraft, team: event.target.value })} /></label>
            <label className="profile-role-field">직책<input value={profileDraft.role} onChange={(event) => setProfileDraft({ ...profileDraft, role: event.target.value })} /></label>
            <div className="profile-edit-actions">
              <button type="button" onClick={() => setProfileEditOpen(false)}>취소</button>
              <button type="submit">변경사항 저장</button>
            </div>
          </form>
        </section>
      </div>
    )}
    {logoutConfirmOpen && <LogoutConfirmModal onCancel={() => setLogoutConfirmOpen(false)} onConfirm={() => { setLogoutConfirmOpen(false); onLogout?.(); }} />}
    </>
  );
}
