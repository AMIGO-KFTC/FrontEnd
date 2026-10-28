// 홈 대시보드. 진행 중·완료 건수는 서버 세션 목록, 받은 인수인계는 GET /api/handovers/received, 알림은 GET /api/notifications 에서 가져온다.
// 알림을 누르면 확인(읽음)으로 바꾸고 받은 인수인계로 간다. 알림마다 지우기, 모두 확인 · 모두 지우기가 있다(상태는 서버에 저장). 캘린더는 shared/planner(이 브라우저의 localStorage)에 저장한다.
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon, type IconName } from "@/shared/Icon";
import { useProfile } from "@/shared/profile";
import { completedSessions, formatRelativeTime, hasDocument, ongoingSessions } from "@/shared/sessions";
import type { AppNotification, NotificationsResult, ReceivedHandover } from "@/shared/types";
import { DashboardCalendar } from "./DashboardCalendar";
import type { HomeNav, SessionList } from "./types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

const NOTIFICATION_LOOK: Record<AppNotification["kind"], { icon: IconName; tone: string }> = { received: { icon: "download", tone: "blue" }, updated: { icon: "file", tone: "violet" }, due: { icon: "calendar", tone: "coral" } };

// 알림 한 줄: 누르면 확인하고 이동, 오른쪽 X 로 지운다
function NotificationRow({ item, onOpen, onDismiss }: { item: AppNotification; onOpen: () => void; onDismiss: () => void }) {
  const look = NOTIFICATION_LOOK[item.kind];
  return (
    <div className={`notification-row${item.read ? " read" : ""}`}>
      <button className="notification-main" onClick={onOpen}>
        <span className={`notification-icon ${look.tone}`}><Icon name={look.icon} size={15} /></span>
        <div><strong>{item.title}</strong><p>{item.text}</p><small>{formatRelativeTime(item.created_at)}{item.read ? " · 확인함" : ""}</small></div>
        {!item.read && <i aria-label="확인 전" />}
      </button>
      <button className="notification-delete" onClick={onDismiss} aria-label="알림 지우기" title="알림 지우기"><Icon name="close" size={12} /></button>
    </div>
  );
}

