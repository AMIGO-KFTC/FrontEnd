// 최종 문서 뷰어: AI 가 생성한 Markdown 인수인계서를 보여 주고 PDF/Word 다운로드를 연결한다.
import { Download, FileDown, FileText, Loader2, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../../shared/api";
import type { SessionDetail } from "../../shared/types";

export function DocumentViewer({ session, onGenerate }: { session: SessionDetail; onGenerate: () => void }) {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const version = session.document_version;

  useEffect(() => {
    if (!version) return;
    let cancelled = false;
    setLoading(true);
    api
      .document(session.id)
      .then((d) => !cancelled && setMarkdown(d.markdown))
      .catch(() => !cancelled && setMarkdown(""))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.id, version]);

  if (!version) {
    const canGenerate = session.stage === "qna" && session.status !== "running";
    return (
      <div className="doc-empty">
        <FileText size={40} />
        <h3>아직 인수인계서가 없어요</h3>
        <p className="muted">질의응답을 마치면 자동으로 작성돼요. 지금까지 정리된 내용으로 먼저 만들어 볼 수도 있어요.</p>
        <button className="btn primary" onClick={onGenerate} disabled={!canGenerate}>
          지금 문서 생성
        </button>
      </div>
    );
  }

  return (
    <div className="doc">
      <div className="doc-toolbar">
        <div>
          <strong>업무 인수인계서</strong>
          <span className="badge info">초안 v{version}</span>
          {session.status === "running" && session.stage === "composing" && (
            <span className="muted small">
              <Loader2 size={12} className="spin" /> 새 버전 작성 중
            </span>
          )}
        </div>
        <div className="doc-actions">
          <a className="btn primary small" href={api.downloadUrl(session.id, "pdf")} download>
            <Download size={14} /> PDF
          </a>
          <a className="btn secondary small" href={api.downloadUrl(session.id, "docx")} download>
            <FileDown size={14} /> Word
          </a>
          <a className="btn ghost small" href={api.downloadUrl(session.id, "md")} download>
            Markdown
          </a>
          <button className="btn ghost small" onClick={() => window.print()} aria-label="인쇄">
            <Printer size={14} />
          </button>
        </div>
      </div>
      <article className="paper markdown">
        {loading && !markdown ? (
          <p className="muted">
            <Loader2 size={14} className="spin" /> 불러오는 중…
          </p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => (
                <div className="table-wrap">
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        )}
      </article>
    </div>
  );
}
