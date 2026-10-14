import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../shared/api";
import { Brand } from "../shared/Brand";
import { Icon } from "../shared/Icon";
import type { StartData } from "../shared/handover";
import { MermaidDiagram } from "../shared/MermaidDiagram";
import type { DocumentVersion, DocumentVersionSummary } from "../shared/types";

type Props = {
  data: StartData;
  sessionId: string;
  markdown: string;
  version: number;
  loading: boolean;
  sourceCount: number;
  failedMessage: string | null;
  onRetry: () => void;
  onBack: () => void;
  onComplete: () => void;
  onMarkdownChange: (markdown: string) => void; // 직접 수정·복원으로 바뀐 문서를 화면에 바로 반영
  onSaved: () => void; // 세션 상태(문서 버전) 다시 불러오기
};

type Section = { heading: string; title: string; body: string };

// 생성된 Markdown 을 "## 제목" 기준으로 장(章)으로 나눈다. 첫 "## " 앞의 표지 부분은 화면의 표지가 대신한다.
function splitDocument(markdown: string): { preamble: string; sections: Section[] } {
  const [preamble, ...chunks] = markdown.split(/^##\s+/m);
  const sections = chunks.map((chunk) => {
    const [heading, ...rest] = chunk.split("\n");
    return { heading: heading.trim(), title: heading.trim().replace(/^\d+\.\s*/, ""), body: rest.join("\n").trim() };
  });
  return { preamble, sections };
}

// 장별로 고친 본문을 다시 하나의 Markdown 으로 합친다(표지 부분과 장 제목 줄은 그대로 둔다).
function joinDocument(preamble: string, sections: Section[], bodies: string[]): string {
  const head = preamble.trim() ? `${preamble.trimEnd()}\n\n` : "";
  return head + sections.map((section, index) => `## ${section.heading}\n\n${bodies[index].trim()}\n`).join("\n");
}

function formatTime(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function FinalDocumentScreen({ data, sessionId, markdown, version, loading, sourceCount, failedMessage, onRetry, onBack, onComplete, onMarkdownChange, onSaved }: Props) {
  const [activeSection, setActiveSection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseVersion, setBaseVersion] = useState(version);
  const [editBase, setEditBase] = useState(version); // 수정을 시작할 때의 버전(그사이 AI 가 새 초안을 쓰면 저장이 409 로 막힘)
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [preview, setPreview] = useState<DocumentVersion | null>(null);
  const tasks = data.task.split("\n").filter(Boolean);
  const shown = preview?.markdown ?? markdown;
  const { preamble, sections: parsed } = splitDocument(shown);
  const sections = parsed.map((section) => section.title);
  const current = versions.find((v) => v.is_current);
  const goTo = (index: number) => {
    setActiveSection(index);
    document.getElementById(`paper-section-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => setBaseVersion(version), [version]);

  const loadVersions = useCallback(async () => {
    try {
      setVersions((await api.documentVersions(sessionId)).versions);
    } catch {
      /* 버전 기록을 못 불러와도 문서는 볼 수 있다 */
    }
  }, [sessionId]);

  useEffect(() => {
    if (baseVersion > 0) void loadVersions();
  }, [baseVersion, loadVersions]);

  const startEditing = () => {
    const { sections: currentSections } = splitDocument(markdown);
    setPreview(null);
    setDrafts(currentSections.map((section) => section.body));
    setEditBase(baseVersion);
    setSaveError(null);
    setNotice(null);
    setIsEditing(true);
  };

  const saveEdits = async () => {
    const next = joinDocument(preamble, parsed, drafts);
    if (next.trim() === markdown.trim()) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.saveDocument(sessionId, next, editBase);
      onMarkdownChange(res.document.markdown);
      setBaseVersion(res.document.version);
      setNotice(res.message);
      setIsEditing(false);
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openVersion = async (target: number) => {
    setSaveError(null);
    try {
      const found = await api.documentVersion(sessionId, target);
      setPreview(found.is_current ? null : found);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const restoreVersion = async (target: number) => {
    setSaveError(null);
    try {
      const res = await api.restoreDocument(sessionId, target, baseVersion);
      onMarkdownChange(res.document.markdown);
      setBaseVersion(res.document.version);
      setPreview(null);
      setNotice(res.message);
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
    }
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
          <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "pdf", preview?.version); }}><Icon name="download" size={15} /> PDF</button>
          <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "docx", preview?.version); }}><Icon name="download" size={15} /> Word</button>
          <button onClick={() => { window.location.href = api.downloadUrl(sessionId, "md", preview?.version); }}><Icon name="download" size={15} /> Markdown</button>
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
            <div className="document-version-info">
              {preview ? (
                <strong>v{preview.version} 미리보기 · {preview.origin_label}{preview.author_name ? ` · ${preview.author_name}` : ""} (현재 문서는 v{baseVersion})</strong>
              ) : (
                <strong>v{baseVersion}{current ? ` · ${current.origin_label}${current.author_name ? ` · ${current.author_name}` : ""}` : ""}</strong>
              )}
            </div>
            <div>
              {preview && <button className="doc-tool" onClick={() => void restoreVersion(preview.version)}>이 버전으로 복원</button>}
              {preview && <button className="doc-tool" onClick={() => setPreview(null)}>현재 문서 보기</button>}
              {!isEditing && (
                <button className={`doc-tool ${showHistory ? "editing" : ""}`} onClick={() => { setShowHistory((open) => !open); void loadVersions(); }}>
                  <Icon name="clock" size={14} /> 버전 기록 {versions.length ? versions.length : ""}
                </button>
              )}
              {isEditing && <button className="doc-tool" disabled={saving} onClick={() => setIsEditing(false)}>취소</button>}
              <button
                className={`edit-toggle doc-tool ${isEditing ? "editing" : ""}`}
                disabled={saving || markdown === ""}
                onClick={() => (isEditing ? void saveEdits() : startEditing())}
              >
                <Icon name={isEditing ? "check" : "file"} size={14} /> {isEditing ? (saving ? "저장 중…" : "수정 완료(저장)") : "직접 수정하기"}
              </button>
            </div>
          </div>
          {(notice || saveError) && <div className={`document-save-note ${saveError ? "error" : ""}`}>{saveError ?? notice}</div>}
          {showHistory && !isEditing && (
            <div className="document-history">
              {versions.map((v) => (
                <div className={`document-history-row ${v.is_current ? "current" : ""} ${preview?.version === v.version ? "previewing" : ""}`} key={v.version}>
                  <div>
                    <strong>v{v.version} · {v.origin_label}{v.is_current ? " (현재)" : ""}</strong>
                    <small>{formatTime(v.created_at)}{v.author_name ? ` · ${v.author_name}` : ""}{v.note ? ` · ${v.note}` : ""}</small>
                  </div>
                  <button onClick={() => void openVersion(v.version)}>보기</button>
                  {!v.is_current && <button onClick={() => void restoreVersion(v.version)}>복원</button>}
                </div>
              ))}
              {versions.length === 0 && <small>저장된 버전이 없습니다.</small>}
            </div>
          )}
          <article className={`final-paper ${isEditing ? "is-editing" : ""}`}>
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
                {isEditing ? (
                  <textarea
                    className="paper-section-editor"
                    aria-label={`${section.title} 내용 수정`}
                    value={drafts[index] ?? ""}
                    rows={Math.max(6, (drafts[index] ?? "").split("\n").length + 1)}
                    onChange={(event) => setDrafts((prev) => prev.map((body, i) => (i === index ? event.target.value : body)))}
                  />
                ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children }) =>
                      /language-mermaid/.test(className ?? "") ? <MermaidDiagram code={String(children).trimEnd()} /> : <pre><code className={className}>{children}</code></pre>,
                  }}
                >{section.body}</ReactMarkdown>
                )}
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
