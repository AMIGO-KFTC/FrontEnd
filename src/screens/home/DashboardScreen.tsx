// 홈 대시보드. 진행 중·완료 건수는 서버 세션 목록에서 가져온다. 받은 인수인계·알림·캘린더는 아직 서버와 연결되지 않았다.
import { useState } from "react";
import { ADMIN_PREVIEW } from "@/shared/adminPreview";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon, type IconName } from "@/shared/Icon";
import { useProfile } from "@/shared/profile";
import { completedSessions, formatRelativeTime, ongoingSessions } from "@/shared/sessions";
import { DashboardCalendar } from "./DashboardCalendar";
import type { HomeNav, SessionList } from "./types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

type Props = HomeNav & { list: SessionList; onNew: () => void; onAdmin: () => void };

export function DashboardScreen({ list, onNew, onAdmin, onLogout, onHome, onHandover, onDocuments, onReceived }: Props) {
  const [profile] = useProfile();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const ongoing = list.sessions ? ongoingSessions(list.sessions) : null;
  const completed = list.sessions ? completedSessions(list.sessions) : null;
  const unavailable = "불러오지 못함";
  const stats = [
    {
      label: "진행 중인 인수인계",
      value: ongoing ? String(ongoing.length) : unavailable,
      note: ongoing ? (ongoing[0] ? `최근 수정 ${formatRelativeTime(ongoing[0].updated_at)}` : "진행 중인 작업이 없어요") : "목록을 불러오지 못했어요",
      icon: "message" as IconName,
      tone: "violet",
    },
    {
      label: "완료한 인수인계",
      value: completed ? String(completed.length) : unavailable,
      note: completed ? (completed[0] ? `최근 완성 ${formatRelativeTime(completed[0].updated_at)}` : "완성된 문서가 아직 없어요") : "목록을 불러오지 못했어요",
      icon: "check" as IconName,
      tone: "green",
    },
    { label: "받은 인수인계", value: "3", note: "확인 필요 1건", icon: "download" as IconName, tone: "blue" },
  ];
  return (
    <div className="app-shell dashboard-page">
      <AppSidebar active="home" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span>MY WORKSPACE</span>
            <strong>홈</strong>
          </div>
          <div className="dashboard-header-actions">
            {ADMIN_PREVIEW && <button className="admin-mode-entry" onClick={onAdmin}><Icon name="shield" size={14} /> 관리자 모드 (미리보기)</button>}
            <button className="header-icon-button" title="알림" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((current) => !current)}><Icon name="bell" size={16} /><i /></button>
            {notificationsOpen && (
              <div className="notification-popover">
                <header><div><span>NOTIFICATIONS</span><strong>새로운 알림</strong></div><button onClick={() => setNotificationsOpen(false)} aria-label="알림 닫기"><Icon name="close" size={14} /></button></header>
                <div className="notification-list">
                  <button onClick={onReceived}>
                    <span className="notification-icon violet"><Icon name="download" size={15} /></span>
                    <div><strong>새 인수인계가 도착했어요</strong><p>박서연님이 ‘B2B 플랫폼 운영 업무’를 전달했습니다.</p><small>방금 전</small></div>
                    <i />
                  </button>
                  <button>
                    <span className="notification-icon coral"><Icon name="bell" size={15} /></span>
                    <div><strong>정기인사 발표일이 다가오고 있어요</strong><p>10월 26일 일정을 확인해 주세요.</p><small>1시간 전</small></div>
                    <i />
                  </button>
                  <button>
                    <span className="notification-icon blue"><Icon name="file" size={15} /></span>
                    <div><strong>문서 생성이 완료됐어요</strong><p>플랫폼 운영 인수인계서를 확인할 수 있습니다.</p><small>어제</small></div>
                  </button>
                </div>
                <footer><button onClick={() => { setNotificationsOpen(false); setAllNotificationsOpen(true); }}>모든 알림 확인</button></footer>
              </div>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-welcome">
            <div>
              <span className="dashboard-kicker"><Icon name="sparkle" size={13} /> {greeting()}, {profile.name || "AMIGO"}</span>
              <h1>업무의 다음을<br />준비해 볼까요?</h1>
              <p>흩어진 자료와 경험을 AMIGO가 빈틈없는 인수인계서로 정리해 드려요.</p>
              <button className="dashboard-start" onClick={onNew}>새 인수인계 시작하기 <Icon name="arrow" size={17} /></button>
            </div>
            <div className="dashboard-orbit" aria-hidden="true">
              <span><Icon name="sparkle" size={28} /></span>
              <i />
              <i />
              <i />
            </div>
          </section>

          <section className="dashboard-stats">
            {stats.map((stat) => (
              <article className="dashboard-stat" key={stat.label}>
                <span className={`stat-icon ${stat.tone}`}><Icon name={stat.icon} size={17} /></span>
                <div><small>{stat.label}</small><strong className={stat.value === unavailable ? "unavailable" : ""}>{stat.value}</strong><p>{stat.note}</p></div>
              </article>
            ))}
            {list.error && (
              <div className="list-notice error" role="alert">
                작업 목록을 불러오지 못했어요: {list.error}
                <button onClick={list.reload}>다시 시도</button>
              </div>
            )}
          </section>
          <DashboardCalendar />
        </div>
      </main>
      {allNotificationsOpen && (
        <div className="all-notifications-overlay" role="presentation" onClick={() => setAllNotificationsOpen(false)}>
          <section className="all-notifications-modal" role="dialog" aria-modal="true" aria-labelledby="all-notifications-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>NOTIFICATIONS</span><h2 id="all-notifications-title">전체 알림</h2><p>업무와 인수인계 관련 소식을 확인하세요.</p></div>
              <button onClick={() => setAllNotificationsOpen(false)} aria-label="전체 알림 닫기"><Icon name="close" size={17} /></button>
            </header>
            <div className="all-notifications-list">
              {[
                { icon: "download" as IconName, tone: "violet", title: "새 인수인계가 도착했어요", text: "박서연님이 ‘B2B 플랫폼 운영 업무’를 전달했습니다.", time: "방금 전", unread: true },
                { icon: "bell" as IconName, tone: "coral", title: "정기인사 발표일이 다가오고 있어요", text: "10월 26일 일정을 확인해 주세요.", time: "1시간 전", unread: true },
                { icon: "file" as IconName, tone: "blue", title: "문서 생성이 완료됐어요", text: "플랫폼 운영 인수인계서를 확인할 수 있습니다.", time: "어제", unread: true },
                { icon: "message" as IconName, tone: "violet", title: "확인 질문에 답변이 추가됐어요", text: "이지윤님이 장애 대응 담당자 정보를 보완했습니다.", time: "2일 전", unread: false },
                { icon: "check" as IconName, tone: "green", title: "인수인계 확인이 완료됐어요", text: "고객 대응 및 VOC 관리 인수인계가 열람 완료됐습니다.", time: "3일 전", unread: false },
              ].map((notification) => (
                <button key={notification.title} onClick={notification.icon === "download" ? onReceived : undefined}>
                  <span className={`notification-icon ${notification.tone}`}><Icon name={notification.icon} size={15} /></span>
                  <div><strong>{notification.title}</strong><p>{notification.text}</p><small>{notification.time}</small></div>
                  {notification.unread && <i />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
