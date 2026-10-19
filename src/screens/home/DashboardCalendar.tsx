// 홈 캘린더. 일정은 아직 서버와 연결되지 않은 예시이며 앱이 떠 있는 동안만 유지된다.
import { useState } from "react";
import { ExampleBadge } from "@/shared/ExampleBadge";
import { Icon } from "@/shared/Icon";

export function DashboardCalendar() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisYearAppointmentDate = new Date(today.getFullYear(), 9, 28);
  const personnelYear = todayStart.getTime() > thisYearAppointmentDate.getTime() ? today.getFullYear() + 1 : today.getFullYear();
  const announcementDate = new Date(personnelYear, 9, 26);
  const appointmentDate = new Date(personnelYear, 9, 28);
  const announcementKey = `${personnelYear}-10-26`;
  const appointmentKey = `${personnelYear}-10-28`;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const announcementDday = Math.ceil((announcementDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  const appointmentDday = Math.ceil((appointmentDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  const formatDday = (days: number) => days === 0 ? "D-DAY" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [draft, setDraft] = useState("");
  const [events, setEvents] = useState<Record<string, string[]>>({
    "2025-03-14": ["Q1 프로젝트 인수인계"],
    "2025-03-18": ["플랫폼 운영 자료 검토", "박서연님 인수인계 확인"],
    "2025-03-25": ["인수인계 완료 예정"],
    [announcementKey]: ["정기인사 발표일"],
    [appointmentKey]: ["정기인사 발령일"],
  });
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
  const selectedEvents = events[selectedKey] ?? [];
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const moveMonth = (offset: number) => {
    setViewDate(new Date(year, month + offset, 1));
    setSelectedDay(1);
  };
  const addEvent = () => {
    const nextEvent = draft.trim();
    if (!nextEvent) return;
    setEvents((current) => ({ ...current, [selectedKey]: [...(current[selectedKey] ?? []), nextEvent] }));
    setDraft("");
  };
  const removeEvent = (eventIndex: number) => {
    setEvents((current) => ({ ...current, [selectedKey]: (current[selectedKey] ?? []).filter((_, index) => index !== eventIndex) }));
  };

  return (
    <section className="dashboard-calendar">
      <div className="calendar-main">
          <header>
            <div><span>MY SCHEDULE <ExampleBadge /></span><h2>{monthLabel}</h2></div>
            <div>
              <button onClick={() => moveMonth(-1)} aria-label="이전 달"><Icon name="chevron" size={14} /></button>
              <button onClick={() => moveMonth(1)} aria-label="다음 달"><Icon name="chevron" size={14} /></button>
            </div>
          </header>
          <div className="calendar-weekdays">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {cells.map((day, index) => {
              if (!day) return <span className="empty-day" key={`empty-${index}`} />;
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isAnnouncementDay = dateKey === announcementKey;
              const isAppointmentDay = dateKey === appointmentKey;
              const isSpecialDay = isAnnouncementDay || isAppointmentDay;
              const isToday = dateKey === todayKey;
              return (
                <button
                  className={`${day === selectedDay ? "selected" : ""} ${isSpecialDay ? "special-day" : ""} ${isAnnouncementDay ? "announcement-day" : ""} ${isAppointmentDay ? "appointment-day" : ""} ${isToday ? "today" : ""}`}
                  key={dateKey}
                  onClick={() => setSelectedDay(day)}
                  title={isAnnouncementDay ? "정기인사 발표일" : isAppointmentDay ? "정기인사 발령일" : isToday ? "오늘" : undefined}
                >
                  {day}
                  {events[dateKey]?.length ? <i /> : null}
                </button>
              );
            })}
          </div>
      </div>
      <aside className="calendar-agenda">
        <div><span>{selectedKey === todayKey ? "TODAY" : "SELECTED DATE"}</span><strong>{year}년 {month + 1}월 {selectedDay}일</strong></div>
        <div className="personnel-countdowns">
          <div className="personnel-countdown announcement"><small>정기인사 발표</small><strong>{formatDday(announcementDday)}</strong><span>{personnelYear}년 10월 26일</span></div>
          <div className="personnel-countdown appointment"><small>정기인사 발령</small><strong>{formatDday(appointmentDday)}</strong><span>{personnelYear}년 10월 28일</span></div>
        </div>
        <div className="schedule-manager">
          <div className="schedule-items">
            {selectedEvents.length ? selectedEvents.map((event, index) => (
              <div key={`${event}-${index}`}><i /><span>{event}</span><button onClick={() => removeEvent(index)} aria-label={`${event} 삭제`}><Icon name="close" size={11} /></button></div>
            )) : <small>등록된 일정이 없습니다.</small>}
          </div>
          <div className="schedule-add">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addEvent();
              }}
              placeholder="일정 입력"
            />
            <button onClick={addEvent} aria-label="일정 추가"><Icon name="arrow" size={13} /></button>
          </div>
        </div>
      </aside>
    </section>
  );
}
