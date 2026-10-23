// 완성 문서 목록. 서버 세션 중 문서가 만들어진 작업을 보여 주고, 문서 열기는 문서 화면으로, PDF 는 다운로드 API 로 연결한다.
import { useEffect, useState } from "react";
import { api } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon } from "@/shared/Icon";
import { completedSessions, formatDate, MODE_LABEL, sessionTitle, sessionTone } from "@/shared/sessions";
import type { HomeNav, SessionList } from "./types";

type Props = HomeNav & { list: SessionList };

export function CompletedDocumentsScreen({ list, onHome, onHandover, onReceived, onLogout, onDocuments }: Props) {
  const documents = list.sessions ? completedSessions(list.sessions) : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 직접 고친 문서인지(현재 버전을 만든 쪽). 목록을 다시 불러올 때마다 함께 갱신한다.
  const [origins, setOrigins] = useState<Record<string, string>>({});
  useEffect(() => {
    api.myDocuments().then((result) => setOrigins(Object.fromEntries(result.documents.map((item) => [item.session_id, item.origin])))).catch(() => setOrigins({}));
  }, [list.sessions]);
  const stateLabel = (id: string) => (origins[id] === "user" ? "직접 수정" : origins[id] === "restore" ? "이전 버전 복원" : "생성 완료");
  const selected = documents?.find((document) => document.id === selectedId) ?? documents?.[0];

  return (
    <div className="app-shell completed-documents-page">
      <AppSidebar active="documents" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} />
      <main className="completed-documents-main">
        <header className="dashboard-header">
          <div><span>MY WORKSPACE</span><strong>완성 문서</strong></div>
        </header>
        <div className="completed-documents-content">
          <section className="documents-title">
            <div><span>COMPLETED DOCUMENTS</span><h1>완성된 인수인계 문서</h1><p>AMIGO가 근거 자료와 답변을 바탕으로 완성한 문서를 확인하세요.</p></div>
            <div><strong>{documents ? documents.length : "—"}</strong><small>완성 문서</small></div>
          </section>
          {list.error && <div className="list-notice error" role="alert">문서 목록을 불러오지 못했어요: {list.error}<button onClick={list.reload}>다시 시도</button></div>}
          {documents && documents.length === 0 && !list.error && <div className="list-notice">완성된 문서가 아직 없어요. 질의응답을 마치고 문서를 생성하면 여기에 모입니다.</div>}
          {documents && selected && (
            <section className="documents-layout">
              <div className="documents-list">
                <div className="documents-list-head"><strong>문서 목록</strong><span>{documents.length}건</span></div>
                {documents.map((document) => (
                  <button className={selected.id === document.id ? "active" : ""} key={document.id} onClick={() => setSelectedId(document.id)}>
                    <span className={`document-list-icon ${sessionTone(document.id)}`}><Icon name="file" size={18} /></span>
                    <div><em>v{document.document_version} {stateLabel(document.id)}</em><strong>{sessionTitle(document)}</strong><small>{document.organization || "소속 미입력"} · {formatDate(document.updated_at)}</small></div>
                    <Icon name="chevron" size={13} />
                  </button>
                ))}
              </div>
              <article className="document-preview-card">
                <header>
                  <div><span>HANDOVER DOCUMENT</span><h2>{sessionTitle(selected)}</h2><p>{MODE_LABEL[selected.mode]} · 인계자 {selected.owner_name}{selected.position ? ` ${selected.position}` : ""}</p></div>
                  <span className="document-complete-label"><Icon name="check" size={13} /> {stateLabel(selected.id)}</span>
                </header>
                <div className="document-preview-meta">
                  <div><small>{origins[selected.id] === "user" ? "마지막 수정" : "마지막 생성"}</small><strong>{formatDate(selected.updated_at)}</strong></div>
                  <div><small>문서 버전</small><strong>v{selected.document_version}</strong></div>
                  <div><small>현재 단계</small><strong>{selected.stage === "review" ? "문서 검토" : selected.stage === "composing" ? "새 버전 생성 중" : "질의응답 보완 중"}</strong></div>
                </div>
                <div className="document-preview-paper">
                  <span>AMIGO HANDOVER</span>
                  <h3>{sessionTitle(selected)}</h3>
                  <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
                  <i />
                  <div><strong>인계자</strong><p>{[selected.owner_name, selected.organization, selected.position].filter(Boolean).join(" · ")}</p></div>
                  <div><strong>담당 업무</strong><p>{selected.task_name || "미입력"}</p></div>
                  <div><strong>문서 내용</strong><p>표와 근거 번호가 달린 전체 문서는 ‘문서 열기’에서 확인하고, 대화창으로 고칠 점을 보내면 새 버전이 만들어집니다.</p></div>
                </div>
                <footer>
                  <button onClick={() => list.open(selected.id)}><Icon name="file" size={14} /> 문서 열기</button>
                  <button onClick={() => { window.location.href = api.downloadUrl(selected.id, "pdf"); }}><Icon name="download" size={14} /> PDF 내려받기</button>
                </footer>
              </article>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
