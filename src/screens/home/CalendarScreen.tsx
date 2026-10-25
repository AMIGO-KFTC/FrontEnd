// 캘린더(#/home/calendar). 달력에서 날짜를 골라 일정을 적고, 받은 인수인계서의 일정과 정기 업무를 한 화면에서 본다.
// 오른쪽(MonthAgenda)은 보고 있는 달에 해야 할 일: 주별 → 날짜별, 그 달 전체, 다 한 일. 달력에서 날짜·주를 누르면 그 자리로 옮기고 거기에 추가한다.
// 값은 shared/planner(계정별로 서버 /api/planner 에 저장)에 있고 홈 대시보드의 캘린더와 같이 쓴다.
// "받은 인수인계서 적용하기"를 누르면 날짜가 정해진 일(마감일 등)은 달력 일정으로, 반복하는 일은 정기 업무로 들어온다.
// - 매주 하는 일: 달력 왼쪽 '주간 업무' 칸에 주(N째주)마다. 칸을 누르면 오른쪽에서 그 주에만 할 일(주간 업무)을 적을 수 있다
// - 매월·매일·수시 업무와 그 달에 해당하는 분기·반기·매년 업무: 오른쪽 'N월에 해야 할 일'의 'N월 전체' 칸
import { useRef, useState } from "react";
import { api } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon } from "@/shared/Icon";
import { personnelView, usePersonnel } from "@/shared/personnel";
import { dateKey, formatDday, usePlanner } from "@/shared/planner";
import { formatRelativeTime, hasDocument } from "@/shared/sessions";
import type { PlannerRoutine, ReceivedHandover } from "@/shared/types";
import { MonthAgenda } from "./MonthAgenda";
import type { HomeNav, SessionList } from "./types";

