import { useState } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import type { StartData } from "../shared/handover";

export function StartScreen({ onStart }: { onStart: (data: StartData) => void }) {
  const [data, setData] = useState<StartData>({ name: "김민준", division: "프로덕트본부", team: "플랫폼팀", role: "프로덕트 매니저", task: "B2B 플랫폼 기획 및 운영", date: "2025-03-14" });
  const [taskDraft, setTaskDraft] = useState("");
  const update = (key: keyof StartData, value: string) => setData({ ...data, [key]: value });
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
                    <option>프로덕트본부</option>
                    <option>기술본부</option>
                    <option>사업본부</option>
                    <option>고객경험본부</option>
                    <option>경영지원본부</option>
                  </select>
                </label>
                <label>팀 <i>*</i>
                  <select value={data.team} onChange={(e) => update("team", e.target.value)}>
                    <option value="">팀 선택</option>
                    <option>플랫폼팀</option>
                    <option>서비스기획팀</option>
                    <option>프로덕트디자인팀</option>
                    <option>개발팀</option>
                    <option>데이터팀</option>
                    <option>운영팀</option>
                  </select>
                </label>
              </div>
              <label>직책
                <select value={data.role} onChange={(e) => update("role", e.target.value)}>
                  <option value="">직책 선택</option>
                  <option>사원</option>
                  <option>선임</option>
                  <option>책임</option>
                  <option>팀장</option>
                  <option>실장</option>
                  <option>본부장</option>
                  <option>프로덕트 매니저</option>
                </select>
              </label>
              <label className="wide-field task-field">담당 업무 <i>*</i>
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
          <div className="onboarding-actions">
            <button className="primary-button onboarding-next" onClick={() => onStart(data)}>다음 단계로 이동 <Icon name="arrow" size={18} /></button>
          </div>
        </section>
      </main>
      <footer className="onboarding-footer"><Icon name="shield" size={13} /> 입력한 정보는 안전하게 암호화되어 저장됩니다.</footer>
    </div>
  );
}
