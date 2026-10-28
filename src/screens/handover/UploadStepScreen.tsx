import { useCallback, useEffect, useRef, useState } from "react";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import { Icon, type IconName } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { StepUserMenu } from "@/shared/StepUserMenu";
import { MAIL_CAPTURE_PREFIX } from "@/shared/mailCapture";
import { openPickerTab, useCaptureReceiver, usePicked, usePickReceiver, type PickAck, type PickItem, type PickKind } from "@/shared/pickBridge";
import type { HandoverMode, IntegrationImportResult, Source } from "@/shared/types";
import { IntegrationLauncher } from "./IntegrationLauncher";

type Props = {
  mode: HandoverMode;
  sources: Source[];
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  onLogout: () => void;
  onHome: () => void;
  onUploadFiles: (files: File[]) => void;
  onAddLink: (url: string) => void;
  onDeleteSource: (source: Source) => void;
  onImportConfluence: (pageIds: string[]) => Promise<IntegrationImportResult | undefined>;
  onImportMails: (messageIds: string[]) => Promise<IntegrationImportResult | undefined>;
  onImportJira: (itemIds: string[]) => Promise<IntegrationImportResult | undefined>;
};

type SourceKey = "file" | "mail" | "confluence" | "jira";
// 목록 한 줄. 등록 예정(고르기만 한 것)과 등록된 자료(서버에 저장된 것)를 같은 모양으로 그린다.
type ListRow = { id: string; group: SourceKey; icon: IconName; title: string; sub: string; remove: () => void };

const INTEGRATION_LABEL: Record<string, string> = { mattermost: "Mattermost 대화", confluence: "컨플루언스 페이지", mail: "메일", jira: "지라" };
// 파일 업로드 예시. 어떤 자료를 올리면 좋은지 보여 준다(서버가 읽는 형식만).
// recommend: 있으면 결과가 가장 좋아지는 자료라 맨 앞에 두고 따로 눈에 띄게 그린다. important: 그중에서도 더 중요하게 보여 줄 자료('중요' 표시).
const FILE_EXAMPLES: { name: string; desc: string; recommend?: boolean; important?: boolean }[] = [
  { name: "기존 인수인계서.hwp", desc: "있다면 꼭! 문서가 훨씬 정확해져요", recommend: true },
  { name: "경영정보시스템 업무보고자료.hwp", desc: "있다면 꼭 함께 올려 주세요", recommend: true, important: true },
  { name: "업무정의서.pdf", desc: "담당 업무와 범위" },
  { name: "추진계획서·보고서.pdf", desc: "일정과 추진 경과" },
  { name: "운영매뉴얼.hwpx", desc: "작업 절차·주의사항" },
  { name: "주간회의록.docx", desc: "진행 중인 이슈와 결정" },
  { name: "계정목록.xlsx", desc: "시스템·계정 현황" },
  { name: "협조요청.eml", desc: "업무 메일 원문" },
  { name: "메신저 대화 캡처.png", desc: "스크린샷 속 글자도 읽어요" },
  { name: "자료모음.zip", desc: "여러 파일을 묶어서 한 번에" },
];
const START_WAIT_MS = 120_000; // 등록한 자료를 다 읽을 때까지 기다리는 최대 시간

// 자료 종류 4개. 하나를 누르면 그 내용이 가운데로 나오고, 나머지는 아래쪽 줄로 내려간다.
const CARDS: { key: SourceKey; icon: IconName; title: string; desc: string; tag?: string; soon?: boolean }[] = [
  { key: "file", icon: "upload", title: "파일 업로드", desc: "업무 매뉴얼부터 기안문서까지, 인수인계에 필요한 모든 자료 업로드", tag: "PDF · HWP · Word · PPT · Excel · PNG · JPG · ZIP" },
  { key: "mail", icon: "mail", title: "메일 연결", desc: "업무 메일 검색 및 선택", tag: "제목 · 관련 사람 이름으로 검색 · 메일 캡처" },
  { key: "confluence", icon: "folder", title: "컨플루언스 & 나누미 연결", desc: "업무 페이지 링크 가져오기" },
  { key: "jira", icon: "bolt", title: "지라 연결", desc: "이슈·에픽과 프로젝트 진행 현황 가져오기", tag: "스프린트 진척 · 에픽 진행률 · 막힌 이슈" },
];

