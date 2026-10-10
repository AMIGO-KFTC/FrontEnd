import { useState } from "react";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import type { StartData } from "../shared/handover";

export function FinalDocumentScreen({ data, onBack, onComplete }: { data: StartData; onBack: () => void; onComplete: () => void }) {
  const [activeSection, setActiveSection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const tasks = data.task.split("\n").filter(Boolean);
  const sections = ["업무 개요", "담당 업무", "반복 수행 업무", "진행 중인 과제", "협업 관계", "시스템 및 권한"];

  return (
    <div className="final-document-page">
      <header className="final-document-header">
        <Brand />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <span className="active" />
          <small>4 / 4</small>
        </div>
        <div className="document-export">
          <button><Icon name="download" size={15} /> PDF</button>
          <button><Icon name="download" size={15} /> Word</button>
          <button><Icon name="download" size={15} /> Markdown</button>
          <button className="print-only" title="인쇄"><Icon name="print" size={16} /></button>
        </div>
      </header>
      <main className="final-document-main">
        <aside className="final-outline">
          <div className="document-complete-badge"><span><Icon name="check" size={14} /></span><div><strong>인수인계서 완성</strong></div></div>
          <div className="outline-title"><span>문서 목차</span><small>6개 항목</small></div>
          <nav>
            {sections.map((section, index) => (
              <button className={activeSection === index ? "active" : ""} key={section} onClick={() => setActiveSection(index)}>
                <span>0{index + 1}</span>{section}<Icon name="chevron" size={12} />
              </button>
            ))}
          </nav>
          <div className="document-source-info"><Icon name="link" size={15} /><div><strong>출처 18개 연결됨</strong><small>AI가 어떤 자료를 참고했는지 직접 확인해 보세요.</small></div></div>
          <button className="finish-handover" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>
          <button className="document-back" onClick={onBack}><Icon name="arrow" size={15} /> 질의응답으로 돌아가기</button>
        </aside>
        <section className="final-document-view">
          <div className="final-document-toolbar">
            <div>
              <button className={isEditing ? "editing" : ""} onClick={() => setIsEditing((current) => !current)}><Icon name={isEditing ? "check" : "file"} size={14} /> {isEditing ? "수정 완료" : "직접 수정하기"}</button>
              <button><Icon name="sparkle" size={14} /> AMIGO에게 수정 요청</button>
              <button><Icon name="more" size={17} /></button>
            </div>
          </div>
          <article className={`final-paper ${isEditing ? "is-editing" : ""}`} contentEditable={isEditing} suppressContentEditableWarning>
            <header className="final-paper-cover">
              <div className="paper-brand"><span><Icon name="sparkle" size={14} /></span> AMIGO HANDOVER</div>
              <h1>{tasks[0] || "담당 업무"}<br />인수인계서</h1>
              <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
              <div className="paper-meta">
                <div><small>인계자</small><strong>{data.name}</strong></div>
                <div><small>소속</small><strong>{data.division} · {data.team}</strong></div>
                <div><small>직책</small><strong>{data.role || "—"}</strong></div>
                <div><small>인계 예정일</small><strong>{data.date || "미정"}</strong></div>
              </div>
            </header>
            <section className="paper-section">
              <div className="paper-section-heading"><span>01</span><div><small>OVERVIEW</small><h2>업무 개요</h2></div></div>
              <p>{data.team}의 업무 운영 안정성을 확보하고, 주요 이해관계자의 요구사항을 실행 가능한 과제로 연결합니다. 정기적인 운영 지표 관리와 이슈 대응, 업무 일정 조율을 중심으로 수행합니다.<sup>[1]</sup></p>
              <div className="paper-highlight"><Icon name="sparkle" size={16} /><div><strong>핵심 목표</strong><p>업무 연속성 확보 · 주요 일정 준수 · 이슈 대응 체계 유지</p></div></div>
            </section>
            <section className="paper-section">
              <div className="paper-section-heading"><span>02</span><div><small>RESPONSIBILITIES</small><h2>담당 업무</h2></div></div>
              <div className="paper-task-list">
                {tasks.map((task, index) => <div key={task}><span>{String(index + 1).padStart(2, "0")}</span><strong>{task}</strong><small>운영 가이드 및 질의응답 기반<sup>[{index + 2}]</sup></small></div>)}
              </div>
            </section>
            <section className="paper-section">
              <div className="paper-section-heading"><span>03</span><div><small>ROUTINE</small><h2>반복 수행 업무</h2></div></div>
              <table>
                <thead><tr><th>주기</th><th>업무 내용</th><th>협업 / 공유</th></tr></thead>
                <tbody><tr><td>매주 월요일</td><td>운영 지표 리뷰 및 이슈 우선순위 조정</td><td>플랫폼팀 · 주간 채널</td></tr><tr><td>매월 1주차</td><td>고객 요청 및 주요 지표 리포트 공유</td><td>유관 부서 리더</td></tr></tbody>
              </table>
            </section>
            <footer className="paper-footer"><span>AMIGO가 등록 자료와 답변을 바탕으로 생성한 문서입니다.</span><span>1 / 6</span></footer>
          </article>
        </section>
        <button className="finish-handover finish-handover-mobile" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>
      </main>
    </div>
  );
}