type Props = HomeNav & { list: SessionList };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function shortDate(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${month}/${day}`;
}

// 매주 업무의 요일("매주 월요일 오전" → "월")
function weekdaysOf(timing: string): string {
  return [...new Set([...timing.matchAll(/([월화수목금토일])\s*요일/g)].map((m) => m[1]))].join("·");
}

// "2026-10-25" 가 일요일인 주 → "10/25 ~ 10/31"
function weekRange(week: string): string {
  const [year, month, day] = week.split("-").map(Number);
  return `${shortDate(week)} ~ ${shortDate(dateKey(new Date(year, month - 1, day + 6)))}`;
}

export function CalendarScreen({ list, onHome, onHandover, onDocuments, onReceived, onChat, onCalendar, onMaterials, onLogout }: Props) {
  const today = new Date();
  const todayKey = dateKey(today);
  const { schedules: personnelSchedules, teamSchedules } = usePersonnel();
  const personnel = personnelView(today, personnelSchedules, teamSchedules);
  const planner = usePlanner();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null); // 주간 칸을 누르면 그 주 일요일, 날짜를 누르면 null
  const [agendaMonth, setAgendaMonth] = useState(false); // 오른쪽 입력 대상이 '이 달 전체'인지
  const [applyOpen, setApplyOpen] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const weekKeyOf = (weekIndex: number) => dateKey(new Date(year, month, 1 - firstDay + weekIndex * 7)); // 그 줄의 일요일(앞 달 날짜일 수도 있다)
  const tasksOf = (week: string) => planner.weekTasks.filter((task) => task.week === week);

  const fixedOn = (key: string) => personnel.marks.filter((mark) => mark.key === key);

  const routines = planner.routines;
  const byCadence = (cadence: PlannerRoutine["cadence"]) => routines.filter((routine) => routine.cadence === cadence);
  const weekly = byCadence("weekly");

  const moveMonth = (offset: number) => {
    setViewDate(new Date(year, month + offset, 1));
    setSelectedWeek(null);
  };
  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedKey(todayKey);
    setSelectedWeek(null);
  };

  return (
    <div className="app-shell calendar-page">
      <AppSidebar active="calendar" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} onCalendar={onCalendar} onMaterials={onMaterials} />
      <main className="calendar-page-main">
        <header className="dashboard-header">
          <div><strong>캘린더</strong></div>
        </header>
        <div className="calendar-page-content">
          <section className="documents-title">
            <div><h1>캘린더</h1><p>일정을 적고, 받은 인수인계서를 적용하면 마감일과 매주·매월 해야 할 일이 한 화면에 모여요.</p></div>
            <div className="calendar-page-stats">
              <div title={personnel.next?.name}><strong>{personnel.next ? formatDday(personnel.next.appoint.dday) : "—"}</strong><small>{personnel.next ? `${personnel.next.name} 발령` : "다가오는 정기인사 없음"}</small></div>
            </div>
          </section>

          <section className="calendar-page-layout">
            <div className={`calendar-board with-weeks${agendaMonth && !selectedWeek ? " month-selected" : ""}`}>
              <header>
                <div>
                  <button
                    type="button"
                    className={`calendar-month-title${agendaMonth && !selectedWeek ? " active" : ""}`}
                    onClick={() => {
                      setAgendaMonth(true);
                      setSelectedWeek(null);
                    }}
                    title={`${month + 1}월 전체 할 일 보기`}
                  >
                    <h2>{year}년 {month + 1}월</h2>
                  </button>
                </div>
                <div>
                  <button className="calendar-apply" onClick={() => setApplyOpen(true)}><Icon name="download" size={14} /> 받은 인수인계서 적용하기</button>
                  <button className="calendar-today" onClick={goToday}>오늘</button>
                  <button className="calendar-prev" onClick={() => moveMonth(-1)} aria-label="이전 달"><Icon name="chevron" size={15} /></button>
                  <button onClick={() => moveMonth(1)} aria-label="다음 달"><Icon name="chevron" size={15} /></button>
                </div>
              </header>
              <div className="calendar-board-weekdays"><span className="week-head">주간 업무</span>{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-board-grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
                {weeks.map((week, weekIndex) => [
                  (() => {
                    const week = weekKeyOf(weekIndex);
                    const tasks = tasksOf(week);
                    const shown = 3;
                    const routinesShown = Math.max(0, shown - tasks.length);
                    const hidden = Math.max(0, tasks.length - shown) + Math.max(0, weekly.length - routinesShown);
                    return (
                      <button
                        type="button"
                        className={`week-cell ${selectedWeek === week ? "selected" : ""}`}
                        key={`week-${weekIndex}`}
                        onClick={() => {
                          setSelectedWeek(week);
                          setAgendaMonth(false);
                        }}
                        title={`${weekIndex + 1}째주 (${weekRange(week)}) 주간 업무 적기`}
                      >
                        <b>{weekIndex + 1}째주</b>
                        {(tasks.length > 0 || weekly.length > 0) && (
                          <ul>
                            {tasks.slice(0, shown).map((task) => <li key={task.id} className="week-task" title={task.text}>{task.text}</li>)}
                            {weekly.slice(0, routinesShown).map((routine) => <li key={routine.id} title={`${routine.name} · ${routine.timing}`}>{weekdaysOf(routine.timing) && <em>{weekdaysOf(routine.timing)}</em>}{routine.name}</li>)}
                            {hidden > 0 && <li className="more">+{hidden}</li>}
                          </ul>
                        )}
                      </button>
                    );
                  })(),
                  ...week.map((day, dayIndex) => {
                    const inWeek = selectedWeek === weekKeyOf(weekIndex);
                    if (!day) return <span className={`empty${inWeek ? " in-week" : ""}`} key={`empty-${weekIndex}-${dayIndex}`} />;
                    const key = dateKey(new Date(year, month, day));
                    const items = [...fixedOn(key).map((d) => ({ text: d.label, kind: d.kind === "shared" ? "shared-mark" : "personnel-mark" })), ...(planner.events[key] ?? []).map((text) => ({ text, kind: "event" }))];
                    return (
                      <button
                        key={key}
                        className={`${key === selectedKey && !selectedWeek && !agendaMonth ? "selected" : ""} ${key === todayKey ? "today" : ""} ${dayIndex === 0 ? "sunday" : ""} ${inWeek ? "in-week" : ""}`}
                        onClick={() => {
                          setSelectedKey(key);
                          setSelectedWeek(null);
                          setAgendaMonth(false);
                        }}
                      >
                        <b>{day}</b>
                        <ul>
                          {items.slice(0, 3).map((item, i) => <li key={i} className={item.kind}>{item.text}</li>)}
                          {items.length > 3 && <li className="more">+{items.length - 3}</li>}
                        </ul>
                      </button>
                    );
                  }),
                ])}
              </div>
            </div>

            <MonthAgenda
              year={year}
              month={month}
              target={selectedWeek ? { kind: "week", week: selectedWeek } : agendaMonth ? { kind: "month" } : { kind: "day", key: selectedKey }}
              selectedKey={selectedKey}
              onTarget={(next) => {
                setAgendaMonth(next.kind === "month");
                if (next.kind === "week") setSelectedWeek(next.week);
                else setSelectedWeek(null);
                if (next.kind === "day") setSelectedKey(next.key);
              }}
            />
          </section>

        </div>
      </main>
      {applyOpen && <ApplyReceivedDialog onClose={() => setApplyOpen(false)} onApplied={() => void planner.refresh()} />}
    </div>
  );
}

function ApplyReceivedDialog({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [received, setReceived] = useState<ReceivedHandover[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const loaded = useRef(false);
  if (!loaded.current) {
    loaded.current = true;
    api.receivedHandovers().then(({ handovers }) => setReceived(handovers.filter(hasDocument))).catch((e: Error) => setError(e.message));
  }
  const apply = async (handover: ReceivedHandover) => {
    setBusy(handover.id);
    try {
      const result = await api.applyReceivedToCalendar(handover.id);
      setResults((current) => ({ ...current, [handover.id]: result.message }));
      onApplied();
    } catch (e) {
      setResults((current) => ({ ...current, [handover.id]: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="apply-received-overlay" role="presentation" onClick={onClose}>
      <section className="apply-received-modal" role="dialog" aria-modal="true" aria-labelledby="apply-received-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><h2 id="apply-received-title">받은 인수인계서 적용하기</h2><p>마감일처럼 날짜가 정해진 일은 달력에, 매주 하는 일은 주간 칸에, 매월·분기·매년 하는 일은 달력 아래에 넣어요.</p></div>
          <button onClick={onClose} aria-label="닫기"><Icon name="close" size={16} /></button>
        </header>
        <div className="apply-received-list">
          {error && <div className="list-notice error" role="alert">받은 인수인계서를 불러오지 못했어요: {error}</div>}
          {!received && !error && <div className="apply-received-empty">불러오는 중…</div>}
          {received && !received.length && <div className="apply-received-empty">아직 받은 인수인계서가 없어요.{"\n"}인계자가 문서를 보내면 여기에 나타나요.</div>}
          {received?.map((handover) => (
            <div className="apply-received-row" key={handover.id}>
              <span><Icon name="file" size={16} /></span>
              <div><strong>{handover.task_name || handover.title}</strong><small>{handover.owner_name}{handover.position ? ` ${handover.position}` : ""} · {formatRelativeTime(handover.updated_at)}</small>{results[handover.id] && <em>{results[handover.id]}</em>}</div>
              <button onClick={() => void apply(handover)} disabled={busy !== null}>{busy === handover.id ? "적용 중…" : results[handover.id] ? "다시 적용" : "적용"}</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
