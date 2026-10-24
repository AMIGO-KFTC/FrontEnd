// 홈 대시보드. 진행 중·완료 건수는 서버 세션 목록, 받은 인수인계와 알림은 GET /api/handovers/received 에서 가져온다. 캘린더는 아직 화면 안의 값이다.
import { useEffect, useState } from "react";
import { api } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon, type IconName } from "@/shared/Icon";
import { useProfile } from "@/shared/profile";
import { completedSessions, formatRelativeTime, hasDocument, ongoingSessions } from "@/shared/sessions";
import type { ReceivedHandover } from "@/shared/types";
import { DashboardCalendar } from "./DashboardCalendar";
import type { HomeNav, SessionList } from "./types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

type Notification = { icon: IconName; tone: string; title: string; text: string; time: string; unread: boolean; onClick?: () => void };

// 받은 인수인계를 알림으로 보여 준다: 문서가 나온 건은 '확인 필요', 아직이면 '인계자가 작성 중'
function notificationsFrom(received: ReceivedHandover[], onReceived: () => void): Notification[] {
  return received.map((handover) => ({
    icon: hasDocument(handover) ? "file" : "download",
    tone: hasDocument(handover) ? "blue" : "violet",
    title: hasDocument(handover) ? "인수인계서가 완성됐어요" : "새 인수인계가 도착했어요",
    text: `${handover.owner_name}님이 ‘${handover.task_name || handover.title}’ 업무를 ${hasDocument(handover) ? "정리했습니다. 문서를 확인해 주세요." : "전달하고 있습니다."}`,
    time: formatRelativeTime(handover.updated_at),
    unread: hasDocument(handover),
    onClick: onReceived,
  }));
}

type Props = HomeNav & { list: SessionList; notice?: string | null; onDismissNotice?: () => void; onNew: () => void; isAdmin: boolean; onAdmin: () => void };

export function DashboardScreen({ list, notice = null, onDismissNotice, onNew, isAdmin, onAdmin, onLogout, onHome, onHandover, onDocuments, onReceived, onChat }: Props) {
  const [profile] = useProfile();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const [received, setReceived] = useState<ReceivedHandover[] | null>(null);
  useEffect(() => {
    api
      .receivedHandovers()
      .then(({ handovers }) => setReceived(handovers))
      .catch(() => setReceived(null));
  }, []);
  const ongoing = list.sessions ? ongoingSessions(list.sessions) : null;
  const completed = list.sessions ? completedSessions(list.sessions) : null;
  const unavailable = "불러오지 못함";
  const receivedReady = received ? received.filter(hasDocument).length : 0;
  const stats = [
    {
      label: "진행 중인 인수인계",
      value: ongoing ? String(ongoing.length) : unavailable,
      note: ongoing ? (ongoing[0] ? `최근 수정 ${formatRelativeTime(ongoing[0].updated_at)}` : "진행 중인 작업이 없어요") : "목록을 불러오지 못했어요",
      icon: "message" as IconName,
      tone: "violet",
      onClick: onHandover,
    },
    {
      label: "완료한 인수인계",
      value: completed ? String(completed.length) : unavailable,
      note: completed ? (completed[0] ? `최근 완성 ${formatRelativeTime(completed[0].updated_at)}` : "완성된 문서가 아직 없어요") : "목록을 불러오지 못했어요",
      icon: "check" as IconName,
      tone: "green",
      onClick: onDocuments,
    },
    {
      label: "받은 인수인계",
      value: received ? String(received.length) : unavailable,
      note: received ? (received.length ? `확인 필요 ${receivedReady}건 · 작성 중 ${received.length - receivedReady}건` : "받은 인수인계가 없어요") : "목록을 불러오지 못했어요",
      icon: "download" as IconName,
      tone: "blue",
      onClick: onReceived,
    },
  ];
  const notifications = notificationsFrom(received ?? [], onReceived);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="app-shell dashboard-page">
      <AppSidebar active="home" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span>MY WORKSPACE</span>
            <strong>홈</strong>
          </div>
          <div className="dashboard-header-actions">
            {isAdmin && <button className="admin-mode-entry" onClick={onAdmin}><Icon name="shield" size={14} /> 팀 관리 모드</button>}
            <button className="header-icon-button" title="알림" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((current) => !current)}><Icon name="bell" size={16} />{unread > 0 && <i />}</button>
            {notificationsOpen && (
              <div className="notification-popover">
                <header><div><span>NOTIFICATIONS</span><strong>새로운 알림</strong></div><button onClick={() => setNotificationsOpen(false)} aria-label="알림 닫기"><Icon name="close" size={14} /></button></header>
                <div className="notification-list">
                  {notifications.slice(0, 3).map((notification) => (
                    <button key={notification.title + notification.text} onClick={notification.onClick}>
                      <span className={`notification-icon ${notification.tone}`}><Icon name={notification.icon} size={15} /></span>
                      <div><strong>{notification.title}</strong><p>{notification.text}</p><small>{notification.time}</small></div>
                      {notification.unread && <i />}
                    </button>
                  ))}
                  {!notifications.length && <div className="list-notice">새 알림이 없어요.</div>}
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
              <button type="button" className="dashboard-stat clickable" key={stat.label} onClick={stat.onClick}>
                <span className={`stat-icon ${stat.tone}`}><Icon name={stat.icon} size={17} /></span>
                <div><small>{stat.label}</small><strong className={stat.value === unavailable ? "unavailable" : ""}>{stat.value}</strong><p>{stat.note}</p></div>
              </button>
            ))}
            {notice && (
              <div className="list-notice" role="status">
                {notice}
                {onDismissNotice && <button onClick={onDismissNotice}>닫기</button>}
              </div>
            )}
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
              {notifications.map((notification) => (
                <button key={notification.title + notification.text} onClick={() => { setAllNotificationsOpen(false); notification.onClick?.(); }}>
                  <span className={`notification-icon ${notification.tone}`}><Icon name={notification.icon} size={15} /></span>
                  <div><strong>{notification.title}</strong><p>{notification.text}</p><small>{notification.time}</small></div>
                  {notification.unread && <i />}
                </button>
              ))}
              {!notifications.length && <div className="list-notice">아직 알림이 없어요.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
