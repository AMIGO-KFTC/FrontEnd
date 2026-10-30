// 홈 캘린더. 일정은 왼쪽 탭의 '캘린더' 화면과 같은 저장소(shared/planner, 계정별 서버 저장)를 쓴다.
// 정기인사 D-day 와 발표일·발령일, 팀 공유 일정 표시는 팀장이 등록한 일정(shared/personnel)에서. 정기인사가 없으면 매년 1/26 · 2/1 기본값.
// 오른쪽에는 고른 날짜(처음엔 오늘)의 일정과 할 일만 보여 준다. 홈에서는 입력하지 않는다(추가는 '캘린더' 화면).
// 항목을 누르면 캘린더 화면에서 남긴 메모가 아래에 펼쳐지고, 네모를 누르면 완료/되돌리기.
import { useState } from "react";
import { Icon } from "@/shared/Icon";
import { longDate, personnelView, usePersonnel } from "@/shared/personnel";
import { dateKey, formatDday, usePlanner } from "@/shared/planner";

export function DashboardCalendar({ onOpenCalendar }: { onOpenCalendar?: () => void }) {
  const today = new Date();
  const { schedules, teamSchedules } = usePersonnel();
  const personnel = personnelView(today, schedules, teamSchedules);
  const markOn = (key: string) => personnel.marks.filter((mark) => mark.key === key);
  const todayKey = dateKey(today);
  const { eventItems, todos, setDone } = usePlanner();
  const [openMemo, setOpenMemo] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedKey = dateKey(new Date(year, month, selectedDay));
  const fixedEvents = markOn(selectedKey);
  const selectedEvents = eventItems.filter((event) => event.date === selectedKey);
  const selectedTodos = todos.filter((todo) => todo.date === selectedKey);
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const moveMonth = (offset: number) => {
    setViewDate(new Date(year, month + offset, 1));
    setSelectedDay(1);
  };

  return (
    <section className="dashboard-calendar">
      <div className="calendar-main">
          <header>
            <div><h2>{monthLabel}</h2></div>
            <div>
              {onOpenCalendar && <button className="calendar-open" onClick={onOpenCalendar} aria-label="캘린더 크게 보기" title="캘린더 · 할 일"><Icon name="calendar" size={13} /></button>}
              <button onClick={() => moveMonth(-1)} aria-label="이전 달"><Icon name="chevron" size={14} /></button>
              <button onClick={() => moveMonth(1)} aria-label="다음 달"><Icon name="chevron" size={14} /></button>
            </div>
          </header>
          <div className="calendar-weekdays">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {cells.map((day, index) => {
              if (!day) return <span className="empty-day" key={`empty-${index}`} />;
              const key = dateKey(new Date(year, month, day));
              const marks = markOn(key);
              const isAnnouncementDay = marks.some((mark) => mark.kind === "announcement");
              const isAppointmentDay = marks.some((mark) => mark.kind === "appointment");
              const isSpecialDay = isAnnouncementDay || isAppointmentDay;
              const isToday = key === todayKey;
              // 점: 안 한 일정·할 일이 있으면 진하게, 다 한 일만 있으면 흐리게(지우지 않는다)
              const dayEvents = eventItems.filter((event) => event.date === key);
              const dayTodos = todos.filter((todo) => todo.date === key);
              const hasOpen = dayEvents.some((event) => !event.done) || dayTodos.some((todo) => !todo.done) || marks.some((mark) => mark.kind === "shared");
              const hasItems = hasOpen || dayEvents.length > 0 || dayTodos.length > 0;
              return (
                <button
                  className={`${day === selectedDay ? "selected" : ""} ${isSpecialDay ? "special-day" : ""} ${isAnnouncementDay ? "announcement-day" : ""} ${isAppointmentDay ? "appointment-day" : ""} ${isToday ? "today" : ""}`}
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  title={marks.length ? marks.map((mark) => mark.label).join(", ") : isToday ? "오늘" : undefined}
                >
                  {day}
                  {hasItems ? <i className={hasOpen ? "" : "faded"} /> : null}
                </button>
              );
            })}
          </div>
      </div>
      <aside className="calendar-agenda">
        <div><span>{selectedKey === todayKey ? "오늘" : "선택한 날짜"}</span><strong>{year}년 {month + 1}월 {selectedDay}일</strong></div>
        <div className="personnel-countdowns">
          {personnel.next ? (
            <>
              {personnel.next.announce && <div className="personnel-countdown announcement" title={personnel.next.name}><small>{personnel.next.name} 발표</small><strong>{formatDday(personnel.next.announce.dday)}</strong><span>{longDate(personnel.next.announce.key)}</span></div>}
              <div className="personnel-countdown appointment" title={personnel.next.name}><small>{personnel.next.name} 발령</small><strong>{formatDday(personnel.next.appoint.dday)}</strong><span>{longDate(personnel.next.appoint.key)}</span></div>
            </>
          ) : null}
        </div>
        <div className="schedule-manager">
          <div className="schedule-items">
            {fixedEvents.map((mark, index) => <div key={`${mark.label}-${index}`} className={mark.kind === "shared" ? "shared-mark" : "personnel-mark"}><i /><span>{mark.label}</span></div>)}
            {[
              ...selectedEvents.map((event) => ({ key: `event:${event.id}`, kind: "event" as const, id: event.id, text: event.text, memo: event.memo ?? "", done: Boolean(event.done) })),
              ...selectedTodos.map((todo) => ({ key: `todo:${todo.id}`, kind: "todo" as const, id: todo.id, text: todo.text, memo: todo.memo ?? "", done: todo.done })),
            ].map((item) => (
              <div key={item.key} className={`schedule-check${item.done ? " done" : ""}${openMemo === item.key ? " open" : ""}`}>
                <div className="schedule-check-line">
                  <button className="month-todo-check" onClick={() => setDone(item.kind, item.id, !item.done)} aria-label={item.done ? `${item.text} 되돌리기` : `${item.text} 완료`} title={item.done ? "되돌리기" : "완료"}>{item.done && <Icon name="check" size={9} />}</button>
                  <button className="schedule-check-text" onClick={() => setOpenMemo(openMemo === item.key ? null : item.key)} title={item.memo ? "눌러서 메모 보기" : "메모 없음"}>
                    <span>{item.text}</span>{item.memo && openMemo !== item.key && <i className="check-memo-mark" aria-label="메모 있음" />}
                  </button>
                </div>
                {openMemo === item.key && <p className="schedule-memo">{item.memo || "메모가 없어요. 캘린더 화면에서 남길 수 있어요."}</p>}
              </div>
            ))}
            {!fixedEvents.length && !selectedEvents.length && !selectedTodos.length && <small>{selectedKey === todayKey ? "오늘" : "이 날"}은 일정이 없어요.</small>}
          </div>
        </div>
      </aside>
    </section>
  );
}
