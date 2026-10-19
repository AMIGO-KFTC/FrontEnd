import { useState } from "react";
import Brand from "@/components/Brand";
import Icon, { type IconName } from "@/components/Icon";
import AdminAiSettingsPage from "@/screens/admin/AdminAiSettingsPage";
import AdminHandoversPage from "@/screens/admin/AdminHandoversPage";
import { initialAdminMembers } from "@/screens/admin/adminMembers";
import AdminMembersPage from "@/screens/admin/AdminMembersPage";

export default function AdminDashboardScreen({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<"dashboard" | "members" | "handovers" | "ai">("dashboard");
  const [members, setMembers] = useState(initialAdminMembers);
  const adminStats = [
    { label: "전체 구성원", value: String(members.length), note: "현재 등록된 구성원", icon: "user" as IconName, tone: "violet" },
    { label: "진행 중인 인수인계", value: "24", note: "기한 임박 5건", icon: "message" as IconName, tone: "blue" },
    { label: "완료된 인수인계", value: "186", note: "완료율 92%", icon: "check" as IconName, tone: "green" },
  ];
  const activity = [42, 58, 47, 72, 64, 88, 76, 93, 81, 100, 86, 95];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><Brand /><span>ADMIN</span></div>
        <div className="admin-workspace-label"><span><Icon name="shield" size={15} /></span><div><small>WORKSPACE</small><strong>AMIGO 관리자</strong></div></div>
        <nav className="admin-nav">
          <small>관리 메뉴</small>
          <button className={section === "dashboard" ? "active" : ""} onClick={() => setSection("dashboard")}><Icon name="home" size={16} /> 대시보드</button>
          <button className={section === "members" ? "active" : ""} onClick={() => setSection("members")}><Icon name="user" size={16} /> 구성원 관리 <em>{members.length}</em></button>
          <button className={section === "handovers" ? "active" : ""} onClick={() => setSection("handovers")}><Icon name="message" size={16} /> 인수인계 관리 <em>24</em></button>
          <button className={section === "ai" ? "active" : ""} onClick={() => setSection("ai")}><Icon name="sparkle" size={16} /> AI 맞춤 설정</button>
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-profile"><span>김</span><div><strong>김민준</strong><small>최고 관리자</small></div></div>
        </div>
      </aside>
      <main className={`admin-main ${section === "handovers" ? "handover-mode" : section === "ai" ? "ai-mode" : ""}`}>
        <header className="admin-header">
          <div><span>ADMIN CONSOLE</span><strong>{section === "dashboard" ? "관리자 대시보드" : section === "members" ? "구성원 관리" : section === "handovers" ? "인수인계 관리" : "AI 맞춤 설정"}</strong></div>
          <div>
            <button className="admin-return" onClick={onExit}><Icon name="home" size={14} /> 일반 모드</button>
          </div>
        </header>
        {section === "dashboard" ? <div className="admin-content">
          <section className="admin-title">
            <div><span><Icon name="shield" size={13} /> TEAM OVERVIEW</span><h1>팀의 인수인계 현황을 한눈에 확인하세요.</h1><p>구성원의 진행 상황과 필요한 관리 항목을 빠르게 살펴볼 수 있습니다.</p></div>
          </section>
          <section className="admin-stats">
            {adminStats.map((stat) => (
              <article key={stat.label}>
                <span className={`admin-stat-icon ${stat.tone}`}><Icon name={stat.icon} size={18} /></span>
                <div><small>{stat.label}</small><strong>{stat.value}</strong><p>{stat.note}</p></div>
              </article>
            ))}
          </section>
          <div className="admin-grid">
            <section className="admin-panel admin-activity">
              <header><div><span>HANDOVER ACTIVITY</span><h2>인수인계 활동 추이</h2></div></header>
              <div className="admin-chart">
                <div className="chart-axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
                <div className="chart-bars">
                  {activity.map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{index + 1}주</small></div>)}
                </div>
              </div>
              <div className="admin-chart-summary"><div><i className="started" /><span>새로 시작</span><strong>38건</strong></div><div><i className="completed" /><span>완료</span><strong>31건</strong></div><p>지난달 대비 <strong>12.4%</strong> 증가했어요.</p></div>
            </section>
            <section className="admin-panel admin-progress">
              <header><div><span>COMPLETION RATE</span><h2>전체 진행 상태</h2></div><Icon name="more" size={17} /></header>
              <div className="progress-donut"><div><strong>92%</strong><small>완료율</small></div></div>
              <div className="progress-legend">
                <div><i className="complete" /><span>완료</span><strong>186</strong></div>
                <div><i className="ongoing" /><span>진행 중</span><strong>24</strong></div>
              </div>
            </section>
          </div>
        </div> : section === "members" ? <AdminMembersPage members={members} onDelete={(id) => setMembers((current) => current.filter((member) => member.id !== id))} /> : section === "handovers" ? <AdminHandoversPage /> : <AdminAiSettingsPage />}
      </main>
    </div>
  );
}