// 챗봇 카드의 대화 예시: 질문 → 입력 중(점 세 개) → 답변 → 잠시 머문 뒤 다음 예시로 넘어간다
const CHATBOT_DEMO: { question: string; answer: ReactNode; source: string }[] = [
  { question: "재무팀 담당자 연락처가 뭐예요?", answer: <>재무팀 담당자는 <b>박지훈 차장</b>(내선 2345)이에요.</>, source: "재무팀_유지보수대금_요청.eml" },
  { question: "매월 해야 하는 정기업무를 알려 주세요", answer: <>매월 말 <b>홈페이지 점검 보고</b>와 유지보수 대금 요청이 있어요.</>, source: "홈페이지_운영매뉴얼.hwpx" },
  { question: "시스템 권한은 어디서 신청하나요?", answer: <><b>시스템 계정목록</b>의 담당자에게 메일로 신청하면 돼요.</>, source: "시스템_계정목록.xlsx" },
];
type ChatPhase = "ask" | "typing" | "answer" | "out";
const CHAT_PHASE_NEXT: Record<ChatPhase, [ChatPhase, number]> = { ask: ["typing", 800], typing: ["answer", 1500], answer: ["out", 3600], out: ["ask", 450] };
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function ChatbotDemo() {
  const [reduced] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<ChatPhase>(reduced ? "answer" : "ask");
  useEffect(() => {
    if (reduced) return; // 움직임 줄이기 설정이면 첫 예시를 고정해서 보여 준다
    const [next, delay] = CHAT_PHASE_NEXT[phase];
    const timer = window.setTimeout(() => {
      if (next === "ask") setIndex((current) => (current + 1) % CHATBOT_DEMO.length);
      setPhase(next);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);
  const demo = CHATBOT_DEMO[index];
  return (
    <div className={`chatbot-body${phase === "out" ? " is-out" : ""}`} aria-hidden="true">
      <div className="chatbot-examples"><p key={index} className="chatbot-question">{demo.question}</p></div>
      <div className="chatbot-preview">
        {phase === "typing" && <div className="chatbot-typing"><span><Icon name="sparkle" size={13} /></span><span className="typing-dots"><i /><i /><i /></span></div>}
        <div className={`chatbot-answer${phase === "answer" || phase === "out" ? " is-shown" : ""}`}>
          <span><Icon name="sparkle" size={13} /></span>
          <div>
            <p>{demo.answer}</p>
            <em><Icon name="file" size={12} /> 근거 · {demo.source}</em>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = HomeNav & { list: SessionList; notice?: string | null; onDismissNotice?: () => void; onNew: () => void; isAdmin: boolean; onAdmin: () => void };

export function DashboardScreen({ list, notice = null, onDismissNotice, onNew, isAdmin, onAdmin, onLogout, onHome, onHandover, onDocuments, onReceived, onChat, onCalendar, onMaterials }: Props) {
  const [profile] = useProfile();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const [received, setReceived] = useState<ReceivedHandover[] | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  useEffect(() => {
    api
      .receivedHandovers()
      .then(({ handovers }) => setReceived(handovers))
      .catch(() => setReceived(null));
    api
      .notifications()
      .then((result) => setNotifications(result.notifications))
      .catch(() => setNotifications([]));
  }, []);
  // 화면을 먼저 바꾸고(낙관적 갱신) 서버 응답으로 맞춘다. 실패하면 서버 목록을 다시 불러온다.
  const syncNotifications = (request: Promise<NotificationsResult>) => {
    setNotificationError(null);
    request
      .then((result) => setNotifications(result.notifications))
      .catch((e: Error) => {
        setNotificationError(e.message);
        api.notifications().then((result) => setNotifications(result.notifications)).catch(() => undefined);
      });
  };
  const openNotification = (item: AppNotification) => {
    setNotificationsOpen(false);
    setAllNotificationsOpen(false);
    if (!item.read) {
      setNotifications((current) => current.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      syncNotifications(api.readNotifications([item.id]));
    }
    if (item.kind === "due") onCalendar(); // 마감 임박은 캘린더로, 인수인계서 알림은 받은 인수인계로
    else onReceived();
  };
  const dismissNotification = (item: AppNotification) => {
    setNotifications((current) => current.filter((n) => n.id !== item.id));
    syncNotifications(api.dismissNotifications([item.id]));
  };
  const readAllNotifications = () => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    syncNotifications(api.readNotifications(null));
  };
  const dismissAllNotifications = () => {
    setNotifications([]);
    syncNotifications(api.dismissNotifications(null));
  };
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
  const askable = (completed?.length ?? 0) + (received?.filter(hasDocument).length ?? 0); // 챗봇에 물어볼 수 있는 문서(내 완성 문서 + 받은 인수인계서)
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="app-shell dashboard-page">
      <AppSidebar active="home" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} onCalendar={onCalendar} onMaterials={onMaterials} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            
            <strong>홈</strong>
          </div>
          <div className="dashboard-header-actions">
            {isAdmin && <button className="admin-mode-entry" onClick={onAdmin}><Icon name="shield" size={14} /> 팀 관리 모드</button>}
            <button className="header-icon-button" title={unread ? `확인 안 한 알림 ${unread}건` : "알림"} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((current) => !current)}><Icon name="bell" size={16} />{unread > 0 && <i />}</button>
            {notificationsOpen && (
              <div className="notification-popover">
                <header>
                  <div><strong>새로운 알림{unread > 0 ? ` ${unread}` : ""}</strong></div>
                  <div className="notification-header-actions">
                    {unread > 0 && <button className="notification-read-all" onClick={readAllNotifications}>모두 확인</button>}
                    <button onClick={() => setNotificationsOpen(false)} aria-label="알림 닫기"><Icon name="close" size={14} /></button>
                  </div>
                </header>
                <div className="notification-list">
                  {notifications.slice(0, 3).map((item) => <NotificationRow key={item.id} item={item} onOpen={() => openNotification(item)} onDismiss={() => dismissNotification(item)} />)}
                  {!notifications.length && <div className="list-notice">새 알림이 없어요.</div>}
                  {notificationError && <p className="notification-error" role="alert">{notificationError}</p>}
                </div>
                <footer><button onClick={() => { setNotificationsOpen(false); setAllNotificationsOpen(true); }}>모든 알림 보기{notifications.length > 3 ? ` (${notifications.length})` : ""}</button></footer>
              </div>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-welcome">
            <div>
              <span className="dashboard-kicker"><Icon name="sparkle" size={13} /> {profile.name ? `${profile.name}님, ` : ""}{greeting()}</span>
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
          <div className="dashboard-bottom">
            <DashboardCalendar onOpenCalendar={onCalendar} />
            <section className="dashboard-chatbot" aria-labelledby="dashboard-chatbot-title">
              <header>
                <span className="chatbot-icon"><Icon name="sparkle" size={18} /></span>
                <div><h2 id="dashboard-chatbot-title">인수인계서 챗봇</h2><p>완성한 문서와 전달받은 인수인계서를 근거로 답해 드려요.</p></div>
                {askable > 0 && <em>문서 {askable}건</em>}
              </header>
              <ChatbotDemo />
              <button className="chatbot-open" onClick={() => onChat()}>챗봇으로 물어보기 <Icon name="arrow" size={15} /></button>
            </section>
          </div>
        </div>
      </main>
      {allNotificationsOpen && (
        <div className="all-notifications-overlay" role="presentation" onClick={() => setAllNotificationsOpen(false)}>
          <section className="all-notifications-modal" role="dialog" aria-modal="true" aria-labelledby="all-notifications-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><h2 id="all-notifications-title">전체 알림</h2><p>업무와 인수인계 관련 소식을 확인하세요.{unread > 0 ? ` 확인 안 한 알림 ${unread}건` : ""}</p></div>
              <button onClick={() => setAllNotificationsOpen(false)} aria-label="전체 알림 닫기"><Icon name="close" size={17} /></button>
            </header>
            {notifications.length > 0 && (
              <div className="all-notifications-actions">
                <button onClick={readAllNotifications} disabled={unread === 0}><Icon name="check" size={13} /> 모두 확인</button>
                <button onClick={dismissAllNotifications}><Icon name="close" size={13} /> 모두 지우기</button>
              </div>
            )}
            <div className="all-notifications-list">
              {notifications.map((item) => <NotificationRow key={item.id} item={item} onOpen={() => openNotification(item)} onDismiss={() => dismissNotification(item)} />)}
              {!notifications.length && <div className="list-notice">아직 알림이 없어요.</div>}
              {notificationError && <p className="notification-error" role="alert">{notificationError}</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
