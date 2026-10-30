// 캘린더 화면 오른쪽: 보고 있는 달의 '해야 할 일'을 한 목록으로 모아 보여 준다(월·주·일 구분 없음).
//   마감일 순으로 정렬: 날짜 있는 할 일·일정 → 주간 업무(몇 주차) → 마감일 없는 할 일. 체크한 일은 맨 위 '다 한 일'(눌러서 펼치고 접는다)로 옮겨 가고, 다시 체크를 풀면 제자리로 돌아온다.
//   항목을 누르면 아래에 상세가 열린다. 할 일과 일정(원텔에서 가져온 것 포함)은 업무 마감일(바꾸면 달력에 바로 반영)·진행 이력(추가·고치기·지우기), 주간 업무는 짧은 메모.
//   입력칸은 달력에서 고른 곳에 추가한다. 날짜를 고르면 그 날짜가 마감일인 할 일, 주를 고르면 주간 업무, 달 제목을 고르면 마감일 없는 할 일.
//   정기 업무·정기인사·팀 일정은 할 일이 아니라서 목록 아래 '정기·팀 일정'에 따로 보여 준다.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/shared/Icon";
import { personnelView, usePersonnel } from "@/shared/personnel";
import { dateKey, usePlanner } from "@/shared/planner";
import type { PlannerHistory, PlannerRoutine } from "@/shared/types";

const CADENCE_LABEL: Record<PlannerRoutine["cadence"], string> = { daily: "매일", weekly: "매주", monthly: "매월", quarterly: "분기", yearly: "매년", other: "수시" };

type CheckKind = "event" | "week" | "todo";
// 목록 한 줄(할 일·일정·주간 업무). sort 는 정렬 기준 날짜(주간 업무는 그 주 일요일, 마감일 없으면 맨 뒤)
type Entry = { key: string; id: string; kind: CheckKind; text: string; memo: string; done: boolean; sort: string; sub: string; date: string | null; week: string | null };
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

// 그 달 정기 업무: 매월·매일·수시, 그리고 해당 월이 이 달인(또는 시기를 모르는) 분기·매년 업무. 매주 업무는 따로 묶는다
const routineInMonth = (routine: PlannerRoutine, month: number) => routine.cadence !== "weekly" && (["monthly", "daily", "other"].includes(routine.cadence) || !routine.months?.length || routine.months.includes(month + 1));

