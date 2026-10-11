// 자료 등록: 드래그 앤 드롭 파일 업로드 + 컨플루언스/나누미 링크 입력 + 등록 자료 목록 + 분석 시작
import { AlertCircle, CheckCircle2, Link2, Loader2, Play, RotateCcw, UploadCloud, X } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import type { AppConfig, SessionDetail, Source } from "../../shared/types";
import { formatSize, sourceIcon, sourceLabel } from "./icons";

interface Props {
  session: SessionDetail;
  config: AppConfig | null;
  onUpload: (files: File[]) => void;
  onAddLink: (url: string, linkType: string) => void;
  onDelete: (source: Source) => void;
  onAnalyze: () => void;
}

const FORMAT_CHIPS = ["PDF", "HWPX/HWP", "Word", "PowerPoint", "Excel", "메일(.eml)", "소스코드", "ZIP"];

export function UploadPanel({ session, config, onUpload, onAddLink, onDelete, onAnalyze }: Props) {
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [linkType, setLinkType] = useState("auto");
  const inputRef = useRef<HTMLInputElement>(null);

  const processing = session.sources.some((s) => s.status === "pending" || s.status === "processing");
  const readyCount = session.sources.filter((s) => s.status === "ready").length;
  const running = session.status === "running";
  const canAnalyze = readyCount > 0 && !processing && !running;
  const accept = config?.allowed_extensions.join(",");

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onUpload(files);
  };

  const submitLink = (event: FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;
    onAddLink(value, linkType);
    setUrl("");
  };

  return (
    <section className="panel upload-panel" aria-label="자료 등록">
      <header className="panel-head">
        <h2>업무 자료</h2>
        <span className="muted">{session.sources.length}건</span>
      </header>

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        aria-label="파일을 끌어다 놓거나 클릭해서 선택"
      >
        <UploadCloud size={28} />
        <strong>파일을 끌어다 놓거나 클릭해서 선택</strong>
        <span className="muted small">최대 {config?.max_upload_mb ?? 50}MB · 여러 개 가능</span>
        <div className="chips">
          {FORMAT_CHIPS.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={accept}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onUpload(files);
            e.target.value = "";
          }}
        />
      </div>

      <form className="link-form" onSubmit={submitLink}>
        <label className="sr-only" htmlFor="link-url">
          링크 주소
        </label>
        <div className="link-row">
          <Link2 size={16} className="muted" />
          <input
            id="link-url"
            type="url"
            placeholder="컨플루언스·나누미 링크 붙여넣기"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="link-row">
          <select value={linkType} onChange={(e) => setLinkType(e.target.value)} aria-label="링크 유형">
            {(config?.link_types ?? [{ key: "auto", label: "자동 판별" }]).map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn secondary" disabled={!url.trim()}>
            링크 추가
          </button>
        </div>
      </form>

      <ul className="source-list">
        {session.sources.length === 0 && <li className="empty muted">아직 등록한 자료가 없어요.</li>}
        {session.sources.map((source) => {
          const Icon = sourceIcon(source);
          const busy = source.status === "pending" || source.status === "processing";
          return (
            <li key={source.id} className={`source ${source.status}`}>
              <Icon size={18} className="source-icon" />
              <div className="source-body">
                <span className="source-name" title={source.url || source.name}>
                  {source.name}
                </span>
                <span className="source-meta">
                  {sourceLabel(source)}
                  {source.size ? ` · ${formatSize(source.size)}` : ""}
                  {source.status === "ready" && ` · 조각 ${source.chunk_count}개`}
                  {source.added_stage !== "setup" && " · 대화 중 추가"}
                </span>
                {source.status === "failed" && <span className="source-error">{source.error}</span>}
                {source.status === "ready" && source.warnings[0] && <span className="source-warning">{source.warnings[0]}</span>}
              </div>
              <span className="source-status" title={{ pending: "대기", processing: "처리 중", ready: "완료", failed: "실패" }[source.status]}>
                {busy && <Loader2 size={16} className="spin" />}
                {source.status === "ready" && <CheckCircle2 size={16} />}
                {source.status === "failed" && <AlertCircle size={16} />}
              </span>
              {!busy && (
                <button className="icon-btn" onClick={() => onDelete(source)} aria-label={`${source.name} 삭제`}>
                  <X size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="analyze-box">
        <button className="btn primary block" disabled={!canAnalyze} onClick={onAnalyze}>
          {session.stage === "setup" ? <Play size={16} /> : <RotateCcw size={16} />}
          {session.stage === "setup" ? "분석 시작" : "처음부터 다시 분석"}
        </button>
        <p className="hint">
          {processing
            ? "자료를 읽고 있어요. 잠시만 기다려 주세요."
            : readyCount === 0
              ? "자료를 1건 이상 등록하면 분석을 시작할 수 있어요."
              : session.stage === "setup"
                ? `자료 ${readyCount}건 준비 완료`
                : "대화 중에 올린 자료는 자동으로 분석에 반영돼요."}
        </p>
      </div>
    </section>
  );
}
