// 캘린더 화면 오른쪽: 보고 있는 달에 해야 할 일(체크리스트). 위의 [월 | 주 | 일] 탭을 누르면 그 탭의 할 일만 보인다.
//   월  이 달 전체 할 일(날짜 없는 할 일) + 매월·이 달 해당 정기 업무
//   주  주차별 할 일 + 매주 정기 업무
//   일  날짜별 일정·할 일 + 정기인사·팀 일정
//   맨 아래 그 탭에서 다 한 일(체크한 항목. 다시 누르면 되돌린다)
// 입력칸은 지금 탭에 추가한다(월 = 이 달 전체, 주 = 고른 주, 일 = 고른 날짜). 달력에서 날짜를 누르면 '일', 주간 칸을 누르면 '주' 탭으로 바뀐다.
// 항목 글자를 누르면 그 아래에 짧은 메모를 적을 수 있다. 메모가 있는 항목은 작은 표시만 보이고, 눌러야 펼쳐진다.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/shared/Icon";
import { personnelView, usePersonnel } from "@/shared/personnel";
import { dateKey, usePlanner } from "@/shared/planner";
import type { PlannerRoutine } from "@/shared/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CADENCE_LABEL: Record<PlannerRoutine["cadence"], string> = { daily: "매일", weekly: "매주", monthly: "매월", quarterly: "분기", yearly: "매년", other: "수시" };

type CheckKind = "event" | "week" | "todo";
// 체크리스트 한 줄(내가 적은 일정·주간 할 일·할 일)
type CheckItem = { id: string; kind: CheckKind; text: string; memo: string; done: boolean; where: string };
export type AgendaTarget = { kind: "day"; key: string } | { kind: "week"; week: string } | { kind: "month" };

// 그 달의 주(일요일 시작). week 는 그 주 일요일 날짜(주간 업무 저장 키와 같다)
function weeksOf(year: number, month: number) {
  const days = new Date(year, month + 1, 0).getDate();
  const weeks: { week: string; days: number[] }[] = [];
  for (let day = 1; day <= days; day += 1) {
    const week = dateKey(new Date(year, month, day - new Date(year, month, day).getDay()));
    if (weeks[weeks.length - 1]?.week !== week) weeks.push({ week, days: [] });
    weeks[weeks.length - 1].days.push(day);
  }
  return weeks;
}

// 그 달 전체 칸의 정기 업무: 매월·매일·수시, 그리고 해당 월이 이 달인(또는 시기를 모르는) 분기·매년 업무. 매주 업무는 첫 주 칸에서 본다
const routineInMonth = (routine: PlannerRoutine, month: number) => routine.cadence !== "weekly" && (["monthly", "daily", "other"].includes(routine.cadence) || !routine.months?.length || routine.months.includes(month + 1));

