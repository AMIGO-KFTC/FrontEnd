import { FormEvent, useRef, useState } from "react";
import Brand from "@/components/Brand";
import Icon from "@/components/Icon";
import LeaveSeasideBackground from "@/components/LeaveSeasideBackground";
import StepUserMenu from "@/components/StepUserMenu";
import { type HandoverVariant } from "@/screens/handover/types";
import { useDraftState } from "@/store/AppStore";

export default function UploadStepScreen({ onBack, onNext, onLogout, onHome, variant }: { onBack: () => void; onNext: () => void; onLogout: () => void; onHome: () => void; variant: HandoverVariant }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useDraftState("files");
  const [link, setLink] = useState("");
  const [links, setLinks] = useDraftState("links");
  const [mailResources, setMailResources] = useDraftState("mailResources");
  const [activeSource, setActiveSource] = useState<"file" | "mail" | "confluence" | "messenger">("file");
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailAuthenticated, setMailAuthenticated] = useDraftState("mailAuthenticated");
  const [mailAddress, setMailAddress] = useDraftState("mailAddress");
  const [mailPassword, setMailPassword] = useState("");
  const [mailError, setMailError] = useState("");
  const [mailSearch, setMailSearch] = useState("");
  const [selectedMailIds, setSelectedMailIds] = useDraftState("selectedMailIds");
  const mailbox = [
    { id: 1, sender: "김민준 · 플랫폼기획팀", address: "minjun.kim@company.com", subject: "2025년 플랫폼 운영 계획 및 주요 일정 공유", preview: "올해 플랫폼 운영 계획과 분기별 주요 일정을 정리해 공유드립니다.", date: "오늘 10:24", attachment: "플랫폼_운영계획.pdf" },
    { id: 2, sender: "이서연 · 서비스운영팀", address: "seoyeon.lee@company.com", subject: "RE: 고객사 정기 점검 체크리스트", preview: "지난 회의에서 논의한 점검 항목을 반영한 최종본입니다.", date: "오늘 09:12", attachment: "점검_체크리스트.xlsx" },
    { id: 3, sender: "박지훈 · 인프라팀", address: "jihoon.park@company.com", subject: "장애 대응 프로세스 및 비상 연락망 업데이트", preview: "담당자 변경 내용을 반영했으니 인수인계 자료에 포함해 주세요.", date: "어제", attachment: "" },
    { id: 4, sender: "최유진 · 사업관리팀", address: "yujin.choi@company.com", subject: "파트너사 월별 정산 일정 안내", preview: "세금계산서 발행 일정과 검수 마감일을 안내드립니다.", date: "3월 12일", attachment: "정산일정_2025.xlsx" },
    { id: 5, sender: "AMIGO 프로젝트", address: "amigo-project@company.com", subject: "[회의록] 운영 자동화 프로젝트 주간 회의", preview: "이번 주 진행 현황, 결정 사항 및 다음 액션 아이템입니다.", date: "3월 10일", attachment: "주간회의록.docx" },
  ];
  const filteredMailbox = mailbox.filter((mail) => {
    const query = mailSearch.trim().toLowerCase();
    return !query || `${mail.sender} ${mail.address} ${mail.subject} ${mail.preview}`.toLowerCase().includes(query);
  });
  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles((current) => [...current, ...Array.from(fileList).map((file) => ({ name: file.name, size: file.size, file }))]);
  };
  const addLink = () => {
    const nextLink = link.trim();
    if (!nextLink) return;
    setLinks((current) => [...current, nextLink]);
    setLink("");
  };
  const openMailModal = () => {
    setActiveSource("mail");
    setMailModalOpen(true);
    setMailError("");
  };
  const loginToMail = (event: FormEvent) => {
    event.preventDefault();
    if (!mailAddress.trim() || !mailPassword.trim()) {
      setMailError("이메일 주소와 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setMailAuthenticated(true);
    setMailError("");
  };
  const addSelectedMails = () => {
    const selected = mailbox
      .filter((mail) => selectedMailIds.includes(mail.id))
      .map(({ id, subject, sender }) => ({ id, subject, sender }));
    setMailResources((current) => [
      ...current.filter((item) => !selectedMailIds.includes(item.id)),
      ...selected,
    ]);
    setMailModalOpen(false);
  };

  return (
    <div className={`upload-step-page ${variant === "leave" ? "leave-theme" : ""}`}>
      {variant === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header upload-step-header">
        <Brand />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span />
          <span />
          <small>2 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="upload-step-main">
        <div className="upload-step-title">
          <span>STEP 02 · 자료 등록</span>
          <h1>업무 자료를 모아주세요</h1>
          <p>AMIGO가 자료의 내용을 분석해 인수인계 항목과 질문을 준비합니다.</p>
          <div className="upload-richness-note"><Icon name="sparkle" size={14} /><strong>자료가 풍부할수록 인수인계 문서가 더 정확해져요</strong></div>
        </div>
        <input className="source-file-input" ref={inputRef} type="file" multiple onChange={(event) => addFiles(event.target.files)} />
        <section className="source-grid">
          <button className={activeSource === "file" ? "active" : ""} onClick={() => { setActiveSource("file"); inputRef.current?.click(); }}>
            <span><Icon name="upload" size={20} /></span><strong>파일 업로드</strong><small>업무 매뉴얼부터 기안문서까지, 인수인계에 필요한 모든 자료 업로드</small><small className="source-formats">PDF · HWP · Word · PPT · Excel · JPG</small>
          </button>
          <button className={activeSource === "mail" ? "active" : ""} onClick={openMailModal}>
            <span><Icon name="mail" size={20} /></span><strong>메일 연결</strong><small>업무 메일 검색 및 선택</small>
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
        <div className="source-action-slot">
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
            <section className="source-action-panel mail-connected-panel" onClick={openMailModal}>
              <Icon name={mailAuthenticated ? "check" : "mail"} size={18} />
              <div>
                <strong>{mailAuthenticated ? `${mailAddress} 메일함이 연결되었습니다` : "업무 메일에 로그인해 주세요"}</strong>
                <p>{mailAuthenticated ? "메일함을 다시 열어 자료를 추가할 수 있어요." : "로그인 후 필요한 메일을 검색하고 선택할 수 있어요."}</p>
              </div>
              <button>{mailAuthenticated ? "메일함 열기" : "로그인"}</button>
            </section>
          ) : null}
        </div>
        <section className="step-added-list">
            <div className="added-list-title"><strong><Icon name="folder" size={15} /> 등록된 자료</strong><span>{files.length + links.length + mailResources.length}개</span></div>
            {files.length === 0 && links.length === 0 && mailResources.length === 0 && <div className="empty-resource">아직 등록된 자료가 없습니다.</div>}
            {files.map((file, index) => (
              <div className="added-resource" key={`${file.name}-${index}`}>
                <span><Icon name="file" size={17} /></span>
                <div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></div>
                <button onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {links.map((item, index) => (
              <div className="added-resource" key={`${item}-${index}`}>
                <span><Icon name="link" size={17} /></span>
                <div><strong>{item}</strong><small>외부 링크</small></div>
                <button onClick={() => setLinks((current) => current.filter((_, linkIndex) => linkIndex !== index))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {mailResources.map((mail) => (
              <div className="added-resource" key={`mail-${mail.id}`}>
                <span><Icon name="mail" size={17} /></span>
                <div><strong>{mail.subject}</strong><small>{mail.sender} · 연결된 메일</small></div>
                <button onClick={() => setMailResources((current) => current.filter((item) => item.id !== mail.id))}><Icon name="close" size={14} /></button>
              </div>
            ))}
        </section>
        <div className="upload-step-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" onClick={onNext}>AI 분석 시작 <Icon name="arrow" size={18} /></button>
        </div>
      </main>
      {mailModalOpen && (
        <div className="mail-connect-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMailModalOpen(false);
        }}>
          <section className={`mail-connect-modal ${mailAuthenticated ? "mailbox-view" : ""}`} role="dialog" aria-modal="true" aria-labelledby="mail-connect-title">
            <header className="mail-modal-header">
              <div className="mail-modal-brand">
                <span><Icon name="mail" size={19} /></span>
                <div><strong>AMIGO Mail Connect</strong><small>업무 메일 자료 가져오기</small></div>
              </div>
              <button className="mail-modal-close" onClick={() => setMailModalOpen(false)} aria-label="메일 연결 창 닫기"><Icon name="close" size={18} /></button>
            </header>
            {!mailAuthenticated ? (
              <form className="mail-login-form" onSubmit={loginToMail}>
                <div className="mail-login-icon"><Icon name="mail" size={27} /></div>
                <span className="mail-login-kicker">SECURE MAIL CONNECTION</span>
                <h2 id="mail-connect-title">업무용 메일에 로그인</h2>
                <p>메일함에서 인수인계에 필요한 자료를 직접 검색하고 가져오세요.</p>
                <label>이메일 주소
                  <div className="mail-login-input"><Icon name="user" size={17} /><input type="email" value={mailAddress} onChange={(event) => setMailAddress(event.target.value)} placeholder="name@company.com" autoComplete="username" autoFocus /></div>
                </label>
                <label>비밀번호
                  <div className="mail-login-input"><Icon name="shield" size={17} /><input type="password" value={mailPassword} onChange={(event) => setMailPassword(event.target.value)} placeholder="비밀번호를 입력하세요" autoComplete="current-password" /></div>
                </label>
                {mailError && <p className="mail-login-error">{mailError}</p>}
                <button className="mail-login-submit" type="submit">메일함 연결하기 <Icon name="arrow" size={17} /></button>
                <div className="mail-security-note"><Icon name="shield" size={13} /> 로그인 정보는 메일함 연결에만 사용되며 저장되지 않습니다.</div>
              </form>
            ) : (
              <div className="mailbox-content">
                <div className="mailbox-title-row">
                  <div>
                    <span className="mailbox-status"><i /> 연결됨 · {mailAddress}</span>
                    <h2 id="mail-connect-title">받은 메일함</h2>
                    <p>인수인계 자료로 활용할 메일을 선택해 주세요.</p>
                  </div>
                </div>
                <div className="mailbox-search"><Icon name="search" size={17} /><input value={mailSearch} onChange={(event) => setMailSearch(event.target.value)} placeholder="보낸 사람, 제목, 내용으로 검색" autoFocus />{mailSearch && <button onClick={() => setMailSearch("")} aria-label="검색어 지우기"><Icon name="close" size={14} /></button>}</div>
                <div className="mailbox-list-head">
                  <label><input type="checkbox" checked={filteredMailbox.length > 0 && filteredMailbox.every((mail) => selectedMailIds.includes(mail.id))} onChange={(event) => {
                    const visibleIds = filteredMailbox.map((mail) => mail.id);
                    setSelectedMailIds((current) => event.target.checked ? Array.from(new Set([...current, ...visibleIds])) : current.filter((id) => !visibleIds.includes(id)));
                  }} /> 검색 결과 전체 선택</label>
                  <span>{filteredMailbox.length}건</span>
                </div>
                <div className="mailbox-list">
                  {filteredMailbox.length === 0 ? (
                    <div className="mailbox-empty"><Icon name="search" size={22} /><strong>검색 결과가 없습니다</strong><span>다른 검색어로 다시 찾아보세요.</span></div>
                  ) : filteredMailbox.map((mail) => (
                    <label className={`mailbox-item ${selectedMailIds.includes(mail.id) ? "selected" : ""}`} key={mail.id}>
                      <input type="checkbox" checked={selectedMailIds.includes(mail.id)} onChange={() => setSelectedMailIds((current) => current.includes(mail.id) ? current.filter((id) => id !== mail.id) : [...current, mail.id])} />
                      <span className="mail-sender-avatar">{mail.sender.slice(0, 1)}</span>
                      <div className="mailbox-item-copy">
                        <div><strong>{mail.sender}</strong><time>{mail.date}</time></div>
                        <h3>{mail.subject}</h3>
                        <p>{mail.preview}</p>
                        {mail.attachment && <small><Icon name="paperclip" size={12} /> {mail.attachment}</small>}
                      </div>
                    </label>
                  ))}
                </div>
                <footer className="mailbox-footer">
                  <span><strong>{selectedMailIds.length}</strong>개의 메일 선택됨</span>
                  <div><button onClick={() => setMailModalOpen(false)}>취소</button><button className="mail-add-button" disabled={selectedMailIds.length === 0} onClick={addSelectedMails}>선택한 메일 추가 <Icon name="arrow" size={16} /></button></div>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
