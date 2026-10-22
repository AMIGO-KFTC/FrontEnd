import { useMemo, useState } from "react";
import { ErrorNote } from "@/shared/ErrorNote";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/shared/api";
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { StartData } from "@/shared/handover";
import { documentRehypePlugins } from "@/shared/documentMarkdown";
import { MermaidDiagram } from "@/shared/MermaidDiagram";
import { GanttAwareTable, GanttContext } from "@/shared/GanttTable";

type Props = {
  data: StartData;
  sessionId: string;
  markdown: string;
  onGanttEdit: (name: string, nth: number, months: number[]) => Promise<void>;
  loading: boolean;
  sourceCount: number;
  failedMessage: string | null;
  revising: boolean; // 수정 요청이 서버에 가 있는 동안
  onRevise: (text: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onComplete: () => void;
  onLogout: () => void;
  onHome: () => void;
  // 인계자가 아닌 사람(인수자·팀장)이 열었을 때: 수정·완료 없이 읽기와 내려받기만. onExit 는 왔던 목록으로 돌아간다.
  readOnly?: { badge: string; note: string; exitLabel: string; onExit: () => void } | null;
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

export function FinalDocumentScreen({ data, sessionId, markdown, onGanttEdit, loading, sourceCount, failedMessage, revising, onRevise, onRetry, onBack, onComplete, onLogout, onHome, readOnly = null }: Props) {
  const [activeSection, setActiveSection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "failed">("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revision, setRevision] = useState("");
  // "AMIGO에게 수정 요청": 검토 단계의 chat API 로 보내면 서버가 반영한 새 버전을 만든다(README 의 v2 생성과 같은 경로).
  const sendRevision = () => {
    const text = revision.trim();
    if (!text || revising) return;
    setRevision("");
    setRevisionOpen(false);
    onRevise(text);
  };
  const parsed = splitSections(markdown);
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
    <div className={`final-document-page ${data.mode === "leave" ? "leave-theme" : ""}`}>
      {data.mode === "leave" && <LeaveSeasideBackground />}
      <header className="final-document-header">
        <Brand onClick={onHome} />
        {readOnly ? (
          <div className="document-readonly-badge"><Icon name="file" size={13} /> 읽기 전용 · 인계자 {data.name}{data.role ? ` ${data.role}` : ""}</div>
        ) : (
          <div className="onboarding-progress">
            <span className="active" />
            <span className="active" />
            <span className="active" />
            <span className="active" />
            <small>4 / 4</small>
          </div>
        )}
        <div className="final-header-actions">
          <div className="document-export">
            <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "pdf"); }}><Icon name="download" size={15} /> PDF</button>
            <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "docx"); }}><Icon name="download" size={15} /> Word</button>
            <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "md"); }}><Icon name="download" size={15} /> Markdown</button>
            <button className="print-only" title="인쇄" onClick={() => window.print()}><Icon name="print" size={16} /></button>
          </div>
          <StepUserMenu onLogout={onLogout} onHome={onHome} />
        </div>
      </header>
      <main className="final-document-main">
        <aside className="final-outline">
          <div className="document-complete-badge"><span><Icon name="check" size={14} /></span><div><strong>{readOnly ? readOnly.badge : "인수인계서 완성"}</strong></div></div>
          <div className="outline-title"><span>문서 목차</span><small>{sections.length}개 항목</small></div>
          <nav>
            {sections.map((section, index) => (
              <button className={activeSection === index ? "active" : ""} key={section} onClick={() => goTo(index)}>
                <span>0{index + 1}</span>{section}<Icon name="chevron" size={12} />
              </button>
            ))}
          </nav>
          <div className="document-source-info"><Icon name="link" size={15} /><div><strong>출처 {sourceCount}개 연결됨</strong><small>AI가 어떤 자료를 참고했는지 직접 확인해 보세요.</small></div></div>
          {readOnly ? (
            <button className="document-back" onClick={readOnly.onExit}><Icon name="arrow" size={15} /> {readOnly.exitLabel}</button>
          ) : (
            <>
              <button className="finish-handover" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>
              <button className="document-back" onClick={onBack}><Icon name="arrow" size={15} /> 질의응답으로 돌아가기</button>
            </>
          )}
        </aside>
        <section className="final-document-view">
          <div className="final-document-toolbar">
            {readOnly ? (
              <div><small className="gantt-hint">{readOnly.note}</small></div>
            ) : (
            <div>
              <button className={`edit-toggle ${isEditing ? "editing" : ""}`} onClick={() => setIsEditing((current) => !current)}><Icon name={isEditing ? "check" : "file"} size={14} /> {isEditing ? "수정 완료" : "직접 수정하기"}</button>
              {isEditing && <small className="gantt-hint">월별 일정표는 칸을 끌어서 막대를 늘리거나 줄일 수 있어요.{saveState === "saving" ? " 저장 중…" : saveState === "saved" ? " 저장됨" : saveState === "failed" ? " 저장 실패" : ""}</small>}
              <button className={`amigo-revision-button ${revisionOpen ? "editing" : ""}`} disabled={revising || parsed.length === 0} onClick={() => setRevisionOpen((current) => !current)}><Icon name="sparkle" size={14} /> {revising ? "수정 요청 보내는 중…" : "AMIGO에게 수정 요청"}</button>
            </div>
            )}
          </div>
          {revisionOpen && (
            <section className="revision-compose">
              <div><strong>고칠 점이나 빠진 내용을 알려 주세요</strong><small>AMIGO가 반영해 다음 버전의 인수인계서를 다시 작성해요. 작성이 끝나면 새 버전이 이 자리에 표시됩니다.</small></div>
              <textarea
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendRevision();
                  }
                }}
                placeholder="예: 협업 관계에 총무팀 최OO 주임(내선 3456)도 추가해 주세요"
                autoFocus
              />
              <div>
                <button onClick={() => setRevisionOpen(false)}>취소</button>
                <button className="revision-send" disabled={!revision.trim() || revising} onClick={sendRevision}><Icon name="sparkle" size={13} /> 수정 요청 보내기</button>
              </div>
            </section>
          )}
          {!readOnly && parsed.length > 0 && failedMessage !== null && (
            <div className="revision-error">
              <ErrorNote message={failedMessage || "수정 요청을 처리하는 중 문제가 생겼어요."} />
              <button onClick={onRetry}>다시 시도</button>
            </div>
          )}
          <GanttContext.Provider value={gantt}>
          <article className={`final-paper ${isEditing ? "is-editing" : ""}`} contentEditable={isEditing} suppressContentEditableWarning>
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
                  rehypePlugins={documentRehypePlugins}
                  components={{
                    table: GanttAwareTable,
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children }) =>
                      /language-mermaid/.test(className ?? "") ? <MermaidDiagram code={String(children).trimEnd()} /> : <pre><code className={className}>{children}</code></pre>,
                  }}
                >{section.body}</ReactMarkdown>
              </section>
            ))}
            <footer className="paper-footer"><span>AMIGO가 등록 자료와 답변을 바탕으로 생성한 문서입니다.</span><span>1 / 1</span></footer>
          </article>
          </GanttContext.Provider>
        </section>
        {!readOnly && <button className="finish-handover finish-handover-mobile" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>}
      </main>
    </div>
  );
}