export function MonthAgenda({ year, month, target, selectedKey, onTarget }: { year: number; month: number; target: AgendaTarget; selectedKey: string; onTarget: (target: AgendaTarget) => void }) {
  const today = new Date();
  const todayKey = dateKey(today);
  const { schedules, teamSchedules } = usePersonnel();
  const personnel = personnelView(today, schedules, teamSchedules);
  const planner = usePlanner();
  const { eventItems, todos, routines, weekTasks } = planner;
  const [draft, setDraft] = useState("");
  const [memoOpen, setMemoOpen] = useState<string | null>(null); // 메모를 펼친 항목 `${kind}:${id}`
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const weeks0 = weeksOf(year, month);
  const weekLabel = (week: string) => `${weeks0.findIndex((w) => w.week === week) + 1}주차`;

  // 이 달의 체크리스트 항목(일정·날짜 있는 할 일은 그날, 주간 할 일은 그 주, 날짜 없는 할 일은 이 달 전체)
  const dayChecks = (key: string): CheckItem[] => [
    ...eventItems.filter((e) => e.date === key).map((e) => ({ id: e.id, kind: "event" as const, text: e.text, memo: e.memo ?? "", done: Boolean(e.done), where: `${Number(key.slice(8))}일` })),
    ...todos.filter((t) => t.date === key).map((t) => ({ id: t.id, kind: "todo" as const, text: t.text, memo: t.memo ?? "", done: t.done, where: `${Number(key.slice(8))}일` })),
  ];
  const weekChecks = (week: string): CheckItem[] => weekTasks.filter((t) => t.week === week).map((t) => ({ id: t.id, kind: "week" as const, text: t.text, memo: t.memo ?? "", done: Boolean(t.done), where: weekLabel(week) }));
  const monthChecks: CheckItem[] = todos.filter((t) => !t.date).map((t) => ({ id: t.id, kind: "todo" as const, text: t.text, memo: t.memo ?? "", done: t.done, where: `${month + 1}월` }));

  const weeks = weeks0.map((week, index) => ({
    ...week,
    label: `${index + 1}주차`,
    range: `${month + 1}/${week.days[0]}~${month + 1}/${week.days[week.days.length - 1]}`,
    checks: weekChecks(week.week).filter((c) => !c.done),
  }));
  const weeklyRoutines = routines.filter((routine) => routine.cadence === "weekly");
  const days = weeks0.flatMap((w) => w.days).map((day) => {
    const key = dateKey(new Date(year, month, day));
    return { day, key, marks: personnel.marks.filter((mark) => mark.key === key), checks: dayChecks(key).filter((c) => !c.done) };
  });
  const shownDays = days.filter((d) => d.marks.length || d.checks.length);
  const monthRoutines = routines.filter((routine) => routineInMonth(routine, month));
  const openMonth = monthChecks.filter((c) => !c.done);
  const doneOf: Record<AgendaTarget["kind"], CheckItem[]> = {
    month: monthChecks.filter((c) => c.done),
    week: weeks0.flatMap((w) => weekChecks(w.week)).filter((c) => c.done),
    day: days.flatMap((d) => dayChecks(d.key)).filter((c) => c.done),
  };
  const openOf: Record<AgendaTarget["kind"], number> = { month: openMonth.length, week: weeks.reduce((n, w) => n + w.checks.length, 0), day: days.reduce((n, d) => n + d.checks.length, 0) };
  const tab = target.kind;
  const done = doneOf[tab];

  // 달력에서 날짜·주를 고르면 목록의 그 자리로 옮긴다
  const anchor = target.kind === "day" ? `[data-day="${target.key}"]` : target.kind === "week" ? `[data-week="${target.week}"]` : "[data-month]";
  useEffect(() => {
    const box = scrollRef.current;
    let el = box?.querySelector<HTMLElement>(anchor);
    if (box && el) box.scrollTo({ top: el.offsetTop - box.offsetTop - 4, behavior: "smooth" });
  }, [anchor, target, year, month]);

  // 월/주/일 단추: 주는 지금 고른 주(없으면 고른 날짜가 있는 주), 일은 고른 날짜(이 달이 아니면 1일)
  const dayKey = selectedKey.startsWith(monthPrefix) ? selectedKey : `${monthPrefix}01`;
  const weekOfDay = () => {
    const [y, m, d] = dayKey.split("-").map(Number);
    return dateKey(new Date(y, m - 1, d - new Date(y, m - 1, d).getDay()));
  };
  const scopes: { kind: AgendaTarget["kind"]; label: string; pick: () => AgendaTarget }[] = [
    { kind: "month", label: "월", pick: () => ({ kind: "month" }) },
    { kind: "week", label: "주", pick: () => (target.kind === "week" ? target : { kind: "week", week: weekOfDay() }) },
    { kind: "day", label: "일", pick: () => (target.kind === "day" ? target : { kind: "day", key: dayKey }) },
  ];
  const targetLabel = target.kind === "day" ? `${Number(target.key.slice(5, 7))}/${Number(target.key.slice(8))}` : target.kind === "week" ? weekLabel(target.week) : `${month + 1}월 전체`;
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (target.kind === "day") planner.addEvent(target.key, text);
    else if (target.kind === "week") planner.addWeekTask(target.week, text);
    else planner.addTodo(text, null);
    setDraft("");
  };
  const remove = (item: CheckItem) => {
    if (item.kind === "event") planner.removeEventById(item.id);
    else if (item.kind === "week") planner.removeWeekTask(item.id);
    else planner.removeTodo(item.id);
  };

  const renderCheck = (item: CheckItem, showWhere = false) => {
    const memoKey = `${item.kind}:${item.id}`;
    const open = memoOpen === memoKey;
    return (
      <div key={memoKey} className={`check-row${item.done ? " done" : ""}${open ? " open" : ""}`}>
        <div className="check-line">
          <button className="check-box" onClick={() => planner.setDone(item.kind, item.id, !item.done)} aria-pressed={item.done} aria-label={item.done ? `${item.text} 되돌리기` : `${item.text} 완료`} title={item.done ? "되돌리기" : "완료"}>
            {item.done && <Icon name="check" size={9} />}
          </button>
          <button className="check-text" onClick={() => setMemoOpen(open ? null : memoKey)} title={item.memo ? `메모: ${item.memo}` : "눌러서 메모 남기기"}>
            <span>{item.text}</span>
            {item.memo && !open && <i className="check-memo-mark" aria-label="메모 있음" />}
            {showWhere && <small>{item.where}</small>}
          </button>
          <button className="month-remove" onClick={() => remove(item)} aria-label={`${item.text} 삭제`} title="삭제"><Icon name="close" size={10} /></button>
        </div>
        {open && <MemoEditor memo={item.memo} onSave={(memo) => planner.setMemo(item.kind, item.id, memo)} onClose={() => setMemoOpen(null)} />}
      </div>
    );
  };

  return (
    <aside className="calendar-side month-agenda-side">
      <section className="calendar-side-card month-agenda-card">
        <header>
          <div><span>{month + 1}월에 해야 할 일</span><strong>{openOf[tab] ? `${openOf[tab]}건 남음` : "남은 일 없음"}{done.length ? <small> · 완료 {done.length}</small> : null}</strong></div>
        </header>
        <div className="month-agenda-tabs" role="tablist" aria-label="월 · 주 · 일 할 일">
          {scopes.map((scope) => (
            <button key={scope.kind} role="tab" type="button" className={tab === scope.kind ? "active" : ""} aria-selected={tab === scope.kind} onClick={() => onTarget(scope.pick())}>
              {scope.label}{openOf[scope.kind] > 0 && <small>{openOf[scope.kind]}</small>}
            </button>
          ))}
        </div>
        <div className="month-agenda-scroll" ref={scrollRef}>
          {tab === "month" && (
            <section className="month-section" data-month>
              {openMonth.map((item) => renderCheck(item))}
              {monthRoutines.length > 0 && <h3 className="month-sub">정기 업무</h3>}
              {monthRoutines.map((routine) => <div key={routine.id} className="month-item routine" title={routine.timing || undefined}><i /><span>{routine.name}</span><em>{CADENCE_LABEL[routine.cadence]}</em></div>)}
              {!openMonth.length && !monthRoutines.length && <p className="month-empty">{month + 1}월 전체에 걸친 할 일이 없어요. 아래에서 추가해 보세요.</p>}
            </section>
          )}
          {tab === "week" && (
            <section className="month-section">
              {weeklyRoutines.length > 0 && (
                <div className="month-week">
                  <div className="month-week-head static"><strong>매주</strong><small>정기 업무</small></div>
                  {weeklyRoutines.map((routine) => <div key={routine.id} className="month-item routine" title={routine.timing || undefined}><i /><span>{routine.name}</span><em>매주</em></div>)}
                </div>
              )}
              {weeks.map((week) => (
                <div key={week.week} className={`month-week${target.kind === "week" && target.week === week.week ? " selected" : ""}`} data-week={week.week}>
                  <button className="month-week-head" onClick={() => onTarget({ kind: "week", week: week.week })} title="이 주에 추가"><strong>{week.label}</strong><small>{week.range}</small></button>
                  {week.checks.map((item) => renderCheck(item))}
                  {!week.checks.length && <p className="month-empty">할 일 없음</p>}
                </div>
              ))}
            </section>
          )}
          {tab === "day" && (
            <section className="month-section">
              {shownDays.map(({ day, key, marks, checks }) => (
                <div key={key} data-day={key} className={`month-day${key === todayKey ? " today" : ""}${target.kind === "day" && target.key === key ? " selected" : ""}`}>
                  <button className="month-day-label" onClick={() => onTarget({ kind: "day", key })}>{day}일<small>{WEEKDAYS[new Date(year, month, day).getDay()]}</small></button>
                  <div>
                    {marks.map((mark) => <div key={mark.label} className={`month-item ${mark.kind === "shared" ? "shared" : "personnel"}`}><i /><span title={mark.label}>{mark.label}</span></div>)}
                    {checks.map((item) => renderCheck(item))}
                  </div>
                </div>
              ))}
              {!shownDays.length && <p className="month-empty">날짜별 할 일이 없어요. 달력에서 날짜를 고르고 추가해 보세요.</p>}
            </section>
          )}
          {done.length > 0 && (
            <section className="month-section done">
              <h3>다 한 일 {done.length}</h3>
              {done.map((item) => renderCheck(item, true))}
            </section>
          )}
        </div>
        <div className="calendar-side-add month-agenda-add">
          <span className="month-agenda-where">{targetLabel}</span>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && add()} placeholder={tab === "month" ? `${month + 1}월에 해야 할 일` : tab === "week" ? "이 주에 해야 할 일" : "이 날 해야 할 일"} aria-label={`${targetLabel}에 추가`} />
          <button onClick={add} aria-label="추가"><Icon name="arrow" size={14} /></button>
        </div>
      </section>
    </aside>
  );
}

// 항목 아래에 펼쳐지는 작은 메모 칸. Enter(또는 칸을 벗어나면) 저장, Shift+Enter 는 줄바꿈, Esc 는 저장하지 않고 닫는다.
function MemoEditor({ memo, onSave, onClose }: { memo: string; onSave: (memo: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(memo);
  const done = useRef(false); // Enter 로 저장한 뒤 닫히면서 blur 가 또 저장하지 않게
  const save = () => {
    if (done.current) return;
    done.current = true;
    if (value.trim() !== memo) onSave(value.trim());
    onClose();
  };
  const cancel = () => {
    done.current = true;
    onClose();
  };
  return (
    <div className="check-memo">
      <textarea
        autoFocus
        rows={2}
        maxLength={500}
        value={value}
        placeholder="메모 입력 후 Enter (줄바꿈 Shift+Enter)"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 무시한다
            event.preventDefault();
            save();
          }
        }}
      />
      <small className="check-memo-hint">Enter 저장 · Esc 취소</small>
    </div>
  );
}
