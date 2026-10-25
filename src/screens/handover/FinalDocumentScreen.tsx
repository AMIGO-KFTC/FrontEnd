import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNote } from "@/shared/ErrorNote";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/shared/api";
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { StartData } from "@/shared/handover";
import { documentRehypePlugins } from "@/shared/documentMarkdown";
import { useProfile } from "@/shared/profile";
import { TransferDialog } from "./TransferDialog";
import { SourcesDialog } from "./SourcesDialog";
import type { AppConfig, DocumentCitation, Gap, Source } from "@/shared/types";
import { MermaidDiagram } from "@/shared/MermaidDiagram";
import { GanttAwareTable, GanttContext } from "@/shared/GanttTable";
import { CitationContext, CitationRef } from "@/shared/CitationRef";
import { EditableCell, EditCellsContext } from "@/shared/EditableCell";
import { addRowAfter, applyCellEdits, cellText, deleteRow, findCells, findRows, markCells } from "@/shared/editableCells";

type Props = {
  data: StartData;
  sessionId: string;
  markdown: string;
  onGanttEdit: (name: string, nth: number, months: number[]) => Promise<void>;
  onSaveDocument: (markdown: string) => Promise<void>; // 직접 고친 문서를 새 버전으로 저장
  loading: boolean;
  gaps: Gap[]; // 오른쪽 '시간 될 때 적어 주세요' 목록
  sources: Source[]; // '출처 N개 연결됨' 창의 자료 목록
  config: AppConfig | null; // 장 제목·자료 형식 이름
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

// 예전에 저장된 문서에 남아 있을 수 있는 장. 지금은 본문에 넣지 않고 오른쪽 목록·출처 창이 대신하므로 화면에서 숨긴다.
const HIDDEN_SECTION = /^(확인 필요 사항|근거 자료)$/;

// 문서에 넣지 않고 오른쪽 목록으로 보여 줄 질문 상태와 그 이름
const PENDING_LABEL: Partial<Record<Gap["status"], string>> = { open: "미질문", asked: "답변 대기", answered: "확인 대기", skipped: "인계자 미확인" };


// 고친 장(章)의 본문만 바꿔 문서 전체 Markdown 을 다시 만든다. 고치지 않은 부분은 글자 그대로 둔다. edits 의 키는 장 번호(0부터).
function rebuildMarkdown(markdown: string, edits: Record<string, string>): string {
  return markdown
    .split(/^##\s+/m)
    .map((chunk, index) => {
      if (index === 0) return chunk;
      const body = edits[String(index - 1)];
      if (body === undefined) return `## ${chunk}`;
      return `## ${chunk.split("\n")[0]}\n\n${body.trim()}\n\n`;
    })
    .join("");
}

export function FinalDocumentScreen({ data, sessionId, markdown, onGanttEdit, onSaveDocument, loading, gaps, sources, config, failedMessage, revising, onRevise, onRetry, onBack, onComplete, onLogout, onHome, readOnly = null }: Props) {
  const [profile] = useProfile();
  const [transferOpen, setTransferOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // 직접 고치는 중인 장 본문(장 번호 → 글). 표가 없는 장
  // 표의 행을 더하거나 뺀 장의 본문(장 번호 → 글). 칸 번호가 바뀌므로 행을 바꿀 때마다 그때까지 고친 칸을 본문에 먼저 넣고 칸 입력을 새로 그린다(rowVersion)
  const [rowBodies, setRowBodies] = useState<Record<string, string>>({});
  const [rowVersion, setRowVersion] = useState(0);
  // 표가 있는 장은 칸마다 그 자리에서 고친다(장 번호 → 칸 번호 → 고친 글). 입력할 때마다 다시 그리지 않도록 ref 에 모은다.
  const cellDrafts = useRef<Record<string, Record<number, string>>>({});
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "failed">("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revision, setRevision] = useState("");
  const [answering, setAnswering] = useState<Gap | null>(null); // 오른쪽 목록에서 고른 질문(입력칸에는 답만 쓴다)
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const revisionRef = useRef<HTMLTextAreaElement>(null);
  const [fillTick, setFillTick] = useState(0); // 목록에서 질문을 채울 때마다 늘려 커서를 다시 옮긴다
  const slotTitle = (key: string) => config?.slots.find((spec) => spec.key === key)?.title ?? "";
  const files = sources.filter((source) => source.kind === "file" && source.status !== "failed"); // '출처' 창에서 내려받는 올린 파일
  // 본문 근거 번호([1])에 마우스를 올리면 띄울 출처. 문서가 바뀌면(새 버전) 번호도 바뀌므로 다시 불러온다.
  const [citations, setCitations] = useState<DocumentCitation[]>([]);
  useEffect(() => {
    if (!markdown) return;
    let cancelled = false;
    api.citations(sessionId).then((result) => !cancelled && setCitations(result.citations)).catch(() => !cancelled && setCitations([]));
    return () => { cancelled = true; };
  }, [sessionId, markdown]);
  const citationContext = useMemo(
    () => ({ byNumber: new Map(citations.map((cite) => [cite.number, cite])), slotTitle }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [citations, config],
  );
  const pending = gaps.filter((gap) => gap.status in PENDING_LABEL);
  // 오른쪽 목록의 항목을 누르면 AI 대화창처럼 질문을 카드로 보여 주고, 입력칸에는 답만 쓴다.
  // 보낼 때 질문을 함께 붙여 보내면 AMIGO가 반영한 새 버전을 만든다.
  const answerGap = (gap: Gap) => {
    if (readOnly || revising) return;
    setAnswering(gap);
    setRevision("");
    setRevisionOpen(true);
    setFillTick((n) => n + 1);
  };
  const closeRevision = () => {
    setRevisionOpen(false);
    setAnswering(null);
  };
  // 채워 넣은 글 끝에 커서를 둬 바로 답을 이어 쓰게 한다
  useEffect(() => {
    const box = revisionRef.current;
    if (!revisionOpen || !box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [revisionOpen, fillTick]);
  // "AMIGO에게 수정 요청": 검토 단계의 chat API 로 보내면 서버가 반영한 새 버전을 만든다(README 의 v2 생성과 같은 경로).
  const sendRevision = () => {
    const text = revision.trim();
    if (!text || revising) return;
    const question = answering ? answering.question || answering.description : "";
    setRevision("");
    closeRevision();
    onRevise(question ? `[질문] ${question}\n[답변] ${text}` : text);
  };
  const parsed = splitSections(markdown);
  // 화면에 그릴 장. index 는 원래 문서의 장 번호(직접 고친 글을 저장할 때 rebuildMarkdown 이 쓴다).
  const visible = parsed.map((section, index) => ({ ...section, index })).filter((section) => !HIDDEN_SECTION.test(section.title));
  const gantt = useMemo(() => ({
    editable: isEditing,
    onChange: (name: string, nth: number, months: number[]) => {
      setSaveState("saving");
      const done = onGanttEdit(name, nth, months);
      done.then(() => setSaveState("saved"), () => setSaveState("failed"));
      return done;
    },
  }), [isEditing, onGanttEdit]);
  const sections = visible.map((section) => section.title);
  // '수정 완료': 고친 장이 있으면 문서 전체를 새 버전으로 저장한다. 저장에 실패하면 수정 상태를 그대로 두고 이유를 보여 준다.
  const finishEditing = async () => {
    const edited: Record<string, string> = { ...drafts, ...rowBodies };
    for (const [index, edits] of Object.entries(cellDrafts.current)) {
      const body = rowBodies[index] ?? parsed[Number(index)]?.body;
      if (body !== undefined) edited[index] = applyCellEdits(body, edits);
    }
    const changed = Object.fromEntries(Object.entries(edited).filter(([index, text]) => text.trim() !== (parsed[Number(index)]?.body ?? "").trim()));
    if (Object.keys(changed).length === 0) {
      setIsEditing(false);
      setDrafts({});
      setRowBodies({});
      cellDrafts.current = {};
      return;
    }
    setSaveState("saving");
    setSaveError("");
    try {
      await onSaveDocument(rebuildMarkdown(markdown, changed));
      setSaveState("saved");
      setIsEditing(false);
      setDrafts({});
      setRowBodies({});
      cellDrafts.current = {};
    } catch (e) {
      setSaveState("failed");
      setSaveError((e as Error).message);
    }
  };
  const cancelEditing = () => {
    setIsEditing(false);
    setDrafts({});
    setRowBodies({});
    cellDrafts.current = {};
    setSaveError("");
    setSaveState("");
  };
  // 표의 행 더하기·빼기: 고친 칸을 먼저 본문에 넣은 뒤 행을 바꾼다
  const editRow = (original: number, op: "add" | "delete", row: number) => {
    const key = String(original);
    const base = applyCellEdits(rowBodies[key] ?? parsed[original]?.body ?? "", cellDrafts.current[key] ?? {});
    delete cellDrafts.current[key];
    setRowBodies({ ...rowBodies, [key]: op === "add" ? addRowAfter(base, row) : deleteRow(base, row) });
    setRowVersion((version) => version + 1);
  };
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
          <button type="button" className="document-source-info" onClick={() => setSourcesOpen(true)}><Icon name="link" size={15} /><div><strong>출처 {files.length}개 연결됨</strong><small>AI가 참고한 자료 파일을 내려받을 수 있어요.</small></div><Icon name="chevron" size={12} /></button>
          {readOnly ? (
            <button className="document-back" onClick={readOnly.onExit}><Icon name="arrow" size={15} /> {readOnly.exitLabel}</button>
          ) : (
            <>
              <button className="send-handover" onClick={() => setTransferOpen(true)}><Icon name="mail" size={15} /> 인수자에게 전송하기</button>
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
              <button className={`edit-toggle ${isEditing ? "editing" : ""}`} disabled={saveState === "saving"} onClick={() => (isEditing ? void finishEditing() : setIsEditing(true))}><Icon name={isEditing ? "check" : "file"} size={14} /> {isEditing ? (saveState === "saving" ? "저장 중…" : "수정 완료") : "직접 수정하기"}</button>
              {isEditing && <button onClick={cancelEditing} disabled={saveState === "saving"}>취소</button>}
              {isEditing && <small className="gantt-hint">표의 글을 눌러 바로 고친 뒤 '수정 완료'를 누르면 새 버전으로 저장돼요. 월별 일정표의 막대는 칸을 끌어서 고쳐요.{saveState === "saved" ? " 저장됨" : saveState === "failed" ? ` 저장 실패${saveError ? `: ${saveError}` : ""}` : ""}</small>}
              <button className={`amigo-revision-button ${revisionOpen ? "editing" : ""}`} disabled={revising || parsed.length === 0} onClick={() => { setAnswering(null); setRevisionOpen((current) => !current); }}><Icon name="sparkle" size={14} /> {revising ? "수정 요청 보내는 중…" : "AMIGO에게 수정 요청"}</button>
            </div>
            )}
          </div>
          {revising && (
            <div className="revise-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>AMIGO가 수정 요청을 반영하고 있어요</strong><small>새 버전의 인수인계서를 쓰는 중이에요. 잠시만 기다려 주세요.</small></div></div>
          )}
          {revisionOpen && answering && createPortal(
            // 오른쪽 목록에서 고른 질문은 모달 창으로 띄운다(배경을 누르거나 ESC·취소로 닫는다).
            // 화면 전체를 덮도록 body 에 그린다(문서 영역 안에 두면 배경이 문서 영역만 덮는다).
            <div className="logout-overlay" role="presentation" onClick={closeRevision} onKeyDown={(event) => event.key === "Escape" && closeRevision()}>
            <section className="transfer-modal revision-answer" role="dialog" aria-modal="true" aria-label="질문에 답하기" onClick={(event) => event.stopPropagation()}>
              <button className="sources-close" type="button" aria-label="닫기" onClick={closeRevision}><Icon name="close" size={16} /></button>
              <section className="amigo-question-card">
                <div className="question-card-top">
                  <span className="question-ai"><Icon name="sparkle" size={16} /></span>
                  <div><strong>AMIGO</strong><small>답해 주시면 반영해서 인수인계서를 다시 작성해요</small></div>
                </div>
                <h2 style={{ whiteSpace: "pre-line" }}>{answering.question || answering.description}</h2>
                {answering.question && answering.description && answering.description !== answering.question && <p>{answering.description}</p>}
              </section>
              <section className="answer-compose">
                <textarea
                  value={revision}
                  onChange={(event) => setRevision(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 보내지 않는다
                      event.preventDefault();
                      sendRevision();
                    }
                  }}
                  placeholder="답변을 입력해 주세요"
                  ref={revisionRef}
                  autoFocus
                />
                <div>
                  <button className="answer-cancel" onClick={closeRevision}>취소</button>
                  <button className="answer-send" disabled={!revision.trim() || revising} onClick={sendRevision}>답변 보내기 <Icon name="arrow" size={17} /></button>
                </div>
              </section>
            </section>
            </div>,
            document.body,
          )}
          {revisionOpen && !answering && (
            <section className="revision-compose">
              <div><strong>고칠 점이나 빠진 내용을 알려 주세요</strong><small>AMIGO가 반영해 다음 버전의 인수인계서를 다시 작성해요. 작성이 끝나면 새 버전이 이 자리에 표시됩니다.</small></div>
              <textarea
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 보내지 않는다
                    event.preventDefault();
                    sendRevision();
                  }
                }}
                placeholder="예: 협업 관계에 총무팀 최OO 주임(내선 3456)도 추가해 주세요"
                ref={revisionRef}
                autoFocus
              />
              <div>
                <button onClick={closeRevision}>취소</button>
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
          <CitationContext.Provider value={citationContext}>
          <article className={`final-paper ${isEditing ? "is-editing" : ""}${revising ? " is-revising" : ""}`}>
            <header className="final-paper-cover">
              <div className="paper-brand"><span><Icon name="sparkle" size={14} /></span> AMIGO HANDOVER</div>
              <h1>업무 인수인계서</h1>
              <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
              <div className="paper-meta">
                <div><small>인계자</small><strong>{data.name}</strong></div>
                <div><small>소속</small><strong>{data.division} · {data.team}</strong></div>
                <div><small>직책</small><strong>{data.role || "—"}</strong></div>
                {data.mode === "leave"
                  ? <div><small>휴가 기간</small><strong>{data.leaveStart && data.leaveEnd ? `${data.leaveStart} ~ ${data.leaveEnd}` : "미정"}</strong></div>
                  : <div><small>인계 예정일</small><strong>{data.date || "미정"}</strong></div>}
              </div>
            </header>
            {parsed.length === 0 && failedMessage !== null && (
              <section className="paper-section">
                <p>{failedMessage || "문서를 만드는 중 문제가 생겼어요. 다시 시도해 주세요."}</p>
                <button className="primary-button onboarding-next" onClick={onRetry}>다시 시도</button>
              </section>
            )}
            {loading && parsed.length === 0 && failedMessage === null && <section className="paper-section"><p>문서를 불러오고 있어요…</p></section>}
            {visible.map(({ index: original, ...section }, index) => {
              // 수정 중이면 표 칸·항목 이름을 입력칸으로 그린다. 고칠 칸이 없는(표가 없는) 장은 글 상자로 고친다.
              const body = (isEditing && rowBodies[String(original)]) || section.body;
              const cells = isEditing ? findCells(body) : [];
              const rows = isEditing ? findRows(body) : [];
              const editCells = {
                text: (id: number) => cellDrafts.current[String(original)]?.[id] ?? (cells[id] ? cellText(cells[id]) : ""),
                onChange: (id: number, text: string) => {
                  cellDrafts.current[String(original)] = { ...(cellDrafts.current[String(original)] ?? {}), [id]: text };
                },
              };
              return (
              <section className="paper-section" id={`paper-section-${index}`} key={`${section.title}-${original}-${isEditing ? rowVersion : 0}`}>
                <div className="paper-section-heading"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2></div></div>
                {isEditing && cells.length === 0 ? (
                  <textarea
                    className="paper-section-editor"
                    value={drafts[String(original)] ?? section.body}
                    onChange={(event) => setDrafts({ ...drafts, [String(original)]: event.target.value })}
                    rows={Math.max(4, (drafts[String(original)] ?? section.body).split("\n").length + 1)}
                    spellCheck={false}
                    aria-label={`${section.title} 내용 수정`}
                  />
                ) : (
                <EditCellsContext.Provider value={isEditing ? editCells : null}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={documentRehypePlugins}
                  components={{
                    table: GanttAwareTable,
                    span: ({ node, children, ...rest }) => {
                      const id = node?.properties?.dataCell;
                      const row = node?.properties?.dataRow;
                      if (isEditing && row !== undefined) {
                        return (
                          <span className="row-tools" contentEditable={false}>
                            <button type="button" title="이 행 아래에 빈 행 추가" aria-label="행 추가" onClick={() => editRow(original, "add", Number(row))}>+</button>
                            <button type="button" title="이 행 삭제" aria-label="행 삭제" onClick={() => editRow(original, "delete", Number(row))}>×</button>
                          </span>
                        );
                      }
                      return isEditing && id !== undefined ? <EditableCell id={Number(id)} /> : <span {...rest}>{children}</span>;
                    },
                    sup: ({ node, children, ...rest }) => {
                      const number = Number(node?.properties?.dataCite);
                      return number ? <CitationRef number={number} /> : <sup {...rest}>{children}</sup>;
                    },
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children }) =>
                      /language-mermaid/.test(className ?? "") ? <MermaidDiagram code={String(children).trimEnd()} /> : <pre><code className={className}>{children}</code></pre>,
                  }}
                >{isEditing ? markCells(body, cells, rows) : section.body}</ReactMarkdown>
                </EditCellsContext.Provider>
                )}
              </section>
              );
            })}
            <footer className="paper-footer"><span>AMIGO가 등록 자료와 답변을 바탕으로 생성한 문서입니다.</span><span>1 / 1</span></footer>
          </article>
          </CitationContext.Provider>
          </GanttContext.Provider>
        </section>
        <aside className="final-pending" aria-label="시간 될 때 적어 주세요">
          <div className="final-pending-title"><Icon name="clock" size={15} /><div><strong>시간 될 때 적어 주세요</strong><small>{readOnly ? "인계자가 아직 확인하지 못한 내용이에요." : "누르면 질문이 열려요. 답을 적어 보내면 문서에 반영돼요."}</small></div></div>
          {pending.length === 0 ? (
            <p className="final-pending-empty">확인할 내용이 남아 있지 않아요.</p>
          ) : (
            <ul>
              {pending.map((gap) => (
                <li key={gap.id}>
                  <button type="button" disabled={!!readOnly || revising} onClick={() => answerGap(gap)}>
                    <span className="final-pending-meta"><em>{slotTitle(gap.slot) || "기타"}</em><i className={`status-${gap.status}`}>{PENDING_LABEL[gap.status]}</i></span>
                    <strong>{gap.question || gap.description}</strong>
                    {gap.question && gap.description && gap.description !== gap.question && <small>{gap.description}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        {sourcesOpen && <SourcesDialog sessionId={sessionId} files={files} config={config} onClose={() => setSourcesOpen(false)} />}
        {transferOpen && <TransferDialog sessionId={sessionId} selfLoginId={profile.loginId} onClose={() => setTransferOpen(false)} />}
        {!readOnly && <button className="finish-handover finish-handover-mobile" onClick={onComplete}><Icon name="check" size={15} /> 인수인계 완료하기</button>}
      </main>
    </div>
  );
}
