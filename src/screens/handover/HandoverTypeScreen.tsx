// 새 인수인계의 유형 선택. 서버 세션의 mode(reassignment=인사발령, leave=장기휴가)로 이어진다.
import { useState } from "react";
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";
import { LogoutConfirmModal } from "@/shared/LogoutConfirmModal";
import { useProfile } from "@/shared/profile";
import type { HandoverMode } from "@/shared/types";

export function HandoverTypeScreen({ onSelect, onLogout, onHome }: { onSelect: (mode: HandoverMode) => void; onLogout: () => void; onHome: () => void }) {
  const [profile] = useProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  return (
    <div className="handover-type-page">
      <header className="handover-type-header">
        <Brand />
        <div className="type-header-profile">
          <button className="type-profile-avatar" onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen} aria-label="내 프로필 열기">{profile.name.slice(0, 1)}</button>
          {profileOpen && (
            <div className="type-profile-popover">
              <header><span>{profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>사번 {profile.employeeId}</small></div></header>
              <div className="type-profile-actions">
                <button className="type-profile-home" onClick={() => { setProfileOpen(false); onHome(); }}><Icon name="home" size={13} /> 홈으로 돌아가기</button>
                <button className="type-profile-logout" onClick={() => { setProfileOpen(false); setLogoutConfirmOpen(true); }}>로그아웃</button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="handover-type-main">
        <div className="handover-type-content">
          <section className="handover-type-title">
            <span><Icon name="sparkle" size={13} /> START NEW HANDOVER</span>
            <h1>어떤 인수인계를<br />준비하고 있나요?</h1>
            <p>상황에 맞는 유형을 선택하면 AMIGO가 필요한 항목과 자료를 안내해 드려요.</p>
          </section>
          <section className="handover-type-options">
            <button className="handover-type-card personnel" onClick={() => onSelect("reassignment")}>
              <div className="type-card-top"><span><Icon name="user" size={25} /></span><em>REGULAR PERSONNEL</em></div>
              <div>
                <small>TYPE 01</small>
                <h2>정기인사 발령</h2>
                <p>부서 이동이나 직무 변경에 맞춰 담당 업무와 진행 상황을 다음 담당자에게 전달합니다.</p>
              </div>
              <ul><li>담당 업무와 주요 책임</li><li>진행 중인 프로젝트</li><li>협업 관계 및 시스템 권한</li></ul>
              <strong>정기인사 인수인계 시작 <Icon name="arrow" size={16} /></strong>
            </button>
            <button className="handover-type-card leave" onClick={() => onSelect("leave")}>
              <div className="type-card-top"><span><Icon name="clock" size={25} /></span><em>LONG-TERM LEAVE</em></div>
              <div>
                <small>TYPE 02</small>
                <h2>장기휴가</h2>
                <p>장기간 자리를 비우는 동안 업무가 중단되지 않도록 대행자에게 필요한 내용을 전달합니다.</p>
              </div>
              <ul><li>휴가 기간과 업무 대행자</li><li>기간 중 주요 일정</li><li>긴급 상황 대응 방법</li></ul>
              <strong>장기휴가 인수인계 시작 <Icon name="arrow" size={16} /></strong>
            </button>
          </section>
        </div>
      </main>
      {logoutConfirmOpen && <LogoutConfirmModal onCancel={() => setLogoutConfirmOpen(false)} onConfirm={onLogout} />}
    </div>
  );
}
