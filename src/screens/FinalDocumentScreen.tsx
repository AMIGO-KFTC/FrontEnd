import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../shared/api";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import type { StartData } from "../shared/handover";

type Props = {
  data: StartData;
  sessionId: string;
  markdown: string;
  loading: boolean;
  sourceCount: number;
  onBack: () => void;
  onComplete: () => void;
};

// 생성된 Markdown 을 "## 제목" 기준으로 장(章)으로 나눈다. 첫 "## " 앞의 표지 부분은 화면의 표지가 대신한다.
function splitSections(markdown: string): { title: string; body: string }[] {
  return markdown
    .split(/^##\s+/m)
    .slice(1)
    .map((chunk) => {
      const [title, ...rest] = chunk.split("\n");
      return { title: title.trim().replace(/^\d+\.\s*/, ""), body: rest.join("\n").trim() };
    });
}

export function FinalDocumentScreen({ data, sessionId, markdown, loading, sourceCount, onBack, onComplete }: Props) {
  const [activeSection, setActiveSection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const tasks = data.task.split("\n").filter(Boolean);
  const parsed = splitSections(markdown);
  const sections = parsed.map((section) => section.title);
  const goTo = (index: number) => {
    setActiveSection(index);
    document.getElementById(`paper-section-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "pdf"); }}><Icon name="download" size={15} /> PDF</button>
          <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "docx"); }}><Icon name="download" size={15} /> Word</button>
          <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "md"); }}><Icon name="download" size={15} /> Markdown</button>
          <button className="print-only" title="인쇄" onClick={() => window.print()}><Icon name="print" size={16} /></button>
        </div>
      </header>
      <main className="final-document-main">
        <aside className="final-outline">
          <div className="document-complete-badge"><span><Icon name="check" size={14} /></span><div><strong>인수인계서 완성</strong></div></div>
          <div className="outline-title"><span>문서 목차</span><small>{sections.length}개 항목</small></div>
          <nav>
            {sections.map((section, index) => (
              <button className={activeSection === index ? "active" : ""} key={section} onClick={() => goTo(index)}>
                <span>0{index + 1}</span>{section}<Icon name="chevron" size={12} />
              </button>
            ))}
          </nav>
          <div className="document-source-info"><Icon name="link" size={15} /><div><strong>출처 {sourceCount}개 연결됨</strong><small>AI가 어떤 자료를 참고했는지 직접 확인해 보세요.</small></div></div>
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
            {loading && parsed.length === 0 && <section className="paper-section"><p>문서를 불러오고 있어요…</p></section>}
            {parsed.map((section, index) => (
              <section className="paper-section" id={`paper-section-${index}`} key={`${section.title}-${index}`}>
                <div className="paper-section-heading"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2></div></div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
              </section>
            ))}
            <footer className="paper-footer"><span>AMIGO가 등록 자료와 답변을 바탕으로 생성한 문서입니다.</span><span>1 / {Math.max(sections.length, 1)}</span></footer>
          </article>
        </section>
        <button className="finish-handover finish-handover-mobile" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>
      </main>
    </div>
  );
}
