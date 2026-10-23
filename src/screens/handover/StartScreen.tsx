// STEP 01 기본 정보. 유형은 앞 화면(HandoverTypeScreen)에서 고른 값을 받고, 성명·소속·직책은 로그인한 사용자 정보로 미리 채운다.
import { useEffect, useState } from "react";
import { api } from "@/shared/api";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import type { StartData } from "@/shared/handover";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { useProfile } from "@/shared/profile";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { HandoverMode, Member } from "@/shared/types";

const DIVISIONS = ["프로덕트본부", "기술본부", "사업본부", "고객경험본부", "경영지원본부"];
const TEAMS = ["플랫폼팀", "서비스기획팀", "프로덕트디자인팀", "개발팀", "데이터팀", "운영팀"];
const ROLES = ["사원", "선임", "책임", "팀장", "실장", "본부장", "프로덕트 매니저"];

// 서버 프로필의 값이 보기 목록에 없으면 목록 앞에 끼워 넣어 select 가 빈칸으로 보이지 않게 한다.
function withValue(options: string[], value: string): string[] {
  return value && !options.includes(value) ? [value, ...options] : options;
}

type Props = { mode: HandoverMode; onStart: (data: StartData) => void; onLogout: () => void; onHome: () => void; busy?: boolean; error?: string | null };

export function StartScreen({ mode, onStart, onLogout, onHome, busy = false, error = null }: Props) {
  const [profile] = useProfile();
  const [data, setData] = useState<StartData>({ mode, name: profile.name, division: profile.division, team: profile.team, role: profile.role, task: "", date: "", successor: "", successorLoginId: "", leaveStart: "", leaveEnd: "" });
  const [taskDraft, setTaskDraft] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [leaveError, setLeaveError] = useState("");
  // 인수자(예정) 선택 목록: 프로필을 입력한 다른 계정. 문서에 적힐 이름일 뿐 바로 전달되지 않는다. 전달은 완성 문서 화면의 '인수자에게 전송하기'에서 한다(못 불러오면 비워 둔다).
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    api
      .members()
      .then((result) => setMembers(result.members.filter((member) => member.login_id !== profile.loginId)))
      .catch(() => setMembers([]));
  }, [profile.loginId]);
  const update = (key: Exclude<keyof StartData, "mode">, value: string) => setData({ ...data, [key]: value });
  const pickSuccessor = (loginId: string) => {
    const member = members.find((m) => m.login_id === loginId);
    setData({ ...data, successorLoginId: member ? member.login_id : "", successor: member ? `${member.name} ${member.position}`.trim() : "" });
  };
  const tasks = data.task.split("\n").filter(Boolean);
  const addTask = () => {
    const nextTask = taskDraft.trim();
    if (!nextTask) return;
    update("task", [...tasks, nextTask].join("\n"));
    setTaskDraft("");
  };
  const removeTask = (index: number) => update("task", tasks.filter((_, taskIndex) => taskIndex !== index).join("\n"));

  // 필수 항목(성명·본부·팀·담당 업무)이 비어 있으면 넘어가지 않는다. 입력칸에 적어 두고 Enter 를 안 누른 업무도 포함한다.
  const submit = () => {
    if (busy) return;
    const pendingTask = taskDraft.trim();
    const allTasks = pendingTask ? [...tasks, pendingTask] : tasks;
    const next = { ...data, task: allTasks.join("\n") };
    const empty = [
      [!next.name.trim(), "성명"],
      [!next.division, "본부"],
      [!next.team, "팀"],
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
              <span>STEP 01 · 기본 정보 · {mode === "leave" ? "장기휴가" : "정기인사 발령"}</span>
              <h2>인계 정보를 알려주세요</h2>
              <p>AMIGO가 업무의 맥락을 이해하는 데 필요한 정보예요.</p>
            </div>
            <span className="required-note"><i /> 필수 입력</span>
          </div>
            <div className="field-grid">
              <label>성명 <i>*</i><input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="이름을 입력하세요" /></label>
              <div className="org-field-row">
                <label>본부 <i>*</i>
                  <select value={data.division} onChange={(e) => update("division", e.target.value)}>
                    <option value="">본부 선택</option>
                    {withValue(DIVISIONS, data.division).map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label>팀 <i>*</i>
                  <select value={data.team} onChange={(e) => update("team", e.target.value)}>
                    <option value="">팀 선택</option>
                    {withValue(TEAMS, data.team).map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <label>직책
                <select value={data.role} onChange={(e) => update("role", e.target.value)}>
                  <option value="">직책 선택</option>
                  {withValue(ROLES, data.role).map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>인수자 (예정)
                <select value={data.successorLoginId} onChange={(e) => pickSuccessor(e.target.value)}>
                  <option value="">나중에 정할게요</option>
                  {members.map((member) => <option key={member.login_id} value={member.login_id}>{member.name} {member.position} · {member.team || member.department}</option>)}
                </select>
              </label>
              <label className="wide-field task-field" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>담당 업무 <i>*</i>
                <div className="task-editor">
                  <div className="task-list">
                    {tasks.map((task, index) => (
                      <span className="task-chip" key={`${task}-${index}`}>{task}<button onClick={() => removeTask(index)} aria-label={`${task} 삭제`}><Icon name="close" size={12} /></button></span>
                    ))}
                  </div>
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
                      placeholder="업무를 입력하고 Enter를 눌러 추가하세요"
                    />
                    <button onClick={addTask}>추가</button>
                  </div>
                </div>
              </label>
              {mode === "leave" && (
                <div className="wide-field leave-period-field">
                  <label>휴가 시작일 <i>*</i><input type="date" value={data.leaveStart} max={data.leaveEnd || undefined} onChange={(e) => update("leaveStart", e.target.value)} /></label>
                  <label>휴가 종료일 <i>*</i><input type="date" value={data.leaveEnd} min={data.leaveStart || undefined} onChange={(e) => update("leaveEnd", e.target.value)} /></label>
                </div>
              )}
              <label className="wide-field date-field">인계 예정일<input type="date" value={data.date} onChange={(e) => update("date", e.target.value)} /></label>
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
