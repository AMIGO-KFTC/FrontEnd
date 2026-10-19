import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Icon from "@/components/Icon";
import { questions } from "@/screens/handover/questions";
import { draftProgress, draftResourceCount, draftStageLabel, draftTitle, formatDueDate, formatRelativeTime, useAppStore, useOngoingDrafts } from "@/store/AppStore";

export default function OngoingHandoverScreen({ onHome, onNew, onContinue, onDocuments, onReceived, onLogout }: { onHome: () => void; onNew: () => void; onContinue: (id: number) => void; onDocuments: () => void; onReceived: () => void; onLogout: () => void }) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const { deleteDraft } = useAppStore();
  const projects = useOngoingDrafts().map((draft) => ({
    id: draft.id,
    title: draftTitle(draft),
    team: `${draft.startData.division} · ${draft.startData.team}`,
    stage: draftStageLabel(draft),
    progress: draftProgress(draft),
    due: formatDueDate(draft.startData.date),
    updated: formatRelativeTime(draft.updatedAt),
    files: draftResourceCount(draft),
    questions: `${draft.completedQuestions.length} / ${questions.length}`,
    tone: draft.tone,
  }));

  return (
    <div className="app-shell ongoing-page">
      <AppSidebar active="handover" onLogout={onLogout} onHome={onHome} onHandover={() => {}} onDocuments={onDocuments} onReceived={onReceived} />
      <main className="ongoing-main">
        <header className="dashboard-header">
          <div><span>MY WORKSPACE</span><strong>진행 중인 인수인계</strong></div>
          <button className="ongoing-new" onClick={onNew}><Icon name="sparkle" size={14} /> 새 인수인계</button>
        </header>
        <div className="ongoing-content">
          <section className="ongoing-title">
            <div><span>IN PROGRESS</span><h1>인수인계를 계속 작성해보세요</h1><p>진행 중인 작업을 확인하고 이어서 작성할 수 있어요.</p></div>
            <div><strong>{projects.length}</strong><span>진행 중</span></div>
          </section>
          <section className="ongoing-list">
            {projects.map((project, index) => (
              <article className="ongoing-card" key={project.id}>
                <div className={`ongoing-card-icon ${project.tone}`}><Icon name={index === 0 ? "message" : "folder"} size={20} /></div>
                <div className="ongoing-card-main">
                  <div className="ongoing-card-top"><span>{project.stage}</span><small>마지막 수정 {project.updated}</small></div>
                  <h2>{project.title}</h2>
                  <p>{project.team}</p>
                  <div className="ongoing-progress-head"><span>전체 진행률</span><strong>{project.progress}%</strong></div>
                  <div className="ongoing-progress"><span style={{ width: `${project.progress}%` }} /></div>
                  <div className="ongoing-meta">
                    <span><Icon name="clock" size={13} /> 완료 예정 {project.due}</span>
                    <span><Icon name="folder" size={13} /> 자료 {project.files}개</span>
                    <span><Icon name="message" size={13} /> 질문 {project.questions}</span>
                  </div>
                </div>
                <div className="ongoing-card-actions">
                  <button title="더보기" onClick={() => setOpenMenu((current) => current === project.id ? null : project.id)}><Icon name="more" size={17} /></button>
                  {openMenu === project.id && (
                    <div className="ongoing-more-menu">
                      <button onClick={() => { deleteDraft(project.id); setOpenMenu(null); }}><Icon name="close" size={13} /> 삭제하기</button>
                    </div>
                  )}
                  <button onClick={() => onContinue(project.id)}>이어서 작성 <Icon name="arrow" size={15} /></button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
