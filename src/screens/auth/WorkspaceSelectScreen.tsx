// 팀장(관리자) 로그인 뒤의 작업 공간 선택: 내 인수인계를 작성하는 일반 모드 / 팀 구성원과 인수인계를 관리하는 팀 관리 모드.
// 일반 구성원은 이 화면 없이 바로 홈으로 간다. 선택은 로그아웃할 때까지 유지되고, 두 모드 사이는 홈 머리글·관리자 머리글의 단추로 오간다.
import { useState } from "react";
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";
import { LogoutConfirmModal } from "@/shared/LogoutConfirmModal";
import { useProfile } from "@/shared/profile";

export type Workspace = "user" | "admin";

export function WorkspaceSelectScreen({ onSelect, onLogout }: { onSelect: (workspace: Workspace) => void; onLogout: () => void }) {
  const [profile] = useProfile();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const team = profile.team || "우리 팀";

  return (
    <div className="handover-type-page">
      <header className="handover-type-header">
        <Brand />
        <div className="type-header-profile">
          <button className="type-profile-avatar" onClick={() => setLogoutConfirmOpen(true)} aria-label="로그아웃">{profile.name.slice(0, 1)}</button>
        </div>
      </header>
      <main className="handover-type-main">
        <div className="handover-type-content">
          <section className="handover-type-title">
            <h1>{profile.name} {profile.role}님,<br />무엇을 하시겠어요?</h1>
            <p>팀장 계정은 내 인수인계를 작성하는 공간과 {team}을 관리하는 공간을 모두 쓸 수 있어요.</p>
          </section>
          <section className="handover-type-options">
            <button className="handover-type-card personnel" onClick={() => onSelect("user")}>
              <div className="type-card-top"><span><Icon name="user" size={25} /></span></div>
              <div>
                <h2>인수인계 작성</h2>
                <p>내 업무를 다음 담당자에게 전달하거나,<br />전달받은 인수인계를 확인합니다.</p>
              </div>
              <ul><li>새 인수인계 시작 · 이어서 작성</li><li>내가 작성한 문서 확인</li><li>받은 인수인계 열람</li></ul>
              <strong>일반 모드로 들어가기 <Icon name="arrow" size={16} /></strong>
            </button>
            <button className="handover-type-card leave" onClick={() => onSelect("admin")}>
              <div className="type-card-top"><span><Icon name="shield" size={25} /></span></div>
              <div>
                <h2>팀 관리</h2>
                <p>{team} 구성원의 인수인계 현황을 보고,<br />AI 지침을 정합니다.</p>
              </div>
              <ul><li>구성원 관리</li><li>팀 인수인계 현황</li><li>AI 맞춤 설정</li></ul>
              <strong>팀 관리 모드로 들어가기 <Icon name="arrow" size={16} /></strong>
            </button>
          </section>
        </div>
      </main>
      {logoutConfirmOpen && <LogoutConfirmModal onCancel={() => setLogoutConfirmOpen(false)} onConfirm={onLogout} />}
    </div>
  );
}
