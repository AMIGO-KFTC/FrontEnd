import { useRef, useState } from "react";
import Icon from "@/components/Icon";

type UploadFile = { name: string; meta: string; status: "done" | "loading" | "error" };

export default function UploadPanel({ onAnalyze }: { onAnalyze: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([
    { name: "플랫폼_운영가이드_v3.pdf", meta: "4.8 MB · PDF", status: "done" },
    { name: "2025_Q1_백로그.xlsx", meta: "1.2 MB · Excel", status: "done" },
    { name: "배포_스크립트.zip", meta: "18.7 MB · ZIP", status: "loading" },
  ]);
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles([...files, ...Array.from(list).map((file) => ({ name: file.name, meta: `${(file.size / 1024 / 1024).toFixed(1)} MB`, status: "done" as const }))]);
  };

  return (
    <aside className="upload-panel">
      <div className="panel-heading"><div><span className="panel-kicker">STEP 01</span><h2>자료 등록</h2></div><span className="count-badge">{files.length}</span></div>
      <div className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <input ref={inputRef} type="file" multiple onChange={(e) => addFiles(e.target.files)} />
        <span className="upload-icon"><Icon name="upload" size={22} /></span>
        <strong>자료를 여기에 놓아주세요</strong>
        <p>또는 클릭해서 파일 선택</p>
        <small>PDF · HWP · Word · PPT · Excel · 메일<br />소스코드 · ZIP</small>
      </div>
      <div className="link-add">
        <label>외부 자료 링크</label>
        <div><Icon name="link" size={16} /><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Confluence / 나누미 URL" /><button onClick={() => setLink("")}>추가</button></div>
      </div>
      <div className="file-list">
        <div className="list-title"><strong>등록된 자료</strong><span>{files.length}개</span></div>
        {files.map((file, index) => (
          <div className="file-row" key={`${file.name}-${index}`}>
            <span className="file-icon"><Icon name={file.name.endsWith(".zip") ? "folder" : "file"} size={17} /></span>
            <div><strong>{file.name}</strong><small>{file.meta}</small>{file.status === "loading" && <span className="file-loading"><i /></span>}</div>
            <span className={`file-status ${file.status}`}>{file.status === "done" ? <Icon name="check" size={13} /> : file.status === "loading" ? "72%" : "!"}</span>
          </div>
        ))}
      </div>
      <button className="analyze-button" onClick={onAnalyze}><Icon name="sparkle" size={17} /> AI 분석 시작</button>
      <p className="panel-footnote"><Icon name="shield" size={13} /> 등록 자료는 분석 완료 후 안전하게 삭제됩니다.</p>
    </aside>
  );
}
