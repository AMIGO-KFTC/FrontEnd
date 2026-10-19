import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Icon from "@/components/Icon";

export default function CompletedDocumentsScreen({ onHome, onHandover, onReceived, onLogout }: { onHome: () => void; onHandover: () => void; onReceived: () => void; onLogout: () => void }) {
  const documents = [
    { id: 1, title: "플랫폼 운영 업무 인수인계서", team: "프로덕트본부 · 플랫폼팀", date: "2025. 03. 14", sources: 18, pages: 6, summary: "B2B 플랫폼의 운영 지표 관리, 장애 대응, 배포 일정 및 주요 협업 관계를 정리한 문서입니다.", color: "violet" },
    { id: 2, title: "고객 대응 프로세스 인수인계서", team: "고객경험본부 · CX팀", date: "2025. 02. 28", sources: 12, pages: 5, summary: "고객 문의 채널과 VOC 분류 기준, 긴급 이슈 에스컬레이션 절차를 정리한 문서입니다.", color: "blue" },
    { id: 3, title: "Q4 프로젝트 진행 현황 인수인계서", team: "프로덕트본부 · 서비스기획팀", date: "2025. 01. 17", sources: 9, pages: 4, summary: "Q4 주요 프로젝트의 완료 항목, 잔여 이슈, 후속 일정과 담당자를 정리한 문서입니다.", color: "coral" },
  ];
  const [selectedId, setSelectedId] = useState(1);
  const selected = documents.find((document) => document.id === selectedId) ?? documents[0];

  return (
    <div className="app-shell completed-documents-page">
      <AppSidebar active="documents" onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={() => {}} onReceived={onReceived} />
      <main className="completed-documents-main">
        <header className="dashboard-header">
          <div><span>MY WORKSPACE</span><strong>완성 문서</strong></div>
          <div className="document-header-actions"><button><Icon name="download" size={14} /> 전체 내려받기</button></div>
        </header>
        <div className="completed-documents-content">
          <section className="documents-title">
            <div><span>COMPLETED DOCUMENTS</span><h1>완성된 인수인계 문서</h1><p>AMIGO가 근거 자료와 답변을 바탕으로 완성한 문서를 확인하세요.</p></div>
            <div><strong>{documents.length}</strong><small>완성 문서</small></div>
          </section>
          <section className="documents-layout">
            <div className="documents-list">
              <div className="documents-list-head"><strong>문서 목록</strong><span>{documents.length}건</span></div>
              {documents.map((document) => (
                <button className={selected.id === document.id ? "active" : ""} key={document.id} onClick={() => setSelectedId(document.id)}>
                  <span className={`document-list-icon ${document.color}`}><Icon name="file" size={18} /></span>
                  <div><em>생성 완료</em><strong>{document.title}</strong><small>{document.team} · {document.date}</small></div>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
            </div>
            <article className="document-preview-card">
              <header>
                <div><span>HANDOVER DOCUMENT</span><h2>{selected.title}</h2><p>{selected.summary}</p></div>
                <span className="document-complete-label"><Icon name="check" size={13} /> 생성 완료</span>
              </header>
              <div className="document-preview-meta">
                <div><small>완성일</small><strong>{selected.date}</strong></div>
                <div><small>연결된 출처</small><strong>{selected.sources}개</strong></div>
                <div><small>문서 분량</small><strong>{selected.pages}페이지</strong></div>
              </div>
              <div className="document-preview-paper">
                <span>AMIGO HANDOVER</span>
                <h3>{selected.title}</h3>
                <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
                <i />
                <div><strong>01. 업무 개요</strong><p>{selected.summary}</p></div>
                <div><strong>02. 주요 업무</strong><p>정기 업무와 진행 중인 과제, 주요 시스템 및 협업 관계를 포함합니다.</p></div>
              </div>
              <footer>
                <button><Icon name="file" size={14} /> 문서 열기</button>
                <button><Icon name="download" size={14} /> PDF 내려받기</button>
              </footer>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
