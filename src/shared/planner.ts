// 캘린더 일정과 할 일(투두). 로그인 계정마다 서버(/api/planner)에 저장해 다른 브라우저·기기에서도 같은 값을 본다.
// 홈 대시보드의 작은 캘린더와 왼쪽 탭의 '캘린더' 화면이 같은 저장소(이 파일의 store)를 쓴다.
// 고치면 화면을 먼저 바꾸고 서버에는 순서대로 보낸다(id 를 화면이 만들어 보내므로 응답을 기다릴 필요가 없다). 실패하면 서버 값으로 되돌린다.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "./api";
import { useProfile } from "./profile";
import type { PlannerEvent, PlannerRoutine, PlannerTodo, PlannerWeekTask } from "./types";

export type Todo = PlannerTodo; // date: 'YYYY-MM-DD', null 이면 날짜 없는 할 일
export type Planner = { events: Record<string, string[]>; todos: Todo[] };

type State = { events: PlannerEvent[]; todos: Todo[]; routines: PlannerRoutine[]; weekTasks: PlannerWeekTask[] };

const EMPTY: State = { events: [], todos: [], routines: [], weekTasks: [] };

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// 정기인사 발표(10/26)·발령(10/28). 올해 발령일이 지났으면 내년 날짜를 쓴다. 저장하지 않고 늘 계산해서 보여 준다.
export function personnelDays(today: Date) {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const year = todayStart.getTime() > new Date(today.getFullYear(), 9, 28).getTime() ? today.getFullYear() + 1 : today.getFullYear();
  const dday = (date: Date) => Math.ceil((date.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  return {
    year,
    announcement: { key: `${year}-10-26`, label: "정기인사 발표일", dday: dday(new Date(year, 9, 26)) },
    appointment: { key: `${year}-10-28`, label: "정기인사 발령일", dday: dday(new Date(year, 9, 28)) },
  };
}

export function formatDday(days: number): string {
  return days === 0 ? "D-DAY" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------- 예전 브라우저 저장분(localStorage) 옮기기

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function legacyKey(loginId: string): string {
  return `amigo-planner:${loginId}`;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d)) === value; // 2월 30일처럼 없는 날짜는 거른다
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

// 서버가 받아 주는 값만 남긴다(하나라도 틀리면 통째로 거절되므로). 일정은 id 가 없어 날짜·순서로 만든다(다시 보내도 같은 id).
function readLegacy(loginId: string): State | null {
  try {
    const raw = window.localStorage.getItem(legacyKey(loginId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { events?: Record<string, unknown>; todos?: unknown };
    const events: PlannerEvent[] = [];
    Object.entries(parsed.events ?? {}).forEach(([date, texts]) => {
      if (!validDate(date) || !Array.isArray(texts)) return;
      texts.forEach((text, index) => {
        const clean = cleanText(text);
        if (clean) events.push({ id: `local-${date}-${index}`, date, text: clean });
      });
    });
    const todos: Todo[] = [];
    (Array.isArray(parsed.todos) ? parsed.todos : []).forEach((item: Partial<Todo>, index) => {
      const text = cleanText(item?.text);
      if (!text) return;
      const id = typeof item.id === "string" && ID_PATTERN.test(item.id) ? item.id : `local-todo-${index}`;
      todos.push({ id, text, done: item.done === true, date: validDate(item.date) ? item.date : null });
    });
    return { events, todos, routines: [], weekTasks: [] };
  } catch {
    return null; // 저장소를 못 쓰거나 값이 깨졌으면 옮길 것이 없다고 본다
  }
}

function dropLegacy(loginId: string) {
  try {
    window.localStorage.removeItem(legacyKey(loginId));
  } catch {
    /* 지우지 못해도 다음에 다시 보내면 서버가 같은 id 를 건너뛴다 */
  }
}

// ---------------------------------------------------------------- 계정별 저장소(두 화면이 같이 쓴다)

const store = {
  loginId: null as string | null,
  state: EMPTY,
  loaded: false,
  queue: Promise.resolve() as Promise<unknown>, // 서버 요청을 보낸 순서대로(추가 → 완료 표시처럼 순서가 중요하다)
  pending: [] as ((state: State) => State)[], // 처음 불러오기 전에 고친 내용(불러온 값 위에 다시 적용한다)
  listeners: new Set<() => void>(),
};

function setState(state: State) {
  store.state = state;
  store.listeners.forEach((listener) => listener());
}

function fromServer(loginId: string, data: { events: PlannerEvent[]; todos: Todo[]; routines?: PlannerRoutine[]; week_tasks?: PlannerWeekTask[] }) {
  const state: State = { events: data.events, todos: data.todos, routines: data.routines ?? [], weekTasks: data.week_tasks ?? [] };
  if (store.loginId !== loginId) return; // 그 사이 다른 계정으로 바뀌었으면 버린다
  const next = store.loaded ? state : store.pending.reduce((acc, change) => change(acc), state);
  store.loaded = true;
  store.pending = [];
  setState(next);
}

async function load(loginId: string) {
  const legacy = readLegacy(loginId);
  if (legacy && (legacy.events.length || legacy.todos.length)) {
    try {
      fromServer(loginId, await api.importPlanner(legacy));
      dropLegacy(loginId);
      return;
    } catch (error) {
      console.warn("브라우저에 저장해 둔 일정·할 일을 서버로 옮기지 못했습니다. 다음에 다시 시도합니다.", error);
    }
  } else if (legacy) {
    dropLegacy(loginId);
  }
  fromServer(loginId, await api.planner());
}

function enqueue(loginId: string, task: () => Promise<unknown>) {
  store.queue = store.queue.then(task).catch((error) => {
    console.warn("캘린더를 서버에 저장하지 못했습니다. 서버 값으로 다시 맞춥니다.", error);
    // 뒤에 줄 선 요청까지 보낸 다음에 다시 읽어야 그 변경이 화면에서 사라지지 않는다
    store.queue = store.queue
      .then(() => api.planner())
      .then((data) => fromServer(loginId, data))
      .catch(() => undefined); // 서버에 닿지 않으면 화면 값을 그대로 둔다
  });
}

function select(loginId: string) {
  if (store.loginId === loginId) return;
  store.loginId = loginId;
  store.loaded = false;
  store.pending = [];
  setState(EMPTY);
  if (loginId) enqueue(loginId, () => load(loginId));
}

function change(local: (state: State) => State, remote: () => Promise<unknown>) {
  const loginId = store.loginId ?? "";
  if (!store.loaded) store.pending.push(local);
  setState(local(store.state));
  if (loginId) enqueue(loginId, remote);
}

// 서버 값으로 다시 맞춘다(받은 인수인계서 적용하기처럼 서버가 캘린더를 바꾼 뒤).
export function refreshPlanner(): Promise<void> {
  const loginId = store.loginId;
  if (!loginId) return Promise.resolve();
  return new Promise((resolve) => enqueue(loginId, () => api.planner().then((data) => fromServer(loginId, data)).finally(resolve)));
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

export function usePlanner() {
  const [profile] = useProfile();
  if (store.loginId === null) select(profile.loginId); // 첫 화면 그리기 전에 불러오기 시작

  useEffect(() => {
    select(profile.loginId); // 다른 계정으로 바뀌면 그 계정의 값을 불러온다
  }, [profile.loginId]);

  const state = useSyncExternalStore(subscribe, () => store.state);

  const events = useMemo(() => {
    const byDate: Record<string, string[]> = {};
    state.events.forEach((event) => (byDate[event.date] ??= []).push(event.text));
    return byDate;
  }, [state.events]);

  return {
    events,
    todos: state.todos,
    addEvent: (key: string, text: string) => {
      const event = { id: newId(), date: key, text };
      change((s) => ({ ...s, events: [...s.events, event] }), () => api.addPlannerEvent(event));
    },
    removeEvent: (key: string, index: number) => {
      const target = store.state.events.filter((event) => event.date === key)[index];
      if (!target) return;
      change((s) => ({ ...s, events: s.events.filter((event) => event.id !== target.id) }), () => api.deletePlannerEvent(target.id));
    },
    addTodo: (text: string, date: string | null) => {
      const todo: Todo = { id: newId(), text, done: false, date };
      change((s) => ({ ...s, todos: [...s.todos, todo] }), () => api.addPlannerTodo(todo));
    },
    toggleTodo: (id: string) => {
      const target = store.state.todos.find((todo) => todo.id === id);
      if (!target) return;
      const done = !target.done;
      change((s) => ({ ...s, todos: s.todos.map((todo) => (todo.id === id ? { ...todo, done } : todo)) }), () => api.updatePlannerTodo(id, { done }));
    },
    removeTodo: (id: string) => change((s) => ({ ...s, todos: s.todos.filter((todo) => todo.id !== id) }), () => api.deletePlannerTodo(id)),
    clearDone: () => change((s) => ({ ...s, todos: s.todos.filter((todo) => !todo.done) }), () => api.clearDonePlannerTodos()),
    routines: state.routines,
    weekTasks: state.weekTasks,
    addWeekTask: (week: string, text: string) => {
      const task = { id: newId(), week, text };
      change((s) => ({ ...s, weekTasks: [...s.weekTasks, task] }), () => api.addPlannerWeekTask(task));
    },
    removeWeekTask: (id: string) => change((s) => ({ ...s, weekTasks: s.weekTasks.filter((task) => task.id !== id) }), () => api.deletePlannerWeekTask(id)),
    removeRoutine: (id: string) => change((s) => ({ ...s, routines: s.routines.filter((routine) => routine.id !== id) }), () => api.deletePlannerRoutine(id)),
    refresh: refreshPlanner,
  };
}
