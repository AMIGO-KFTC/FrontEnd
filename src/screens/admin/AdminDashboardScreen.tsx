// 관리자(팀장) 모드. 구성원·인수인계는 서버(GET /api/admin/members, /api/admin/handovers)에서, 팀 지침·AI 설정은 /api/team-guidelines/me 에서 가져온다.
// '우리 팀'은 관리자 프로필의 소속(부서 + 팀)과 같은 구성원이다. 일반 구성원 계정은 이 화면에 들어올 수 없다(App.tsx).
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { Brand } from "@/shared/Brand";
import { Icon, type IconName } from "@/shared/Icon";
import { useProfile } from "@/shared/profile";
import { hasDocument } from "@/shared/sessions";
import type { AdminSection } from "@/shared/router";
import type { AdminHandover, AdminMember } from "@/shared/types";
import { AdminAiSettingsPage } from "./AdminAiSettingsPage";
import { AdminHandoversPage } from "./AdminHandoversPage";
import { AdminMembersPage } from "./AdminMembersPage";
import { AdminTeamItemsPage } from "./AdminTeamItemsPage";

type Section = AdminSection;
const TITLES: Record<Section, string> = { dashboard: "관리자 대시보드", members: "구성원 관리", handovers: "인수인계 관리", team: "팀 인수인계 항목", ai: "AI 맞춤 설정" };

const WEEK = 7 * 24 * 60 * 60 * 1000;

// 최근 12주 동안 주마다 새로 시작한 인수인계 수(막대 높이는 가장 많은 주를 100 으로 본 비율)
function weeklyActivity(handovers: AdminHandover[]): { counts: number[]; heights: number[] } {
  const now = Date.now();
  const counts = Array.from({ length: 12 }, (_, i) => {
    const end = now - (11 - i) * WEEK;
    const start = end - WEEK;
    return handovers.filter((h) => {
      const t = Date.parse(h.created_at);
      return t > start && t <= end;
    }).length;
  });
  const max = Math.max(1, ...counts);
  return { counts, heights: counts.map((c) => Math.round((c / max) * 100)) };
}

// 보고 있는 탭(section)은 주소(#/admin/<탭>)에 있어, 문서를 열었다 돌아오거나 새로고침해도 같은 탭이 열린다.
type Props = { section: Section; onSection: (section: Section) => void; onExit: () => void; onOpenDocument: (id: string, from: Section) => void; onExpire: () => void };

