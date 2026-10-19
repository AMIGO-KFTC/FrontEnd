// 진행 중인 인수인계 목록. 서버 세션 중 문서가 아직 없는 작업을 보여 주고, "이어서 작성"은 저장된 단계로 들어간다.
import { useState } from "react";
import { AppSidebar } from "@/shared/AppSidebar";
import { ConfirmModal } from "@/shared/ConfirmModal";
import { Icon } from "@/shared/Icon";
import { formatDate, formatRelativeTime, MODE_LABEL, ongoingSessions, sessionProgress, sessionTitle, sessionTone, STAGE_LABEL, STATUS_LABEL } from "@/shared/sessions";
import type { HomeNav, SessionList } from "./types";

type Props = HomeNav & { list: SessionList; onNew: () => void };

export function OngoingHandoverScreen({ list, onNew, onHome, onHandover, onDocuments, onReceived, onLogout }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null); // 삭제 확인 창을 띄운 세션
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const projects = list.sessions ? ongoingSessions(list.sessions) : null;
  const target = deleting && list.sessions ? list.sessions.find((session) => session.id === deleting) : undefined;

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    const error = await list.remove(deleting);
    setDeleteBusy(false);
    setDeleting(null);
    setDeleteError(error);
  };

  return (
    <div className="app-shell ongoing-page">
      <AppSidebar active="handover" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} />
      <main className="ongoing-main">
        <header className="dashboard-header">
          <div><span>MY WORKSPACE</span><strong>진행 중인 인수인계</strong></div>
          <button className="ongoing-new" onClick={onNew}><Icon name="sparkle" size={14} /> 새 인수인계</button>
        </header>
        <div className="ongoing-content">
          <section className="ongoing-title">
            <div><span>IN PROGRESS</span><h1>인수인계를 계속 작성해보세요</h1><p>진행 중인 작업을 확인하고 이어서 작성할 수 있어요.</p></div>
            <div><strong>{projects ? projects.length : "—"}</strong><span>진행 중</span></div>
          </section>
          <section className="ongoing-list">
            {deleteError && <div className="list-notice error" role="alert">삭제하지 못했어요: {deleteError}<button onClick={() => setDeleteError(null)}>닫기</button></div>}
            {list.error && <div className="list-notice error" role="alert">작업 목록을 불러오지 못했어요: {list.error}<button onClick={list.reload}>다시 시도</button></div>}
            {projects && projects.length === 0 && !list.error && (
              <div className="list-notice">진행 중인 인수인계가 없어요.<button onClick={onNew}>새 인수인계 시작하기</button></div>
            )}
            {(projects ?? []).map((session) => {
              const progress = sessionProgress(session);
              return (
                <article className="ongoing-card" key={session.id}>
                  <div className={`ongoing-card-icon ${sessionTone(session.id)}`}><Icon name={session.stage === "setup" ? "folder" : "message"} size={20} /></div>
                  <div className="ongoing-card-main">
                    <div className="ongoing-card-top"><span>{STAGE_LABEL[session.stage]}{session.status === "error" ? " · 오류" : ""}</span><small>마지막 수정 {formatRelativeTime(session.updated_at)}</small></div>
                    <h2>{sessionTitle(session)}</h2>
                    <p>{session.organization || "소속 미입력"}{session.position ? ` · ${session.position}` : ""}</p>
                    <div className="ongoing-progress-head"><span>전체 진행률</span><strong>{progress}%</strong></div>
                    <div className="ongoing-progress"><span style={{ width: `${progress}%` }} /></div>
                    <div className="ongoing-meta">
                      <span><Icon name="folder" size={13} /> {MODE_LABEL[session.mode]}</span>
                      <span><Icon name="clock" size={13} /> 시작 {formatDate(session.created_at)}</span>
                      <span><Icon name="sparkle" size={13} /> {STATUS_LABEL[session.status]}</span>
                    </div>
                  </div>
                  <div className="ongoing-card-actions">
                    <button title="더보기" onClick={() => setOpenMenu((current) => (current === session.id ? null : session.id))}><Icon name="more" size={17} /></button>
                    {openMenu === session.id && (
                      <div className="ongoing-more-menu">
                        <button onClick={() => { setOpenMenu(null); setDeleteError(null); setDeleting(session.id); }}><Icon name="close" size={13} /> 삭제하기</button>
                      </div>
                    )}
                    <button onClick={() => list.open(session.id)}>이어서 작성 <Icon name="arrow" size={15} /></button>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>
      {deleting && (
        <ConfirmModal
          icon="close"
          title="이 인수인계를 삭제할까요?"
          description={`${target ? sessionTitle(target) : "선택한 작업"}의 자료·대화·문서가 서버에서 모두 지워지며 되돌릴 수 없습니다.`}
          confirmLabel="삭제하기"
          busy={deleteBusy}
          onCancel={() => !deleteBusy && setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
