// STEP 01 기본 정보. 유형은 앞 화면(HandoverTypeScreen)에서 고른 값을 받는다. 화면에는 담당 업무(장기휴가면 휴가 기간도)만 묻고,
// 성명·소속·직책은 로그인한 사용자 프로필 값을 그대로 쓴다. 인수자는 완성 문서 화면의 '인수자에게 전송하기'에서 고른다.
// 담당 업무는 팀장이 관리자 화면(팀 담당 업무)에 정해 둔 우리 팀 업무 목록(GET /api/team-duties/me)을 먼저 보여 주고, 목록에 없는 업무는 직접 적는다.
// 팀 업무가 많아도 화면을 넘치지 않도록 고른 업무는 위에 칩으로, 목록은 검색할 수 있는 한 줄짜리 체크 목록(높이 제한·스크롤)으로 보여 준다.
import { useEffect, useState } from "react";
import { api } from "@/shared/api";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import type { StartData } from "@/shared/handover";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { useProfile } from "@/shared/profile";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { HandoverMode, TeamDuty } from "@/shared/types";

type Props = { mode: HandoverMode; onStart: (data: StartData) => void; onLogout: () => void; onHome: () => void; busy?: boolean; error?: string | null };

export function StartScreen({ mode, onStart, onLogout, onHome, busy = false, error = null }: Props) {
  const [profile] = useProfile();
  const [data, setData] = useState<StartData>({ mode, name: profile.name, division: profile.division, team: profile.team, role: profile.role, task: "", date: "", successor: "", successorLoginId: "", leaveStart: "", leaveEnd: "" });
  const [taskDraft, setTaskDraft] = useState("");
  const [dutyQuery, setDutyQuery] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [leaveError, setLeaveError] = useState("");
  // 우리 팀 업무 목록(null = 불러오는 중). 못 불러오면 빈 목록으로 두고 직접 적게 한다.
  const [teamDuties, setTeamDuties] = useState<TeamDuty[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .teamDuties()
      .then((result) => !cancelled && setTeamDuties(result.duties))
      .catch(() => !cancelled && setTeamDuties([]));
    return () => {
      cancelled = true;
    };
  }, []);
  const update = (key: Exclude<keyof StartData, "mode">, value: string) => setData({ ...data, [key]: value });
  const tasks = data.task.split("\n").filter(Boolean);
  const dutyNames = new Set((teamDuties ?? []).map((duty) => duty.name));
  const dutyKeyword = dutyQuery.trim().toLowerCase();
  const shownDuties = (teamDuties ?? []).filter((duty) => !dutyKeyword || duty.name.toLowerCase().includes(dutyKeyword) || duty.description.toLowerCase().includes(dutyKeyword));
  const toggleDuty = (name: string) => update("task", (tasks.includes(name) ? tasks.filter((task) => task !== name) : [...tasks, name]).join("\n"));
  const addTask = () => {
    const nextTask = taskDraft.trim();
    if (!nextTask) return;
    if (!tasks.includes(nextTask)) update("task", [...tasks, nextTask].join("\n"));
    setTaskDraft("");
  };
  const removeTask = (name: string) => update("task", tasks.filter((task) => task !== name).join("\n"));

  // 담당 업무(장기휴가면 휴가 기간도)가 비어 있으면 넘어가지 않는다. 입력칸에 적어 두고 Enter 를 안 누른 업무도 포함한다.
  const submit = () => {
    if (busy) return;
    const pendingTask = taskDraft.trim();
    const allTasks = pendingTask && !tasks.includes(pendingTask) ? [...tasks, pendingTask] : tasks;
    const next = { ...data, name: profile.name, division: profile.division, team: profile.team, role: profile.role, task: allTasks.join("\n") };
    const empty = [
      [!allTasks.length, "담당 업무"],
      [mode === "leave" && (!next.leaveStart || !next.leaveEnd), "휴가 기간"],
    ].filter(([isEmpty]) => isEmpty).map(([, label]) => label as string);
    setMissing(empty);
    if (empty.length) return;
    if (mode === "leave" && next.leaveEnd < next.leaveStart) {
      setLeaveError("휴가 종료일은 시작일보다 빠를 수 없어요.");
      return;
    }
    setLeaveError("");
    if (pendingTask) {
      setData(next);
      setTaskDraft("");
    }
    onStart(next);
  };

  return (
    <div className={`onboarding-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand onClick={onHome} />
        <div className="onboarding-progress">
          <span className="active" />
          <span />
          <span />
          <span />
          <small>1 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="onboarding-main">
        <section className="onboarding-card">
          <div className="onboarding-card-title">
            <div>
              <span>1단계 · 기본 정보 · {mode === "leave" ? "장기휴가" : "정기인사 발령"}</span>
              <h2>인계 정보를 알려주세요</h2>
              <p>AMIGO가 업무의 맥락을 이해하는 데 필요한 정보예요.</p>
            </div>
            <span className="required-note"><i /> 필수 입력</span>
          </div>
            <div className="field-grid">
              <div className="wide-field task-field">
                <span className="task-field-label">담당 업무 <i>*</i></span>
                <p className="task-field-hint">{profile.team || "우리 팀"}에서 정해 둔 업무예요. 맡고 있는 업무를 모두 골라 주세요.</p>
                {tasks.length > 0 && (
                  <div className="picked-duties" aria-label="고른 담당 업무">
                    {tasks.map((task) => (
                      <span className={`task-chip${dutyNames.has(task) ? "" : " custom"}`} key={task}>{task}<button type="button" onClick={() => removeTask(task)} aria-label={`${task} 빼기`}><Icon name="close" size={12} /></button></span>
                    ))}
                  </div>
                )}
                {teamDuties === null ? (
                  <p className="team-duty-picker-empty">팀 업무 목록을 불러오는 중…</p>
                ) : teamDuties.length === 0 ? (
                  <p className="team-duty-picker-empty">팀장이 아직 팀 업무를 등록하지 않았어요.{"\n"}아래에 담당 업무를 직접 적어 주세요.</p>
                ) : (
                  <div className="team-duty-box">
                    {teamDuties.length > 6 && (
                      <label className="team-duty-search">
                        <Icon name="search" size={13} />
                        <input value={dutyQuery} onChange={(event) => setDutyQuery(event.target.value)} placeholder={`팀 업무 ${teamDuties.length}개에서 검색`} aria-label="팀 업무 검색" />
                        {dutyQuery && <button type="button" onClick={() => setDutyQuery("")} aria-label="검색어 지우기"><Icon name="close" size={11} /></button>}
                      </label>
                    )}
                    <div className="team-duty-picker" role="group" aria-label="우리 팀 업무">
                      {shownDuties.length === 0 && <p className="team-duty-picker-none">‘{dutyQuery.trim()}’에 맞는 팀 업무가 없어요. 아래에 직접 적어 주세요.</p>}
                      {shownDuties.map((duty) => {
                        const picked = tasks.includes(duty.name);
                        return (
                          <button key={duty.id} type="button" className={picked ? "picked" : ""} aria-pressed={picked} onClick={() => toggleDuty(duty.name)} title={duty.description ? `${duty.name} — ${duty.description}` : duty.name}>
                            <span className="team-duty-check">{picked && <Icon name="check" size={11} />}</span>
                            <span className="team-duty-text"><strong>{duty.name}</strong>{duty.description && <small>{duty.description}</small>}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="team-duty-count">{teamDuties.length}개 중 {tasks.filter((task) => dutyNames.has(task)).length}개 골랐어요</p>
                  </div>
                )}
                <div className="task-editor">
                  <div className="task-input-row">
                    <input
                      value={taskDraft}
                      onChange={(event) => setTaskDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 무시한다
                          event.preventDefault();
                          addTask();
                        }
                      }}
                      placeholder="목록에 없는 업무는 입력하고 Enter를 눌러 추가하세요"
                      aria-label="담당 업무 직접 추가"
                    />
                    <button type="button" onClick={addTask}>추가</button>
                  </div>
                </div>
              </div>
              {mode === "leave" && (
                <div className="wide-field leave-period-field">
                  <label>휴가 시작일 <i>*</i><input type="date" value={data.leaveStart} max={data.leaveEnd || undefined} onChange={(e) => update("leaveStart", e.target.value)} /></label>
                  <label>휴가 종료일 <i>*</i><input type="date" value={data.leaveEnd} min={data.leaveStart || undefined} onChange={(e) => update("leaveEnd", e.target.value)} /></label>
                </div>
              )}
            </div>
          <ErrorNote message={error ?? (leaveError || null) ?? (missing.length ? `필수 항목을 입력해 주세요: ${missing.join(", ")}` : null)} />
          <div className="onboarding-actions">
            <button className="primary-button onboarding-next" disabled={busy} onClick={submit}>{busy ? "작업을 만들고 있어요…" : "다음 단계로 이동"} <Icon name="arrow" size={18} /></button>
          </div>
        </section>
      </main>
    </div>
  );
}
