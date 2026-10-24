// 완성 문서 화면 왼쪽의 "출처 N개 연결됨"을 누르면 뜨는 창. 이 인수인계서에 올린 자료 파일을 쭉 보여 주고,
// 파일을 고르면 원본을 내려받는다(GET /api/sessions/{id}/sources/{source_id}/file). 문장별 근거는 본문 번호에 마우스를 올려 본다.
import { useEffect } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import type { AppConfig, Source } from "@/shared/types";

type Props = {
  sessionId: string;
  files: Source[]; // 내려받을 수 있는 올린 파일(링크·처리 실패 파일 제외)
  config: AppConfig | null;
  onClose: () => void;
};

// 파일 형식 이름(서버의 format_labels 로 이름을 붙임)
function fileType(source: Source, config: AppConfig | null): string {
  const ext = source.extension.replace(/^\./, "").toLowerCase();
  return config?.format_labels[ext] ?? (ext ? ext.toUpperCase() : "파일");
}

function fileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function SourcesDialog({ sessionId, files, config, onClose }: Props) {
  // ESC 로 닫는다
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="logout-overlay" role="presentation" onClick={onClose}>
      <section className="transfer-modal sources-modal" role="dialog" aria-modal="true" aria-labelledby="sources-title" onClick={(event) => event.stopPropagation()}>
        <button className="sources-close" type="button" aria-label="닫기" onClick={onClose}><Icon name="close" size={16} /></button>
        <h2 id="sources-title">연결된 출처</h2>
        <p className="transfer-desc">AI가 인수인계서를 쓸 때 참고한 자료 {files.length}개예요. 파일을 누르면 원본을 내려받아요.</p>
        <ul className="sources-files">
          {files.length === 0 && <li className="transfer-empty">연결된 자료가 없어요.</li>}
          {files.map((file) => (
            <li key={file.id}>
              <a href={api.sourceFileUrl(sessionId, file.id)} download={file.name} title={`${file.name} 내려받기`}>
                <Icon name="file" size={16} />
                <strong>{file.name}</strong>
                <em>{fileType(file, config)}</em>
                {file.size > 0 && <small>{fileSize(file.size)}</small>}
                <Icon name="download" size={15} />
              </a>
            </li>
          ))}
        </ul>
        <div className="transfer-actions"><button type="button" className="primary" onClick={onClose}>닫기</button></div>
      </section>
    </div>
  );
}
