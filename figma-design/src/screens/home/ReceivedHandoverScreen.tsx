import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Icon from "@/components/Icon";

export default function ReceivedHandoverScreen({ onHome, onHandover, onDocuments, onLogout }: { onHome: () => void; onHandover: () => void; onDocuments: () => void; onLogout: () => void }) {
  const handovers = [
    {
      id: 1,
      title: "B2B 플랫폼 운영 업무",
      sender: "박서연",
      team: "플랫폼팀",
      role: "프로덕트 매니저",
      received: "2025. 03. 18",
      due: "2025. 03. 25",
      status: "확인 필요",
      progress: 82,
      summary: "B2B 플랫폼의 정기 운영, 고객 요청 처리, 장애 대응 및 월간 배포 프로세스에 대한 인수인계입니다.",
      files: ["플랫폼_운영가이드_v3.pdf", "2025_Q1_백로그.xlsx", "장애대응_연락망.pdf"],
      sources: 18,
    },
    {
      id: 2,
      title: "고객 대응 및 VOC 관리",
      sender: "이지윤",
      team: "고객경험팀",
      role: "CX 매니저",
      received: "2025. 03. 12",
      due: "2025. 03. 20",
      status: "열람 완료",
      progress: 100,
      summary: "주요 고객 문의 채널, VOC 분류 기준, 긴급 이슈 에스컬레이션 절차를 정리한 인수인계입니다.",
      files: ["VOC_분류기준.pdf", "고객대응_매뉴얼.docx", "에스컬레이션_체계.xlsx"],
      sources: 12,
    },
    {
      id: 3,
      title: "파트너사 정산 프로세스",
      sender: "최유진",
      team: "사업운영팀",
      role: "사업운영 매니저",
      received: "2025. 03. 05",
      due: "2025. 03. 14",
      status: "열람 완료",
      progress: 100,
      summary: "월별 파트너사 정산 일정과 검수 기준, 세금계산서 발행 절차를 포함합니다.",
      files: ["정산_업무가이드.pdf", "파트너사_목록.xlsx"],
      sources: 9,
    },
  ];
  const [selectedId, setSelectedId] = useState(1);
  const [confirmed] = useState<number[]>([2, 3]);
  const selected = handovers.find((handover) => handover.id === selectedId) ?? handovers[0];
  const isConfirmed = confirmed.includes(selected.id);

  return (
    <div className="app-shell received-page">
      <AppSidebar active="received" onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={() => {}} />
      <main className="received-main">
        <header className="dashboard-header received-header">
          <div><span>MY WORKSPACE</span><strong>받은 인수인계</strong></div>
          <button className="received-help"><Icon name="download" size={14} /> 전체 내려받기</button>
        </header>
        <div className="received-content">
          <section className="received-title">
            <div><span>RECEIVED HANDOVERS</span><h1>전달받은 업무를 확인하세요</h1><p>인계자가 정리한 업무 맥락과 근거 자료를 한곳에서 확인할 수 있어요.</p></div>
            <div className="received-counts">
              <div><strong>3</strong><small>전체</small></div>
              <i />
              <div><strong>1</strong><small>확인 필요</small></div>
              <i />
              <div><strong>2</strong><small>열람 완료</small></div>
            </div>
          </section>
          <section className="received-layout">
            <aside className="received-list">
              <div className="received-list-head"><strong>인수인계 목록</strong><span>{handovers.length}건</span></div>
              {handovers.map((handover) => (
                <button className={selected.id === handover.id ? "active" : ""} key={handover.id} onClick={() => setSelectedId(handover.id)}>
                  <span className="received-avatar">{handover.sender.slice(0, 1)}</span>
                  <div>
                    <span className={`received-status ${confirmed.includes(handover.id) ? "done" : ""}`}>{confirmed.includes(handover.id) ? "열람 완료" : handover.status}</span>
                    <strong>{handover.title}</strong>
                    <small>{handover.sender} · {handover.team}</small>
                  </div>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
            </aside>
            <article className="received-detail">
              <header>
                <div>
                  <span className={`received-status ${isConfirmed ? "done" : ""}`}>{isConfirmed ? "열람 완료" : selected.status}</span>
                  <h2>{selected.title}</h2>
                  <p>{selected.summary}</p>
                </div>
                <button title="더보기"><Icon name="more" size={18} /></button>
              </header>
              <div className="received-meta">
                <div><small>인계자</small><strong>{selected.sender}</strong><span>{selected.team} · {selected.role}</span></div>
                <div><small>전달일</small><strong>{selected.received}</strong><span>인계 예정일 {selected.due}</span></div>
              </div>
              <section className="received-files">
                <div><strong>전달받은 자료</strong><span>{selected.files.length}개 자료 · 출처 {selected.sources}개</span></div>
                <article className="received-document-preview">
                  <span>AMIGO HANDOVER</span>
                  <h3>{selected.title} 인수인계서</h3>
                  <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
                  <i />
                  <div><strong>01. 업무 개요</strong><p>{selected.summary}</p></div>
                  <div><strong>02. 주요 업무 및 일정</strong><p>정기 업무, 진행 중인 과제, 주요 시스템과 협업 관계가 근거 자료와 함께 정리되어 있습니다.</p></div>
                  <div><strong>03. 참고 자료</strong><p>{selected.files.join(" · ")}</p></div>
                </article>
              </section>
              <footer>
                <div className="received-footer-actions">
                  <button><Icon name="file" size={14} /> 문서 열기</button>
                  <button><Icon name="download" size={14} /> PDF 내려받기</button>
                </div>
              </footer>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
