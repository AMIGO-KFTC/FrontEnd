import Icon from "@/components/Icon";

export default function DocumentViewer({ onBack }: { onBack: () => void }) {
  return (
    <div className="document-layout">
      <aside className="doc-outline">
        <span className="panel-kicker">DOCUMENT OUTLINE</span><h2>목차</h2>
        {["1. 업무 개요", "2. 정기 업무", "3. 시스템 및 권한", "4. 진행 중인 업무", "5. 이슈 및 리스크", "6. 주요 연락처"].map((item, index) => <button className={index === 0 ? "active" : ""} key={item}>{item}<span>{index < 3 ? <Icon name="check" size={13} /> : ""}</span></button>)}
        <button className="back-chat" onClick={onBack}><Icon name="message" size={15} /> 대화로 돌아가기</button>
      </aside>
      <section className="document-viewer">
        <div className="document-toolbar">
          <div><span className="status-pill complete"><Icon name="check" size={13} /> 생성 완료</span><strong>플랫폼 운영 업무 인수인계서</strong></div>
          <div className="export-actions"><button><Icon name="download" size={15} /> PDF</button><button><Icon name="download" size={15} /> Word</button><button><Icon name="download" size={15} /> Markdown</button><button title="인쇄"><Icon name="print" size={17} /></button></div>
        </div>
        <article className="document-paper">
          <div className="doc-cover"><span>HANDOVER DOCUMENT</span><h1>플랫폼 운영 업무<br />인수인계서</h1><p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p><div className="doc-meta"><div><small>인계자</small><strong>김민준 · 프로덕트 매니저</strong></div><div><small>인수자</small><strong>이지윤</strong></div><div><small>인계일</small><strong>2025. 03. 14</strong></div></div></div>
          <section><div className="doc-section-title"><span>01</span><h2>업무 개요</h2></div><p>플랫폼팀의 B2B 서비스 운영 안정성을 확보하고, 고객 및 내부 구성원의 요구사항을 제품 개선으로 연결하는 업무를 담당합니다. 주요 범위는 운영 지표 관리, 이슈 대응, 배포 일정 조율입니다.<sup>[1]</sup></p><blockquote><strong>핵심 목표</strong><br />서비스 가용성 99.9% 유지 · 주요 고객 요청 SLA 준수 · 월 2회 정기 배포</blockquote></section>
          <section><div className="doc-section-title"><span>02</span><h2>정기 업무 및 일정</h2></div><table><thead><tr><th>주기</th><th>업무</th><th>협업자 / 채널</th></tr></thead><tbody><tr><td>매주 월요일</td><td>운영 지표 리뷰 및 이슈 우선순위 조정</td><td>플랫폼팀 / #platform-weekly</td></tr><tr><td>매월 1주차</td><td>고객 VOC 분석 리포트 공유</td><td>CS팀, 영업팀</td></tr></tbody></table></section>
          <footer><span>이어봄 AI로 생성된 문서입니다.</span><span>1 / 6</span></footer>
        </article>
      </section>
    </div>
  );
}
