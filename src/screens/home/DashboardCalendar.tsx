// 홈 캘린더. 일정은 왼쪽 탭의 '캘린더' 화면과 같은 저장소(shared/planner, 계정별 서버 저장)를 쓴다.
// 정기인사 D-day 와 발표일·발령일, 팀 공유 일정 표시는 팀장이 등록한 일정(shared/personnel)에서. 정기인사가 없으면 매년 10/26 · 10/28 기본값.
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
  const { events, addEvent: saveEvent, removeEvent: deleteEvent } = usePlanner();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [draft, setDraft] = useState("");
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedKey = dateKey(new Date(year, month, selectedDay));
  const fixedEvents = markOn(selectedKey);
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
    saveEvent(selectedKey, nextEvent);
    setDraft("");
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
              const hasItems = Boolean(events[key]?.length) || marks.some((mark) => mark.kind === "shared");
              return (
                <button
                  className={`${day === selectedDay ? "selected" : ""} ${isSpecialDay ? "special-day" : ""} ${isAnnouncementDay ? "announcement-day" : ""} ${isAppointmentDay ? "appointment-day" : ""} ${isToday ? "today" : ""}`}
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  title={marks.length ? marks.map((mark) => mark.label).join(", ") : isToday ? "오늘" : undefined}
                >
                  {day}
                  {hasItems ? <i /> : null}
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
            {selectedEvents.map((event, index) => (
              <div key={`${event}-${index}`}><i /><span>{event}</span><button onClick={() => deleteEvent(selectedKey, index)} aria-label={`${event} 삭제`}><Icon name="close" size={11} /></button></div>
            ))}
          </div>
          <div className="schedule-add">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) addEvent(); // 한글 조합 중 Enter 는 글자 확정이라 무시한다
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
