// 팀장(관리자)이 팀 관리 > '일정 관리'에서 등록하는 우리 팀 일정 두 가지를 불러 둔다.
// - 정기인사 일정(GET /api/personnel-schedules): 홈 대시보드의 작은 캘린더와 '캘린더' 화면이 다가오는 일정의 D-day 와 발표일·발령일 표시에 쓴다.
// - 팀 공유 일정(GET /api/team-schedules): 워크숍·회의·마감 등. 같은 두 캘린더에 날짜마다 표시한다(여러 날짜리는 그 기간 모든 날).
// 등록된 일정이 하나도 없으면 예전처럼 매년 10/26 발표 · 10/28 발령을 기본값으로 쓴다(planner.ts 의 personnelDays).
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { dateKey, personnelDays } from "./planner";
import { useProfile } from "./profile";
import type { PersonnelSchedule, TeamSchedule } from "./types";

// kind: announcement·appointment = 정기인사 발표·발령, shared = 팀 공유 일정
export type PersonnelMark = { key: string; label: string; kind: "announcement" | "appointment" | "shared" };
export type PersonnelDay = { key: string; dday: number };
export type PersonnelNext = { name: string; announce: PersonnelDay | null; appoint: PersonnelDay };
// next: 발령일이 오늘이거나 앞으로인 가장 가까운 일정(없으면 null), marks: 달력에 칠할 모든 발표일·발령일
export type PersonnelView = { next: PersonnelNext | null; marks: PersonnelMark[]; registered: boolean };

const store = {
  loginId: null as string | null,
  schedules: [] as PersonnelSchedule[],
  teamSchedules: [] as TeamSchedule[],
  listeners: new Set<() => void>(),
};

function notify() {
  store.listeners.forEach((listener) => listener());
}

// 서버 값으로 다시 맞춘다(팀장이 일정을 고친 뒤). 실패한 쪽은 가지고 있던 값을 그대로 둔다.
export function refreshPersonnel(): Promise<void> {
  const loginId = store.loginId;
  if (!loginId) return Promise.resolve();
  const personnel = api
    .personnelSchedules()
    .then(({ schedules }) => {
      if (store.loginId !== loginId) return;
      store.schedules = schedules;
      notify();
    })
    .catch(() => undefined);
  const shared = api
    .teamSchedules()
    .then(({ schedules }) => {
      if (store.loginId !== loginId) return;
      store.teamSchedules = schedules;
      notify();
    })
    .catch(() => undefined);
  return Promise.all([personnel, shared]).then(() => undefined);
}

function select(loginId: string) {
  if (store.loginId === loginId) return;
  store.loginId = loginId;
  store.schedules = [];
  store.teamSchedules = [];
  notify();
  if (loginId) void refreshPersonnel();
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function dday(today: Date, key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// "2027-01-15" → "2027년 1월 15일"
export function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

const MAX_SHARED_DAYS = 62; // 기간이 아주 긴 공유 일정도 달력을 뒤덮지 않게

// 공유 일정이 걸친 모든 날짜(하루짜리면 시작일 하나)
export function scheduleDays(schedule: TeamSchedule): string[] {
  const [y, m, d] = schedule.start_date.split("-").map(Number);
  const end = schedule.end_date ?? schedule.start_date;
  const days: string[] = [];
  for (let i = 0; i < MAX_SHARED_DAYS; i += 1) {
    const key = dateKey(new Date(y, m - 1, d + i));
    if (key > end) break;
    days.push(key);
  }
  return days;
}

export function personnelView(today: Date, schedules: PersonnelSchedule[], teamSchedules: TeamSchedule[] = []): PersonnelView {
  const shared: PersonnelMark[] = teamSchedules.flatMap((s) => scheduleDays(s).map((key) => ({ key, label: s.title, kind: "shared" as const })));
  if (!schedules.length) {
    const fallback = personnelDays(today);
    return {
      registered: false,
      next: {
        name: "정기인사",
        announce: { key: fallback.announcement.key, dday: fallback.announcement.dday },
        appoint: { key: fallback.appointment.key, dday: fallback.appointment.dday },
      },
      marks: [
        { key: fallback.announcement.key, label: fallback.announcement.label, kind: "announcement" },
        { key: fallback.appointment.key, label: fallback.appointment.label, kind: "appointment" },
        ...shared,
      ],
    };
  }
  const todayKey = dateKey(today);
  const marks: PersonnelMark[] = schedules.flatMap((s): PersonnelMark[] => [
    ...(s.announce_date ? [{ key: s.announce_date, label: `${s.name} 발표`, kind: "announcement" as const }] : []),
    { key: s.appoint_date, label: `${s.name} 발령`, kind: "appointment" as const },
  ]).concat(shared);
  const upcoming = [...schedules].filter((s) => s.appoint_date >= todayKey).sort((a, b) => a.appoint_date.localeCompare(b.appoint_date))[0];
  return {
    registered: true,
    marks,
    next: upcoming
      ? {
          name: upcoming.name,
          announce: upcoming.announce_date ? { key: upcoming.announce_date, dday: dday(today, upcoming.announce_date) } : null,
          appoint: { key: upcoming.appoint_date, dday: dday(today, upcoming.appoint_date) },
        }
      : null,
  };
}

export function usePersonnel() {
  const [profile] = useProfile();
  if (store.loginId === null) select(profile.loginId); // 첫 화면 그리기 전에 불러오기 시작

  useEffect(() => {
    select(profile.loginId); // 다른 계정으로 바뀌면 그 계정의 일정을 불러온다
  }, [profile.loginId]);

  const schedules = useSyncExternalStore(subscribe, () => store.schedules);
  const teamSchedules = useSyncExternalStore(subscribe, () => store.teamSchedules);
  return { schedules, teamSchedules, refresh: refreshPersonnel };
}
