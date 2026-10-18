import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../shared/api";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import type { StartData } from "../shared/handover";
import { documentRehypePlugins } from "../shared/documentMarkdown";
import { rehypeCitationRefs } from "../shared/citationRefs";
import { CitationPanel } from "../shared/CitationPanel";
import { MermaidDiagram } from "../shared/MermaidDiagram";
import type { CitationDetail } from "../shared/types";
import { GanttAwareTable, GanttContext } from "../shared/GanttTable";

type Props = {
  data: StartData;
  sessionId: string;
  markdown: string;
  onGanttEdit: (name: string, nth: number, months: number[]) => Promise<void>;
  loading: boolean;
  sourceCount: number;
  slotTitles?: Record<string, string>;
  failedMessage: string | null;
  onRetry: () => void;
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

export function FinalDocumentScreen({ data, sessionId, markdown, onGanttEdit, loading, sourceCount, slotTitles = {}, failedMessage, onRetry, onBack, onComplete }: Props) {
  const [activeSection, setActiveSection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "failed">("");
  const [citations, setCitations] = useState<CitationDetail[]>([]);
  const [panel, setPanel] = useState<{ selected: number | null } | null>(null);
  const parsed = splitSections(markdown);

  // 문서가 바뀔 때마다(처음·다시 생성·일정표 수정) 근거 번호별 원문을 새로 불러온다.
  useEffect(() => {
    if (!markdown) return;
    let cancelled = false;
    api
      .citations(sessionId)
      .then((r) => !cancelled && setCitations(r.citations))
      .catch(() => !cancelled && setCitations([]));
    return () => {
      cancelled = true;
    };
  }, [sessionId, markdown]);
  const rehypePlugins = useMemo(
    () => [...documentRehypePlugins, [rehypeCitationRefs, { numbers: new Set(citations.map((c) => c.number)) }]] as typeof documentRehypePlugins,
    [citations],
  );
  const openCitation = (target: EventTarget | null) => {
    if (isEditing) return; // 직접 수정하는 동안에는 눌러도 패널을 열지 않는다
    const ref = (target as HTMLElement | null)?.closest?.("[data-cite]");
    if (ref) setPanel({ selected: Number(ref.getAttribute("data-cite")) });
  };
  const gantt = useMemo(() => ({
    editable: isEditing,
    onChange: (name: string, nth: number, months: number[]) => {
      setSaveState("saving");
      const done = onGanttEdit(name, nth, months);
      done.then(() => setSaveState("saved"), () => setSaveState("failed"));
      return done;
    },
  }), [isEditing, onGanttEdit]);
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
          <div className="document-source-info clickable" role="button" tabIndex={0} onClick={() => setPanel({ selected: null })} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPanel({ selected: null })}><Icon name="link" size={15} /><div><strong>출처 {citations.length || sourceCount}개 연결됨</strong><small>AI가 어떤 자료를 참고했는지 직접 확인해 보세요.</small></div></div>
          <button className="finish-handover" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>
          <button className="document-back" onClick={onBack}><Icon name="arrow" size={15} /> 질의응답으로 돌아가기</button>
        </aside>
        <section className="final-document-view">
          <div className="final-document-toolbar">
            <div>
              <button className={`edit-toggle ${isEditing ? "editing" : ""}`} onClick={() => setIsEditing((current) => !current)}><Icon name={isEditing ? "check" : "file"} size={14} /> {isEditing ? "수정 완료" : "직접 수정하기"}</button>
              {isEditing && <small className="gantt-hint">월별 일정표는 칸을 끌어서 막대를 늘리거나 줄일 수 있어요.{saveState === "saving" ? " 저장 중…" : saveState === "saved" ? " 저장됨" : saveState === "failed" ? " 저장 실패" : ""}</small>}
            </div>
          </div>
          <GanttContext.Provider value={gantt}>
          <article
            className={`final-paper ${isEditing ? "is-editing" : ""}`}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onClick={(event) => openCitation(event.target)}
            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.target as HTMLElement).closest?.("[data-cite]") && (event.preventDefault(), openCitation(event.target))}
          >
            <header className="final-paper-cover">
              <div className="paper-brand"><span><Icon name="sparkle" size={14} /></span> AMIGO HANDOVER</div>
              <h1>업무 인수인계서</h1>
              <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
              <div className="paper-meta">
                <div><small>인계자</small><strong>{data.name}</strong></div>
                <div><small>소속</small><strong>{data.division} · {data.team}</strong></div>
                <div><small>직책</small><strong>{data.role || "—"}</strong></div>
                <div><small>인계 예정일</small><strong>{data.date || "미정"}</strong></div>
              </div>
            </header>
            {parsed.length === 0 && failedMessage !== null && (
              <section className="paper-section">
                <p>{failedMessage || "문서를 만드는 중 문제가 생겼어요. 다시 시도해 주세요."}</p>
                <button className="primary-button onboarding-next" onClick={onRetry}>다시 시도</button>
              </section>
            )}
            {loading && parsed.length === 0 && failedMessage === null && <section className="paper-section"><p>문서를 불러오고 있어요…</p></section>}
            {parsed.map((section, index) => (
              <section className="paper-section" id={`paper-section-${index}`} key={`${section.title}-${index}`}>
                <div className="paper-section-heading"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2></div></div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={rehypePlugins}
                  components={{
                    table: GanttAwareTable,
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children }) =>
                      /language-mermaid/.test(className ?? "") ? <MermaidDiagram code={String(children).trimEnd()} /> : <pre><code className={className}>{children}</code></pre>,
                  }}
                >{section.body}</ReactMarkdown>
              </section>
            ))}
            <footer className="paper-footer"><span>AMIGO가 등록 자료와 답변을 바탕으로 생성한 문서입니다.</span><span>1 / {Math.max(sections.length, 1)}</span></footer>
          </article>
          </GanttContext.Provider>
        </section>
        {panel && <CitationPanel citations={citations} selected={panel.selected} slotTitles={slotTitles} onClose={() => setPanel(null)} />}
        <button className="finish-handover finish-handover-mobile" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>
      </main>
    </div>
  );
}
