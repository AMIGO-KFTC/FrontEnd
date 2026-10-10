import { useRef, useState } from "react";
import { Brand } from "../shared/Brand";
import { ErrorNote } from "../shared/ErrorNote";
import { Icon } from "../shared/Icon";
import type { Source } from "../shared/types";

type Props = {
  sources: Source[];
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  onUploadFiles: (files: File[]) => void;
  onAddLink: (url: string) => void;
  onDeleteSource: (source: Source) => void;
};

function sourceStatus(source: Source): string {
  if (source.status === "pending" || source.status === "processing") return " · 읽는 중";
  if (source.status === "failed") return ` · 실패${source.error ? `: ${source.error}` : ""}`;
  return "";
}

export function UploadStepScreen({ sources, error, busy, onBack, onNext, onUploadFiles, onAddLink, onDeleteSource }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const files = sources.filter((source) => source.kind === "file");
  const links = sources.filter((source) => source.kind === "link");
  const [activeSource, setActiveSource] = useState<"file" | "mail" | "confluence" | "messenger">("file");
  const addFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    onUploadFiles(Array.from(fileList));
  };
  const addLink = () => {
    const nextLink = link.trim();
    if (!nextLink) return;
    onAddLink(nextLink);
    setLink("");
  };

  return (
    <div className="upload-step-page">
      <header className="onboarding-header upload-step-header">
        <Brand />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span />
          <span />
          <small>2 / 4</small>
        </div>
      </header>
      <main className="upload-step-main">
        <div className="upload-step-title">
          <span>STEP 02 · 자료 등록</span>
          <h1>업무 자료를 모아주세요</h1>
          <p>AMIGO가 자료의 내용을 분석해 인수인계 항목과 질문을 준비합니다.</p>
        </div>
        <input className="source-file-input" ref={inputRef} type="file" multiple onChange={(event) => addFiles(event.target.files)} />
        <section className="source-grid">
          <button className={activeSource === "file" ? "active" : ""} onClick={() => { setActiveSource("file"); inputRef.current?.click(); }}>
            <span><Icon name="upload" size={20} /></span><strong>파일 업로드</strong><small>업무 매뉴얼부터 기안문서까지, 인수인계에 필요한 모든 자료 업로드</small><small className="source-formats">PDF · HWP · Word · PPT · Excel · JPG</small>
          </button>
          <button className={activeSource === "mail" ? "active" : ""} onClick={() => setActiveSource("mail")}>
            <span><Icon name="mail" size={20} /></span><strong>메일 연결</strong><small>업무 메일 검색 및 선택</small><small className="mail-upload-note">메일 연동을 원하지 않는 경우, 메일 화면을 캡처하여 이미지로 직접 업로드 가능</small>
          </button>
          <div className={`source-card link-source-card ${activeSource === "confluence" ? "active" : ""}`}>
            <button className="source-card-heading" onClick={() => setActiveSource("confluence")}>
              <span><Icon name="folder" size={20} /></span><strong>컨플루언스 &amp; 나누미 연결</strong><small>업무 페이지 링크 가져오기</small>
            </button>
            <div className="inline-source-link">
              <input
                value={link}
                onFocus={() => setActiveSource("confluence")}
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addLink();
                  }
                }}
                placeholder="링크 붙여넣기"
              />
              <button onClick={addLink}>추가</button>
            </div>
          </div>
          <button className={activeSource === "messenger" ? "active" : ""} onClick={() => setActiveSource("messenger")}>
            <span><Icon name="message" size={20} /></span><strong>메신저 &amp; 메타모스트 파일</strong><small>대화 이미지 또는 내보내기 파일</small><small className="source-formats">JPG · PDF · PNG</small>
          </button>
        </section>
        {activeSource === "messenger" ? (
          <section
            className="source-action-panel"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
          >
            <Icon name="upload" size={18} />
            <div><strong>대화 캡처 이미지를 여기에 놓아주세요</strong><p>클릭해서 파일을 직접 선택할 수도 있어요.</p></div>
            <button>파일 선택</button>
          </section>
        ) : activeSource === "mail" ? (
        <section className="step-link-area">
          <div className="step-section-label"><span><Icon name="link" size={15} /></span><div><strong>메일 계정 연결</strong><p>메일함 주소 또는 공유 메일 링크를 입력하세요.</p></div></div>
          <div className="step-link-input">
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLink();
                }
              }}
              placeholder="메일함 또는 공유 메일 링크를 입력하세요"
            />
            <button onClick={addLink}>추가</button>
          </div>
        </section>
        ) : null}
        <section className="step-added-list">
            <div className="added-list-title"><strong><Icon name="folder" size={15} /> 등록된 자료</strong><span>{sources.length}개</span></div>
            {sources.length === 0 && <div className="empty-resource">아직 등록된 자료가 없습니다.</div>}
            {files.map((file) => (
              <div className="added-resource" key={file.id}>
                <span><Icon name="file" size={17} /></span>
                <div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB{sourceStatus(file)}</small></div>
                <button onClick={() => onDeleteSource(file)}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {links.map((item) => (
              <div className="added-resource" key={item.id}>
                <span><Icon name="link" size={17} /></span>
                <div><strong>{item.url || item.name}</strong><small>외부 링크{sourceStatus(item)}</small></div>
                <button onClick={() => onDeleteSource(item)}><Icon name="close" size={14} /></button>
              </div>
            ))}
        </section>
        <ErrorNote message={error} />
        <div className="upload-step-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" disabled={busy} onClick={onNext}>AI 분석 시작 <Icon name="arrow" size={18} /></button>
        </div>
      </main>
      <footer className="onboarding-footer"><Icon name="shield" size={13} /> 입력한 정보는 안전하게 암호화되어 저장됩니다.</footer>
    </div>
  );
}