function sourceStatus(source: Source): string {
  if (source.status === "pending" || source.status === "processing") return " · 읽는 중";
  if (source.status === "failed") return ` · 실패${source.error ? `: ${source.error}` : ""}`;
  return "";
}

function SourceCard({ card, onSelect, counts, compact = false, index = 0 }: { card: (typeof CARDS)[number]; onSelect: (key: SourceKey) => void; counts: { pending: number; registered: number }; compact?: boolean; index?: number }) {
  return (
    <button type="button" className={`us-card ${compact ? "compact" : ""}`} style={{ "--i": index } as React.CSSProperties} onClick={() => onSelect(card.key)}>
      <span className="us-card-icon"><Icon name={card.icon} size={compact ? 17 : 22} /></span>
      <strong>{card.title}{card.soon && <em className="source-pending">준비 중</em>}</strong>
      {(counts.pending > 0 || counts.registered > 0) && (
        <span className="us-card-counts">
          {counts.pending > 0 && <i className="pending">예정 {counts.pending}</i>}
          {counts.registered > 0 && <i>등록 {counts.registered}</i>}
        </span>
      )}
      {!compact && <small>{card.desc}</small>}
      {!compact && card.tag && <small className="source-formats">{card.tag}</small>}
    </button>
  );
}

export function UploadStepScreen({ mode, sources, error, busy, onBack, onNext, onLogout, onHome, onUploadFiles, onAddLink, onDeleteSource, onImportConfluence, onImportMails, onImportJira }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const isIntegration = (source: Source) => source.link_type in INTEGRATION_LABEL;
  const isMailCapture = (source: Source) => source.kind === "file" && source.name.startsWith(MAIL_CAPTURE_PREFIX); // 메일 캡처 그림은 '메일'에 모은다
  const files = sources.filter((source) => source.kind === "file" && !isIntegration(source) && !isMailCapture(source));
  const links = sources.filter((source) => source.kind === "link" && !isIntegration(source));
  const imported = sources.filter(isIntegration);
  const [activeSource, setActiveSource] = useState<SourceKey | null>(null);
  // 가장 최근에 선택 창(새 탭)을 열려던 시도가 성공했는지(false 면 팝업 차단 안내)
  const [opened, setOpened] = useState<Record<PickKind, boolean>>({ mattermost: true, confluence: true, mail: true, jira: true });
  const openPicker = (kind: PickKind) => {
    const ok = openPickerTab(kind); // 상태 갱신 함수 밖에서 연다(개발 모드는 갱신 함수를 두 번 실행해 탭이 두 번 열린다)
    setOpened((prev) => ({ ...prev, [kind]: ok }));
  };
  // 고른 페이지는 여기서 들고 있다. 다른 탭(선택 창)에서 보내 온 항목도 같은 곳에 들어오고, 등록은 이 창에서 한다.
  const confluencePicked = usePicked();
  const { addMany: addConfluence } = confluencePicked;
  const mailPicked = usePicked(); // 메일함 창에서 고른 메일(등록 예정)
  const { addMany: addMail } = mailPicked;
  const jiraPicked = usePicked(); // 지라 창에서 고른 이슈·에픽·진행 현황(등록 예정)
  const { addMany: addJira } = jiraPicked;
  const acceptPicks = useCallback(
    (kind: PickKind, items: PickItem[]): PickAck => {
      if (kind !== "confluence" && kind !== "mail" && kind !== "jira") return { added: 0, skipped: items.length }; // 메신저(Mattermost) 연결은 없앴다
      const registered = new Set(sources.filter((source) => source.link_type === kind).map((source) => source.url));
      const fresh = items.filter((item) => !registered.has(item.url));
      (kind === "mail" ? addMail : kind === "jira" ? addJira : addConfluence)(fresh);
      setActiveSource(kind);
      return { added: fresh.length, skipped: items.length - fresh.length };
    },
    [sources, addConfluence, addMail, addJira],
  );
  usePickReceiver(acceptPicks);
  // 메일함 창에서 '캡처로 올리기'를 누르면 캡처 그림이 넘어온다. 파일 업로드와 똑같이 바로 등록한다.
  const acceptCapture = useCallback(
    (file: File): boolean => {
      onUploadFiles([file]);
      setActiveSource("mail");
      return true;
    },
    [onUploadFiles],
  );
  useCaptureReceiver(acceptCapture);
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
  // 카드를 눌러도 새 탭은 열리지 않는다. 'Mattermost 열기' 같은 단추를 눌러야 열린다.
  const select = (key: SourceKey) => setActiveSource(key);
  const dropProps = {
    onClick: () => inputRef.current?.click(),
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      addFiles(event.dataTransfer.files);
    },
  };

  // ---- 자료 목록: 종류별로 '등록 예정'(고르기만 함)과 '등록된 자료'(저장됨)를 나눠 둔다. 어느 쪽이든 ×로 뺄 수 있다.
  const pendingConfluenceRows: ListRow[] = confluencePicked.items.map((item) => ({
    id: `pending-confluence-${item.id}`,
    group: "confluence",
    icon: "folder",
    title: item.title,
    sub: `${INTEGRATION_LABEL.confluence} · 등록 전`,
    remove: () => confluencePicked.toggle(item),
  }));
  const savedRow = (source: Source, group: SourceKey, icon: IconName, sub: string): ListRow => ({
    id: `saved-${source.id}`,
    group,
    icon,
    title: source.kind === "link" && !isIntegration(source) ? source.url || source.name : source.name,
    sub: `${sub}${sourceStatus(source)}`,
    remove: () => onDeleteSource(source),
  });
  const pendingMailRows: ListRow[] = mailPicked.items.map((item) => ({
    id: `pending-mail-${item.id}`,
    group: "mail",
    icon: "mail",
    title: item.title,
    sub: `${INTEGRATION_LABEL.mail} · 등록 전`,
    remove: () => mailPicked.toggle(item),
  }));
  const pendingJiraRows: ListRow[] = jiraPicked.items.map((item) => ({
    id: `pending-jira-${item.id}`,
    group: "jira",
    icon: "bolt",
    title: item.title,
    sub: `${INTEGRATION_LABEL.jira} · 등록 전`,
    remove: () => jiraPicked.toggle(item),
  }));
  const fileRows = files.map((file) => savedRow(file, "file", "file", `${(file.size / 1024 / 1024).toFixed(1)} MB`));
  const mailRows = imported.filter((item) => item.link_type === "mail").map((item) => savedRow(item, "mail", "mail", INTEGRATION_LABEL.mail));
  const captureRows = sources.filter(isMailCapture).map((item) => savedRow(item, "mail", "file", "메일 캡처 그림"));
  const linkRows = links.map((item) => savedRow(item, "confluence", "link", "외부 링크"));
  const mattermostRows = imported.filter((item) => item.link_type === "mattermost").map((item) => savedRow(item, "file", "message", INTEGRATION_LABEL.mattermost)); // 예전에 등록한 대화 자료. 지울 수 있게 목록에는 남긴다
  const confluenceRows = imported.filter((item) => item.link_type === "confluence").map((item) => savedRow(item, "confluence", "folder", INTEGRATION_LABEL.confluence));
  const jiraRows = imported.filter((item) => item.link_type === "jira").map((item) => savedRow(item, "jira", "bolt", INTEGRATION_LABEL.jira));
  const groups: Record<SourceKey, { pending: ListRow[]; registered: ListRow[] }> = {
    file: { pending: [], registered: [...fileRows, ...mattermostRows] },
    mail: { pending: pendingMailRows, registered: [...mailRows, ...captureRows] },
    confluence: { pending: pendingConfluenceRows, registered: [...confluenceRows, ...linkRows] },
    jira: { pending: pendingJiraRows, registered: jiraRows },
  };
  const countsOf = (key: SourceKey) => ({ pending: groups[key].pending.length, registered: groups[key].registered.length });
  const allPending = [...groups.mail.pending, ...groups.confluence.pending, ...groups.jira.pending];
  const allRegistered = [...fileRows, ...mailRows, ...captureRows, ...linkRows, ...mattermostRows, ...confluenceRows, ...jiraRows];

  // ---- AI 분석 시작: 확인 → 고른(등록 예정) 대화·페이지를 먼저 등록 → 자료를 다 읽으면 분석 시작
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false); // 등록·읽기가 끝나기를 기다렸다가 분석을 시작하는 중
  const [waitFor, setWaitFor] = useState<number | null>(null); // 이만큼 자료가 목록에 보이고 다 읽으면 분석 시작
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [needSources, setNeedSources] = useState(false); // 자료 없이 시작을 누른 뒤, 자료가 생기기 전까지 안내를 보여 준다
  const readable = sources.filter((source) => source.status !== "failed").length;

  const askStart = () => {
    if (busy || starting) return;
    setLocalNotice(null);
    if (!readable && !allPending.length) {
      setNeedSources(true);
      return;
    }
    setConfirmOpen(true);
  };
  const confirmStart = async () => {
    setConfirmOpen(false);
    setStarting(true);
    let created = 0;
    if (confluencePicked.items.length) {
      const result = await onImportConfluence(confluencePicked.items.map((item) => item.id));
      if (!result) {
        setStarting(false); // 등록에 실패하면 서버 오류 문구가 화면에 뜬다. 고른 항목은 남겨 다시 시도할 수 있게 한다
        return;
      }
      confluencePicked.clear();
      created += result.sources.length;
    }
    if (mailPicked.items.length) {
      const result = await onImportMails(mailPicked.items.map((item) => item.id));
      if (!result) {
        setStarting(false);
        return;
      }
      mailPicked.clear();
      created += result.sources.length;
    }
    if (jiraPicked.items.length) {
      const result = await onImportJira(jiraPicked.items.map((item) => item.id));
      if (!result) {
        setStarting(false);
        return;
      }
      jiraPicked.clear();
      created += result.sources.length;
    }
    setWaitFor(sources.length + created);
  };
  useEffect(() => {
    if (waitFor === null) return;
    if (sources.length < waitFor) return; // 방금 등록한 자료가 목록에 아직 안 보임
    if (sources.some((source) => source.status === "pending" || source.status === "processing")) return; // 읽는 중
    setWaitFor(null);
    setStarting(false);
    onNext();
  }, [waitFor, sources, onNext]);
  useEffect(() => {
    if (waitFor === null) return;
    const timer = window.setTimeout(() => {
      setWaitFor(null);
      setStarting(false);
      setLocalNotice("자료를 읽는 데 시간이 걸리고 있어요.\n잠시 뒤 'AI 분석 시작'을 다시 눌러 주세요.");
    }, START_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [waitFor]);

  const active = CARDS.find((card) => card.key === activeSource) ?? null;
  const registeredCount = sources.length;

  const renderRow = (row: ListRow, pending: boolean) => (
    <div className={`added-resource${pending ? " pending" : ""}${row.group === activeSource ? " in-focus" : ""}`} key={row.id}>
      <span><Icon name={row.icon} size={17} /></span>
      <div><strong>{row.title}</strong><small>{row.sub}</small></div>
      <button type="button" onClick={row.remove} aria-label={`${row.title} 삭제`} title="삭제"><Icon name="close" size={14} /></button>
    </div>
  );
  // 지금 연 종류에 담긴 자료만 나란히 보여 준다(왼쪽 등록 예정 | 오른쪽 등록됨)
  const renderCompare = (key: SourceKey) => {
    const group = groups[key];
    const withPending = key === "confluence" || key === "mail" || key === "jira";
    return (
      <div className={`us-compare${withPending ? " two" : ""}`}>
        {withPending && (
          <div className="us-compare-col pending">
            <div className="us-compare-head"><strong>등록 예정</strong><span>{group.pending.length}</span></div>
            {group.pending.length ? group.pending.map((row) => renderRow(row, true)) : <p>열기를 눌러 고르면 여기에 담겨요.</p>}
          </div>
        )}
        <div className="us-compare-col">
          <div className="us-compare-head"><strong>등록됨</strong><span>{group.registered.length}</span></div>
          {group.registered.length ? group.registered.map((row) => renderRow(row, false)) : <p>아직 등록된 자료가 없어요.</p>}
        </div>
      </div>
    );
  };

  return (
    <div className={`upload-step-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header upload-step-header">
        <Brand onClick={onHome} />
        <div className="onboarding-progress">
          <span className="active" />
          <span className="active" />
          <span />
          <span />
          <small>2 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="upload-step-main us-main">
        <div className="upload-step-title">
          <span>2단계 · 자료 등록</span>
          <h1>업무 자료를 모아주세요</h1>
          <p>AMIGO가 자료의 내용을 분석해 인수인계 항목과 질문을 준비합니다.</p>
          <div className="upload-richness-note"><Icon name="sparkle" size={14} /><strong>자료가 풍부할수록 인수인계 문서가 더 정확해져요</strong><span>· 기존 인수인계서가 있다면 꼭 함께 올려 주세요</span></div>
        </div>
        <input className="source-file-input" ref={inputRef} type="file" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
        <div className="us-body">
          <div className={`us-stage ${active ? "is-focused" : ""}`}>
            {!active ? (
              <section className="us-grid" aria-label="자료 종류">
                {CARDS.map((card, index) => <SourceCard key={card.key} card={card} index={index} counts={countsOf(card.key)} onSelect={select} />)}
              </section>
            ) : (
              <>
                <section className="us-focus" key={active.key} aria-label={active.title}>
                  <header className="us-focus-head">
                    <span className="us-card-icon"><Icon name={active.icon} size={19} /></span>
                    <div><strong>{active.title}</strong><small>{active.desc}</small></div>
                    <button type="button" className="us-focus-close" onClick={() => setActiveSource(null)}>모두 보기</button>
                  </header>
                  <div className="us-focus-body">
                    {active.key === "file" && (
                      <>
                        <div className="us-drop" {...dropProps}>
                          <Icon name="upload" size={26} />
                          <strong>파일을 여기에 놓거나 클릭해서 선택하세요</strong>
                          <p>올리면 바로 등록돼요. 여러 개를 한 번에 올릴 수 있어요.</p>
                          <small className="source-formats">{active.tag}</small>
                          <button type="button">파일 선택</button>
                        </div>
                        <div className="us-examples" aria-label="업로드 파일 예시">
                          <strong>이런 자료를 올려 보세요</strong>
                          <ul>
                            {FILE_EXAMPLES.map((example) => <li key={example.name} className={[example.recommend ? "recommend" : "", example.important ? "important" : ""].filter(Boolean).join(" ") || undefined}><span><b>{example.name}</b>{example.recommend && <em>{example.important ? "중요" : "추천"}</em>}</span><small>{example.desc}</small></li>)}
                          </ul>
                          <p className="us-examples-more">기타 보고서, 추진계획서, 경영정보시스템 업무보고자료, 메신저 대화 캡처 등 업무와 관련된 다양한 자료를 함께 올려 보세요.{"\n"}특히 <b>경영정보시스템 업무보고자료</b>가 있다면 꼭 함께 올려 주세요.</p>
                          <p>ZIP 파일은 안에 든 문서를 자동으로 풀어서 읽어요.{"\n"}한 번에 최대 20개, 파일당 50MB까지 올릴 수 있어요.</p>
                        </div>
                        {renderCompare("file")}
                      </>
                    )}
                    {active.key === "mail" && (
                      <>
                        <IntegrationLauncher kind="mail" busy={busy || starting} picked={mailPicked} showChips={false} onImport={onImportMails} onOpen={() => openPicker("mail")} opened={opened.mail} />
                        <p className="us-mail-hint">메일함 창에서 제목이나 관련 사람 이름으로 메일을 찾아 보내면 '등록 예정'에 담겨요.{"\n"}메일함 창의 '캡처로 올리기'를 누르면 보고 있는 메일이 그림(PNG)으로 바로 등록돼요.</p>
                        {renderCompare("mail")}
                      </>
                    )}
                    {active.key === "confluence" && (
                      <>
                        <IntegrationLauncher kind="confluence" busy={busy || starting} picked={confluencePicked} showChips={false} onImport={onImportConfluence} onOpen={() => openPicker("confluence")} opened={opened.confluence} />
                        <div className="us-link-row">
                          <input
                            value={link}
                            onChange={(event) => setLink(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.nativeEvent.isComposing) { // 한글 조합 중 Enter 는 글자 확정이라 무시한다
                                event.preventDefault();
                                addLink();
                              }
                            }}
                            placeholder="또는 컨플루언스·나누미 링크 붙여넣기"
                          />
                          <button type="button" onClick={addLink}>추가</button>
                        </div>
                        {renderCompare("confluence")}
                      </>
                    )}
                    {active.key === "jira" && (
                      <>
                        <IntegrationLauncher kind="jira" busy={busy || starting} picked={jiraPicked} showChips={false} onImport={onImportJira} onOpen={() => openPicker("jira")} opened={opened.jira} />
                        <p className="us-mail-hint">지라 창에서 '프로젝트 진행 현황'을 고르면 스프린트 진척·에픽 진행률·담당자별 남은 일·막힌 이슈가 한 문서로 들어가요.{"\n"}에픽을 고르면 하위 이슈와 진행률이 함께 들어가요.</p>
                        {renderCompare("jira")}
                      </>
                    )}
                  </div>
                </section>
                <section className="us-dock" aria-label="다른 자료 종류">
                  {CARDS.filter((card) => card.key !== active.key).map((card, index) => <SourceCard key={card.key} card={card} index={index} counts={countsOf(card.key)} compact onSelect={select} />)}
                </section>
              </>
            )}
          </div>
          <aside className="us-side">
            <section className="us-side-section us-pending">
              <div className="added-list-title"><strong><Icon name="clock" size={15} /> 등록 예정 자료</strong><span>{allPending.length}개</span></div>
              <p className="us-side-desc">고르기만 한 자료예요.{"\n"}'AI 분석 시작'을 누르면 등록돼요.</p>
              {allPending.length === 0 ? <div className="empty-resource">고른 메일·페이지·지라 항목이 여기에 모여요.</div> : allPending.map((row) => renderRow(row, true))}
            </section>
            <section className="us-side-section us-registered">
              <div className="added-list-title"><strong><Icon name="folder" size={15} /> 등록된 자료</strong><span>{registeredCount}개</span></div>
              <p className="us-side-desc">이미 저장돼 AI 분석에 쓰이는 자료예요.</p>
              {allRegistered.length === 0 ? <div className="empty-resource">아직 등록된 자료가 없습니다.</div> : allRegistered.map((row) => renderRow(row, false))}
            </section>
          </aside>
        </div>
        <ErrorNote message={error ?? localNotice ?? (needSources && !readable && !allPending.length ? "분석할 자료를 1건 이상 등록해 주세요.\n위에서 자료 종류를 골라 보세요." : null)} />
        <div className="upload-step-actions">
          <button className="previous-step" onClick={onBack}><Icon name="arrow" size={16} /> 이전 단계로 이동</button>
          <button className="primary-button onboarding-next" disabled={busy || starting} onClick={askStart}>{starting ? "자료를 준비하는 중…" : "AI 분석 시작"} <Icon name="arrow" size={18} /></button>
        </div>
      </main>
      {confirmOpen && (
        <div className="logout-overlay" role="presentation" onClick={() => setConfirmOpen(false)}>
          <section className="logout-modal neutral-modal" role="alertdialog" aria-modal="true" aria-labelledby="start-title" onClick={(event) => event.stopPropagation()}>
            <span><Icon name="sparkle" size={22} /></span>
            <h2 id="start-title">AI 분석을 시작할까요?</h2>
            <p>
              등록된 자료 {registeredCount}개{allPending.length ? `와 등록 예정 ${allPending.length}개` : ""}를 바탕으로
              <br />인수인계 항목과 질문을 준비해요.
            </p>
            <div><button type="button" onClick={() => setConfirmOpen(false)}>취소</button><button type="button" autoFocus onClick={() => void confirmStart()}>분석 시작</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
