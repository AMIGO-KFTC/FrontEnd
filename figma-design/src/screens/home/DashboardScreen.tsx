import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Icon, { type IconName } from "@/components/Icon";
import DashboardCalendar from "@/screens/home/DashboardCalendar";
import { useOngoingDrafts } from "@/store/AppStore";

export default function DashboardScreen({ onNew, onLogout, onHandover, onDocuments, onReceived, onAdmin }: { onNew: () => void; onLogout: () => void; onHandover: () => void; onDocuments: () => void; onReceived: () => void; onAdmin: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const ongoingCount = useOngoingDrafts().length;
  const stats = [
    { label: "진행 중인 인수인계", value: String(ongoingCount), note: "이번 주 1건 업데이트", icon: "message" as IconName, tone: "violet" },
    { label: "완료한 인수인계", value: "12", note: "지난달보다 3건 증가", icon: "check" as IconName, tone: "green" },
    { label: "받은 인수인계", value: "3", note: "확인 필요 1건", icon: "download" as IconName, tone: "blue" },
  ];
  return (
    <div className="app-shell dashboard-page">
      <AppSidebar active="home" onLogout={onLogout} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span>MY WORKSPACE</span>
            <strong>홈</strong>
          </div>
          <div className="dashboard-header-actions">
            <button className="admin-mode-entry" onClick={onAdmin}><Icon name="shield" size={14} /> 관리자 모드</button>
            <button className="header-icon-button" title="알림" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((current) => !current)}><Icon name="bell" size={16} /><i /></button>
            <button className="header-icon-button" title="메신저"><Icon name="message" size={16} /></button>
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
              <span className="dashboard-kicker"><Icon name="sparkle" size={13} /> GOOD MORNING, MINJUN</span>
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
                <div><small>{stat.label}</small><strong>{stat.value}</strong><p>{stat.note}</p></div>
              </article>
            ))}
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
