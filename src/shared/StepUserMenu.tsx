// 4단계 작성 화면 머리글 오른쪽의 사용자 아바타 메뉴(홈으로 돌아가기 · 로그아웃).
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/shared/Icon";
import { LogoutConfirmModal } from "@/shared/LogoutConfirmModal";
import { ProfilePhoto, useProfile } from "@/shared/profile";

export function StepUserMenu({ onLogout, onHome }: { onLogout: () => void; onHome: () => void }) {
  const [profile] = useProfile();
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <div className="step-user-menu" ref={menuRef}>
        <button className="step-user-avatar" aria-label={`${profile.name} 프로필 열기`} aria-expanded={open} onClick={() => setOpen((current) => !current)}><ProfilePhoto profile={profile} /></button>
        {open && (
          <div className="type-profile-popover">
            <header><span><ProfilePhoto profile={profile} /></span><div><strong>{profile.name}</strong><small>사번 {profile.employeeId || "미등록"}</small></div></header>
            <div className="type-profile-actions">
              <button className="type-profile-home" onClick={() => {
                setOpen(false);
                onHome();
              }}><Icon name="home" size={13} /> 홈으로 돌아가기</button>
              <button className="type-profile-logout" onClick={() => {
                setOpen(false);
                setLogoutConfirmOpen(true);
              }}>로그아웃</button>
            </div>
          </div>
        )}
      </div>
      {logoutConfirmOpen && <LogoutConfirmModal onCancel={() => setLogoutConfirmOpen(false)} onConfirm={() => {
        setLogoutConfirmOpen(false);
        onLogout();
      }} />}
    </>
  );
}