const md = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8))}`;

export function MonthAgenda({ year, month, target }: { year: number; month: number; target: AgendaTarget }) {
  const today = new Date();
  const { schedules, teamSchedules } = usePersonnel();
  const personnel = personnelView(today, schedules, teamSchedules);
  const planner = usePlanner();
  const { eventItems, todos, routines, weekTasks } = planner;
  const [draft, setDraft] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null); // 상세를 연 항목 `${kind}:${id}`
  const [doneOpen, setDoneOpen] = useState(false); // 맨 위 '다 한 일' 펼침 여부
  const scrollRef = useRef<HTMLDivElement>(null);
  const weeks0 = weeksOf(year, month);
  const weekLabel = (week: string) => `${weeks0.findIndex((w) => w.week === week) + 1}주차`;
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const thisMonth = today.getFullYear() === year && today.getMonth() === month;
  const monthName = thisMonth ? "이번 달" : `${month + 1}월`;

  const entries: Entry[] = [
    ...todos.filter((t) => !t.date || t.date.startsWith(monthPrefix)).map((t) => ({ key: `todo:${t.id}`, id: t.id, kind: "todo" as const, text: t.text, memo: t.memo ?? "", done: t.done, sort: t.date ?? "~", sub: t.date ? `${md(t.date)} 마감` : "마감일 없음", date: t.date, week: null })),
    ...eventItems.filter((e) => e.date.startsWith(monthPrefix)).map((e) => ({ key: `event:${e.id}`, id: e.id, kind: "event" as const, text: e.text, memo: e.memo ?? "", done: Boolean(e.done), sort: e.date, sub: `${md(e.date)} 마감`, date: e.date, week: null })),
    ...weekTasks.filter((t) => weeks0.some((w) => w.week === t.week)).map((t) => ({ key: `week:${t.id}`, id: t.id, kind: "week" as const, text: t.text, memo: t.memo ?? "", done: Boolean(t.done), sort: t.week, sub: `${weekLabel(t.week)} 업무`, date: null, week: t.week })),
  ].sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)); // localeCompare 는 '~' 를 숫자보다 앞에 둬서 쓰지 않는다
  const focused = entries.find((e) => e.key === focusKey) ?? null;
  // 할 일과 일정(원텔에서 가져온 것 포함)은 마감일 · 진행 이력 상세를 같이 쓴다. 주간 업무만 메모
  const historyKind = focused && focused.kind !== "week" ? focused.kind : null;
  const focusedItem = focused && historyKind ? (historyKind === "event" ? eventItems : todos).find((t) => t.id === focused.id) ?? null : null;

  // 달력에서 고른 날짜·주에 해당하는 항목은 살짝 표시하고, 첫 항목으로 목록을 옮긴다
  const hit = (e: Entry) => (target.kind === "day" ? e.date === target.key : target.kind === "week" ? e.week === target.week : false);
  const hitKey = entries.find(hit)?.key;
  useEffect(() => {
    const box = scrollRef.current;
    const el = hitKey ? box?.querySelector<HTMLElement>(`[data-entry="${hitKey}"]`) : null;
    if (box && el) box.scrollTo({ top: el.offsetTop - box.offsetTop - 4, behavior: "smooth" });
  }, [hitKey, target]);

  const regular = [
    ...personnel.marks.filter((mark) => mark.key.startsWith(monthPrefix)).map((mark) => ({ id: `mark:${mark.key}:${mark.label}`, name: mark.label, tag: md(mark.key), tone: mark.kind === "shared" ? "shared" : "personnel", title: mark.label })),
    ...routines.filter((routine) => routine.cadence === "weekly" || routineInMonth(routine, month)).map((routine) => ({ id: `routine:${routine.id}`, name: routine.name, tag: CADENCE_LABEL[routine.cadence], tone: "routine", title: routine.timing || routine.name })),
  ];

  const targetLabel = target.kind === "day" ? `${md(target.key)} 마감` : target.kind === "week" ? weekLabel(target.week) : `${month + 1}월 · 마감일 없음`;
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (target.kind === "day") planner.addTodo(text, target.key);
    else if (target.kind === "week") planner.addWeekTask(target.week, text);
    else planner.addTodo(text, null);
    setDraft("");
  };
  const remove = (item: Entry) => {
    if (item.kind === "event") planner.removeEventById(item.id);
    else if (item.kind === "week") planner.removeWeekTask(item.id);
    else planner.removeTodo(item.id);
    if (focusKey === item.key) setFocusKey(null);
  };

  const openEntries = entries.filter((e) => !e.done);
  const doneEntries = entries.filter((e) => e.done);
  const renderRow = (item: Entry) => (
    <li key={item.key} data-entry={item.key} className={`todo-focus-row${item.done ? " done" : ""}${focusKey === item.key ? " selected" : ""}${hit(item) && focusKey !== item.key ? " hit" : ""}`}>
      <button className="check-box" onClick={() => planner.setDone(item.kind, item.id, !item.done)} aria-pressed={item.done} aria-label={item.done ? `${item.text} 되돌리기` : `${item.text} 완료`} title={item.done ? "되돌리기" : "완료"}>
        {item.done && <Icon name="check" size={9} />}
      </button>
      <button className="todo-focus-main" onClick={() => setFocusKey(focusKey === item.key ? null : item.key)} aria-pressed={focusKey === item.key}>
        <span>
          <strong>{item.text}</strong>
          <small>{item.sub}</small>
        </span>
        <Icon name="chevron" size={14} />
      </button>
      <button className="month-remove" onClick={() => remove(item)} aria-label={`${item.text} 삭제`} title="삭제"><Icon name="close" size={10} /></button>
    </li>
  );

  return (
    <aside className="calendar-side month-agenda-side">
      <section className="calendar-side-card month-agenda-card">
        <header>
          <div><strong>{monthName} 해야 할 일</strong></div>
        </header>
        <div className="month-agenda-scroll" ref={scrollRef}>
          <section className="todo-focus">
            {doneEntries.length > 0 && (
              <div className={`todo-done-group${doneOpen ? " open" : ""}`}>
                <button className="todo-done-toggle" onClick={() => setDoneOpen(!doneOpen)} aria-expanded={doneOpen}>
                  <Icon name="chevron" size={13} />다 한 일 <small>{doneEntries.length}</small>
                </button>
                {doneOpen && <ul className="todo-focus-list">{doneEntries.map(renderRow)}</ul>}
              </div>
            )}
            {openEntries.length > 0 ? (
              <ul className="todo-focus-list">{openEntries.map(renderRow)}</ul>
            ) : <p className="month-empty">{doneEntries.length ? `${monthName}에 남은 일이 없어요.` : `${monthName}에 해야 할 일이 없어요. 아래에서 추가하거나 달력에서 날짜를 눌러 보세요.`}</p>}
            {focused && historyKind && focusedItem && (
              <ItemDetail
                key={focused.key}
                item={focusedItem}
                dateRequired={historyKind === "event"}
                onDate={(date) => (historyKind === "event" ? date && planner.setEventDate(focused.id, date) : planner.setTodoDate(focused.id, date))}
                onAdd={(text) => planner.addHistory(historyKind, focused.id, text)}
                onEdit={(entryId, text) => planner.editHistory(historyKind, focused.id, entryId, text)}
                onRemove={(entryId) => planner.removeHistory(historyKind, focused.id, entryId)}
              />
            )}
            {focused && focused.kind === "week" && (
              <div className="todo-detail">
                <div className="todo-detail-picked"><small>선택한 업무</small><strong>{focused.text}</strong></div>
                <MemoEditor key={focused.key} memo={focused.memo} onSave={(memo) => planner.setMemo(focused.kind, focused.id, memo)} onClose={() => setFocusKey(null)} />
              </div>
            )}
          </section>
          {regular.length > 0 && (
            <section className="month-section">
              <h3 className="month-sub">정기·팀 일정</h3>
              {regular.map((item) => <div key={item.id} className={`month-item ${item.tone}`} title={item.title}><i /><span>{item.name}</span><em>{item.tag}</em></div>)}
            </section>
          )}
        </div>
        <div className="calendar-side-add month-agenda-add">
          <span className="month-agenda-where">{targetLabel}</span>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && add()} placeholder="해야 할 일 추가" aria-label={`${targetLabel} 할 일 추가`} />
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

// 고른 항목(할 일 · 원텔에서 가져온 일정 포함)의 상세: 업무 마감일(바꾸면 바로 저장돼 위 목록·달력에 반영) · 업무 진행 이력(추가·고치기·지우기)
type DetailItem = { text: string; date: string | null; history?: PlannerHistory[] };
function ItemDetail({ item, dateRequired, onDate, onAdd, onEdit, onRemove }: { item: DetailItem; dateRequired: boolean; onDate: (date: string | null) => void; onAdd: (text: string) => Promise<void>; onEdit: (entryId: string, text: string) => void; onRemove: (entryId: string) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const history = item.history ?? [];
  const save = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(value);
      setText("");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "진행 이력을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="todo-detail">
      <div className="todo-detail-picked"><small>선택한 업무</small><strong>{item.text}</strong></div>
      <h4><Icon name="calendar" size={14} />업무 마감일</h4>
      <label className="todo-detail-date">
        <Icon name="calendar" size={15} />
        <input type="date" value={item.date ?? ""} required={dateRequired} onChange={(event) => onDate(event.target.value || null)} aria-label="업무 마감일" />
        <span className="todo-detail-date-text">{item.date ? `${item.date.slice(2, 4)}. ${Number(item.date.slice(5, 7))}. ${Number(item.date.slice(8))}.` : "날짜 선택"}</span>
        <Icon name="chevron" size={14} />
      </label>
      <p className="todo-detail-note">변경한 날짜는 위 업무 목록에도 반영됩니다.</p>
      <h4><Icon name="clock" size={14} />업무 진행 이력</h4>
      {history.length > 0 ? (
        <ul className="todo-history">
          {history.map((entry) => <HistoryRow key={entry.id} entry={entry} onEdit={(value) => onEdit(entry.id, value)} onRemove={() => onRemove(entry.id)} />)}
        </ul>
      ) : <p className="todo-detail-note">아직 남긴 진행 이력이 없어요.</p>}
      <label className="todo-history-label" htmlFor="todo-history-text">오늘 어디까지 진행했나요?</label>
      <textarea id="todo-history-text" rows={3} maxLength={500} value={text} onChange={(event) => setText(event.target.value)} placeholder="예: 유관부서 3곳 중 2곳 실적 확인 완료. 나머지 1곳 회신 대기 중." />
      {error && <p className="todo-history-error" role="alert">{error}</p>}
      <button className="todo-history-save" onClick={save} disabled={!text.trim() || saving}>진행 이력 저장</button>
    </div>
  );
}

// 진행 이력 한 줄. 연필을 누르면 그 자리에서 고치고(Enter 저장 · Esc 취소), X 를 누르면 한 번 더 물어본 뒤 지운다
function HistoryRow({ entry, onEdit, onRemove }: { entry: PlannerHistory; onEdit: (text: string) => void; onRemove: () => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [value, setValue] = useState(entry.text);
  const commit = () => {
    const next = value.trim();
    if (next && next !== entry.text) onEdit(next);
    else setValue(entry.text);
    setMode("view");
  };
  if (mode === "edit") {
    return (
      <li className="todo-history-edit">
        <textarea
          autoFocus
          rows={2}
          maxLength={500}
          value={value}
          aria-label="진행 이력 고치기"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setValue(entry.text); setMode("view"); }
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 무시한다
              event.preventDefault();
              commit();
            }
          }}
        />
        <div className="todo-history-edit-actions">
          <button onClick={() => { setValue(entry.text); setMode("view"); }}>취소</button>
          <button className="primary" onClick={commit} disabled={!value.trim()}>저장</button>
        </div>
      </li>
    );
  }
  return (
    <li>
      <Icon name="clock" size={13} />
      <span>{entry.text}</span>
      {mode === "confirm" ? (
        <span className="todo-history-actions confirm">
          <button className="danger" onClick={onRemove}>삭제</button>
          <button onClick={() => setMode("view")}>취소</button>
        </span>
      ) : (
        <span className="todo-history-actions">
          <button onClick={() => { setValue(entry.text); setMode("edit"); }} aria-label="진행 이력 고치기" title="고치기"><Icon name="edit" size={12} /></button>
          <button onClick={() => setMode("confirm")} aria-label="진행 이력 지우기" title="지우기"><Icon name="close" size={12} /></button>
        </span>
      )}
    </li>
  );
}