export function AdminDashboardScreen({ section, onSection: setSection, onExit, onOpenDocument, onExpire }: Props) {
  const [profile] = useProfile();
  const openDocument = (id: string) => onOpenDocument(id, section);
  const [organization, setOrganization] = useState("");
  const [members, setMembers] = useState<AdminMember[] | null>(null);
  const [handovers, setHandovers] = useState<AdminHandover[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([api.adminMembers(), api.adminHandovers()]);
      setOrganization(m.organization);
      setMembers(m.members);
      setHandovers(h.handovers);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onExpire();
        return;
      }
      setMembers(null);
      setHandovers(null);
      setError((e as Error).message);
    }
  }, [onExpire]);
  useEffect(() => {
    void load();
  }, [load]);

  const deleteMember = async (member: AdminMember): Promise<string | null> => {
    try {
      await api.deleteMember(member.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpire();
      return (e as Error).message;
    }
    await load();
    return null;
  };

  const all = handovers ?? [];
  const completed = all.filter(hasDocument);
  const ongoing = all.filter((h) => !hasDocument(h));
  const unavailable = "—";
  const dueSoon = ongoing.filter((h) => h.handover_date && Date.parse(h.handover_date) - Date.now() < 2 * WEEK).length;
  const rate = all.length ? Math.round((completed.length / all.length) * 100) : 0;
  const adminStats = [
    { label: "전체 구성원", value: members ? String(members.length) : unavailable, note: organization || "같은 소속의 구성원", icon: "user" as IconName, tone: "violet" },
    { label: "진행 중인 인수인계", value: handovers ? String(ongoing.length) : unavailable, note: handovers ? `인계 예정일 2주 이내 ${dueSoon}건` : "불러오지 못함", icon: "message" as IconName, tone: "blue" },
    { label: "완료된 인수인계", value: handovers ? String(completed.length) : unavailable, note: handovers ? `완료율 ${rate}%` : "불러오지 못함", icon: "check" as IconName, tone: "green" },
  ];
  const activity = weeklyActivity(all);
  const recentStarted = activity.counts.slice(-4).reduce((a, b) => a + b, 0);
  const recentCompleted = completed.filter((h) => Date.now() - Date.parse(h.updated_at) <= 4 * WEEK).length;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><Brand onClick={onExit} /><span>ADMIN</span></div>
        <div className="admin-workspace-label"><span><Icon name="shield" size={15} /></span><div><small>WORKSPACE</small><strong>{profile.team || "팀"} 관리</strong></div></div>
        <nav className="admin-nav">
          <small>관리 메뉴</small>
          <button className={section === "dashboard" ? "active" : ""} onClick={() => setSection("dashboard")}><Icon name="home" size={16} /> 대시보드</button>
          <button className={section === "members" ? "active" : ""} onClick={() => setSection("members")}><Icon name="user" size={16} /> 구성원 관리 {members && <em>{members.length}</em>}</button>
          <button className={section === "handovers" ? "active" : ""} onClick={() => setSection("handovers")}><Icon name="message" size={16} /> 인수인계 관리 {handovers && <em>{handovers.length}</em>}</button>
          <button className={section === "team" ? "active" : ""} onClick={() => setSection("team")}><Icon name="check" size={16} /> 팀 인수인계 항목</button>
          <button className={section === "ai" ? "active" : ""} onClick={() => setSection("ai")}><Icon name="sparkle" size={16} /> AI 맞춤 설정</button>
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-profile"><span>{profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>{profile.role} · 팀 관리자</small></div></div>
        </div>
      </aside>
      <main className={`admin-main ${section === "handovers" ? "handover-mode" : section === "ai" || section === "team" ? "ai-mode" : ""}`}>
        <header className="admin-header">
          <div><span>ADMIN CONSOLE</span><strong>{TITLES[section]}</strong></div>
          <div>
            <button className="admin-return" onClick={onExit}><Icon name="home" size={14} /> 일반 모드</button>
          </div>
        </header>
        {error && <div className="list-notice error" role="alert">팀 정보를 불러오지 못했어요: {error}<button onClick={() => void load()}>다시 시도</button></div>}
        {section === "dashboard" ? <div className="admin-content">
          <section className="admin-title">
            <div><span><Icon name="shield" size={13} /> TEAM OVERVIEW</span><h1>{profile.team || "팀"}의 인수인계 현황을 한눈에 확인하세요.</h1><p>구성원의 진행 상황과 필요한 관리 항목을 빠르게 살펴볼 수 있습니다.</p></div>
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
                <div className="chart-axis"><span>{Math.max(1, ...activity.counts)}</span><span /><span /><span /><span>0</span></div>
                <div className="chart-bars">
                  {activity.heights.map((height, index) => <div key={index} title={`${activity.counts[index]}건`}><span style={{ height: `${height}%` }} /><small>{index === 11 ? "이번 주" : `${11 - index}주 전`}</small></div>)}
                </div>
              </div>
              <div className="admin-chart-summary"><div><i className="started" /><span>최근 4주 새로 시작</span><strong>{recentStarted}건</strong></div><div><i className="completed" /><span>최근 4주 문서 완성</span><strong>{recentCompleted}건</strong></div><p>주마다 새로 시작한 인수인계 수예요.</p></div>
            </section>
            <section className="admin-panel admin-progress">
              <header><div><span>COMPLETION RATE</span><h2>전체 진행 상태</h2></div></header>
              <div className="progress-donut" style={{ ["--rate" as string]: `${rate}%` }}><div><strong>{rate}%</strong><small>완료율</small></div></div>
              <div className="progress-legend">
                <div><i className="complete" /><span>완료</span><strong>{completed.length}</strong></div>
                <div><i className="ongoing" /><span>진행 중</span><strong>{ongoing.length}</strong></div>
              </div>
            </section>
          </div>
        </div> : section === "members" ? (
          members && handovers ? <AdminMembersPage members={members} handovers={handovers} meId={profile.loginId} onDelete={deleteMember} onOpenDocument={openDocument} /> : null
        ) : section === "handovers" ? (
          handovers ? <AdminHandoversPage handovers={handovers} onOpenDocument={openDocument} /> : null
        ) : section === "team" ? <AdminTeamItemsPage /> : <AdminAiSettingsPage />}
      </main>
    </div>
  );
}
