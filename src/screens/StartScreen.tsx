import { useState } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import { ErrorNote } from "../shared/ErrorNote";
import type { StartData } from "../shared/handover";
import { StepUserMenu } from "../shared/StepUserMenu";
import { useProfile } from "../shared/profile";

const DIVISIONS = ["프로덕트본부", "기술본부", "사업본부", "고객경험본부", "경영지원본부"];
const TEAMS = ["플랫폼팀", "서비스기획팀", "프로덕트디자인팀", "개발팀", "데이터팀", "운영팀"];
const ROLES = ["사원", "선임", "책임", "팀장", "실장", "본부장", "프로덕트 매니저"];

// 서버 프로필의 값이 보기 목록에 없으면 목록 앞에 끼워 넣어 select 가 빈칸으로 보이지 않게 한다.
function withValue(options: string[], value: string): string[] {
  return value && !options.includes(value) ? [value, ...options] : options;
}

type Props = { onStart: (data: StartData) => void; onLogout: () => void; onHome: () => void; busy?: boolean; error?: string | null };

export function StartScreen({ onStart, onLogout, onHome, busy = false, error = null }: Props) {
  const [profile] = useProfile();
  // 성명·소속·직책은 로그인한 사용자 정보로 미리 채운다. 담당 업무와 인계일은 직접 입력한다.
  const [data, setData] = useState<StartData>({ mode: "reassignment", name: profile.name, division: profile.division, team: profile.team, role: profile.role, task: "", date: "" });
  const [taskDraft, setTaskDraft] = useState("");
  const update = (key: Exclude<keyof StartData, "mode">, value: string) => setData({ ...data, [key]: value });
  const tasks = data.task.split("\n").filter(Boolean);
  const addTask = () => {
    const nextTask = taskDraft.trim();
    if (!nextTask) return;
    update("task", [...tasks, nextTask].join("\n"));
    setTaskDraft("");
  };
  const removeTask = (index: number) => update("task", tasks.filter((_, taskIndex) => taskIndex !== index).join("\n"));

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <Brand />
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
              <span>STEP 01 · 기본 정보</span>
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
              <label className="wide-field">인수인계 유형
                <select value={data.mode} onChange={(e) => setData({ ...data, mode: e.target.value === "leave" ? "leave" : "reassignment" })}>
                  <option value="reassignment">인사발령 (전체 양식)</option>
                  <option value="leave">장기휴가 (부재 중 처리할 단위 업무·세부 업무·시스템 접근 권한)</option>
                </select>
              </label>
              <label>직책
                <select value={data.role} onChange={(e) => update("role", e.target.value)}>
                  <option value="">직책 선택</option>
                  {withValue(ROLES, data.role).map((option) => <option key={option}>{option}</option>)}
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
                        if (event.key === "Enter") {
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
              <label className="wide-field date-field">인계 예정일<input type="date" value={data.date} onChange={(e) => update("date", e.target.value)} /></label>
            </div>
          <ErrorNote message={error} />
          <div className="onboarding-actions">
            <button className="primary-button onboarding-next" disabled={busy} onClick={() => onStart(data)}>다음 단계로 이동 <Icon name="arrow" size={18} /></button>
          </div>
        </section>
      </main>
    </div>
  );
}
