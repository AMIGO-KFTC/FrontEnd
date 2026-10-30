// 일정 관리(팀장). 우리 팀 일정 두 가지를 등록한다. 모두 등록한 팀장의 소속(부서 팀) 단위라 같은 팀 구성원에게만 보인다.
// - 정기인사: 1년에 여러 번(상·하반기, 수시 인사). 구성원의 홈·캘린더 D-day 와 달력에 나온다. GET /api/personnel-schedules, 추가·수정·삭제 /api/admin/personnel-schedules
// - 팀 공유 일정: 워크숍·회의·마감 등. 구성원의 홈·캘린더 달력에 나온다. GET /api/team-schedules, 추가·수정·삭제 /api/admin/team-schedules
import { useState, type FormEvent } from "react";
import { api } from "@/shared/api";
import { DatePicker } from "@/shared/DatePicker";
import { longDate, refreshPersonnel, usePersonnel } from "@/shared/personnel";
import { dateKey, formatDday } from "@/shared/planner";
import type { PersonnelSchedule, TeamSchedule } from "@/shared/types";

type Notice = { tone: "info" | "error"; text: string } | null;

function ddayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return formatDday(Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86400000));
}

// 저장·삭제 공통: 바쁜 표시, 안내 문구, 끝나면 홈·캘린더가 쓰는 일정도 새로 불러온다.
function useScheduleAction() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const run = async (action: () => Promise<{ message: string }>): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await action();
      setNotice({ tone: "info", text: result.message });
      await refreshPersonnel();
      return true;
    } catch (e) {
      setNotice({ tone: "error", text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, notice, setNotice, run };
}

export function AdminPersonnelPage() {
  const [tab, setTab] = useState<"personnel" | "shared">("personnel");
  return (
    <div className="admin-personnel-page">
      <section className="members-page-title">
        <div><h1>일정 관리</h1><p>우리 팀의 정기인사 일정과 팀원들과 함께 볼 일정을 등록하면, 팀원들의 홈 화면과 캘린더에 나와요.</p></div>
      </section>
      <div className="schedule-kind-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "personnel"} className={tab === "personnel" ? "active" : ""} onClick={() => setTab("personnel")}>정기인사 일정</button>
        <button role="tab" aria-selected={tab === "shared"} className={tab === "shared" ? "active" : ""} onClick={() => setTab("shared")}>팀 공유 일정</button>
      </div>
      {tab === "personnel" ? <PersonnelSchedules /> : <SharedSchedules />}
    </div>
  );
}

type PersonnelDraft = { name: string; announce_date: string; appoint_date: string };
const EMPTY_PERSONNEL: PersonnelDraft = { name: "", announce_date: "", appoint_date: "" };

function PersonnelSchedules() {
  const { schedules } = usePersonnel();
  const [draft, setDraft] = useState<PersonnelDraft>(EMPTY_PERSONNEL);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { busy, notice, setNotice, run } = useScheduleAction();
  const todayKey = dateKey(new Date());
  const upcoming = schedules.filter((s) => s.appoint_date >= todayKey);
  const past = schedules.filter((s) => s.appoint_date < todayKey).reverse();

  const startEdit = (schedule: PersonnelSchedule) => {
    setEditingId(schedule.id);
    setDraft({ name: schedule.name, announce_date: schedule.announce_date ?? "", appoint_date: schedule.appoint_date });
    setNotice(null);
  };
  const reset = () => {
    setEditingId(null);
    setDraft(EMPTY_PERSONNEL);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.appoint_date) {
      setNotice({ tone: "error", text: "일정 이름과 발령일을 입력해 주세요." });
      return;
    }
    const body = { name: draft.name.trim(), announce_date: draft.announce_date || null, appoint_date: draft.appoint_date };
    if (await run(() => (editingId === null ? api.addPersonnelSchedule(body) : api.updatePersonnelSchedule(editingId, body)))) reset();
  };
  const remove = async (schedule: PersonnelSchedule) => {
    if ((await run(() => api.deletePersonnelSchedule(schedule.id))) && editingId === schedule.id) reset();
  };

  const row = (schedule: PersonnelSchedule, isPast: boolean) => (
    <div className={`personnel-row ${isPast ? "past" : ""} ${editingId === schedule.id ? "editing" : ""}`} key={schedule.id}>
      <div><strong>{schedule.name}</strong><small>등록 {schedule.created_by || "—"}</small></div>
      <span>{schedule.announce_date ? longDate(schedule.announce_date) : "—"}</span>
      <span>{longDate(schedule.appoint_date)}</span>
      <em className={isPast ? "past" : ""}>{ddayOf(schedule.appoint_date)}</em>
      <div className="personnel-row-actions">
        <button onClick={() => startEdit(schedule)} disabled={busy}>수정</button>
        <button onClick={() => void remove(schedule)} disabled={busy} className="danger">삭제</button>
      </div>
    </div>
  );

  return (
    <div className="personnel-layout">
      <section className="admin-panel personnel-list">
        <header><div><h2>등록된 정기인사</h2></div><span>다가오는 {upcoming.length}건</span></header>
        <div className="personnel-head"><span>이름</span><span>발표일</span><span>발령일</span><span>D-day</span><span /></div>
        {upcoming.map((s) => row(s, false))}
        {past.length > 0 && <div className="personnel-divider">지난 일정</div>}
        {past.map((s) => row(s, true))}
      </section>
      <form className="admin-panel personnel-form" onSubmit={submit}>
        <header><div><h2>{editingId === null ? "정기인사 추가" : "정기인사 수정"}</h2></div>{editingId !== null && <button type="button" className="text-button" onClick={reset}>취소</button>}</header>
        <label>일정 이름<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="예: 2027 상반기 정기인사" maxLength={100} /></label>
        <label>발표일 <small>(선택)</small><DatePicker value={draft.announce_date} onChange={(value) => setDraft({ ...draft, announce_date: value })} clearable ariaLabel="발표일" /></label>
        <label>발령일<DatePicker value={draft.appoint_date} openMonth={draft.announce_date} onChange={(value) => setDraft({ ...draft, appoint_date: value })} ariaLabel="발령일" /></label>
        {notice && <p className={`personnel-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
        <button type="submit" className="personnel-submit" disabled={busy}>{busy ? "저장 중…" : editingId === null ? "일정 추가" : "수정 저장"}</button>
      </form>
    </div>
  );
}

type SharedDraft = { title: string; start_date: string; end_date: string; memo: string };
const EMPTY_SHARED: SharedDraft = { title: "", start_date: "", end_date: "", memo: "" };

// "2026년 11월 12일 ~ 11월 13일"(하루짜리면 시작일만)
function periodLabel(schedule: TeamSchedule): string {
  if (!schedule.end_date) return longDate(schedule.start_date);
  const [, m, d] = schedule.end_date.split("-").map(Number);
  return `${longDate(schedule.start_date)} ~ ${m}월 ${d}일`;
}

function SharedSchedules() {
  const { teamSchedules } = usePersonnel();
  const [draft, setDraft] = useState<SharedDraft>(EMPTY_SHARED);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { busy, notice, setNotice, run } = useScheduleAction();
  const todayKey = dateKey(new Date());
  const isPast = (s: TeamSchedule) => (s.end_date ?? s.start_date) < todayKey;
  const upcoming = teamSchedules.filter((s) => !isPast(s));
  const past = teamSchedules.filter(isPast).reverse();

  const startEdit = (schedule: TeamSchedule) => {
    setEditingId(schedule.id);
    setDraft({ title: schedule.title, start_date: schedule.start_date, end_date: schedule.end_date ?? "", memo: schedule.memo });
    setNotice(null);
  };
  const reset = () => {
    setEditingId(null);
    setDraft(EMPTY_SHARED);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.start_date) {
      setNotice({ tone: "error", text: "일정 이름과 날짜를 입력해 주세요." });
      return;
    }
    const body = { title: draft.title.trim(), start_date: draft.start_date, end_date: draft.end_date || null, memo: draft.memo.trim() };
    if (await run(() => (editingId === null ? api.addTeamSchedule(body) : api.updateTeamSchedule(editingId, body)))) reset();
  };
  const remove = async (schedule: TeamSchedule) => {
    if ((await run(() => api.deleteTeamSchedule(schedule.id))) && editingId === schedule.id) reset();
  };

  const row = (schedule: TeamSchedule, past: boolean) => (
    <div className={`personnel-row ${past ? "past" : ""} ${editingId === schedule.id ? "editing" : ""}`} key={schedule.id}>
      <div><strong>{schedule.title}</strong><small>등록 {schedule.created_by || "—"}</small></div>
      <span>{periodLabel(schedule)}</span>
      <span title={schedule.memo}>{schedule.memo || "—"}</span>
      <em className={past ? "past" : ""}>{ddayOf(schedule.start_date)}</em>
      <div className="personnel-row-actions">
        <button onClick={() => startEdit(schedule)} disabled={busy}>수정</button>
        <button onClick={() => void remove(schedule)} disabled={busy} className="danger">삭제</button>
      </div>
    </div>
  );

  return (
    <div className="personnel-layout">
      <section className="admin-panel personnel-list">
        <header><div><h2>팀 공유 일정</h2></div><span>다가오는 {upcoming.length}건</span></header>
        <div className="personnel-head"><span>이름</span><span>날짜</span><span>메모</span><span>D-day</span><span /></div>
        {upcoming.map((s) => row(s, false))}
        {past.length > 0 && <div className="personnel-divider">지난 일정</div>}
        {past.map((s) => row(s, true))}
      </section>
      <form className="admin-panel personnel-form" onSubmit={submit}>
        <header><div><h2>{editingId === null ? "공유 일정 추가" : "공유 일정 수정"}</h2></div>{editingId !== null && <button type="button" className="text-button" onClick={reset}>취소</button>}</header>
        <label>일정 이름<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="예: 하반기 팀 워크숍" maxLength={100} /></label>
        <label>날짜<DatePicker value={draft.start_date} onChange={(value) => setDraft({ ...draft, start_date: value })} ariaLabel="날짜" /></label>
        <label>끝나는 날 <small>(여러 날일 때)</small><DatePicker value={draft.end_date} min={draft.start_date || undefined} openMonth={draft.start_date} onChange={(value) => setDraft({ ...draft, end_date: value })} clearable ariaLabel="끝나는 날" /></label>
        <label>메모 <small>(선택)</small><input value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} placeholder="예: 대전 연수원, 오후 2시" maxLength={300} /></label>
        {notice && <p className={`personnel-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
        <button type="submit" className="personnel-submit" disabled={busy}>{busy ? "저장 중…" : editingId === null ? "일정 추가" : "수정 저장"}</button>
      </form>
    </div>
  );
}
