// 근거 자료: 인수인계서를 고르면 그 인수인계서를 만드는 데 쓴 자료(올린 파일·메일·링크)를 한곳에서 본다.
// 내 인수인계서는 서버 세션 목록, 받은 인수인계서는 GET /api/handovers/received 로 채우고, 고른 인수인계서의 자료는 GET /api/sessions/{id} 의 sources 로 불러온다.
// 문서가 있으면 GET /api/sessions/{id}/citations 로 자료마다 문서 근거로 쓰인 횟수를 함께 보여 준다.
import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { ConfirmModal } from "@/shared/ConfirmModal";
import { Icon } from "@/shared/Icon";
import { useProfile } from "@/shared/profile";
import { formatDate, hasDocument, MODE_LABEL, sessionTitle, sessionTone, STAGE_LABEL } from "@/shared/sessions";
import type { HandoverMode, ReceivedHandover, Source, Stage } from "@/shared/types";
import type { HomeNav, SessionList } from "./types";

type Props = HomeNav & { list: SessionList };
type Tab = "mine" | "received" | "team"; // team: 팀장이 검토하는 팀원 인수인계서(GET /api/admin/handovers, 본인 것 제외)
const TAB_LABEL: Record<Tab, string> = { mine: "내 인수인계서", received: "받은 인수인계서", team: "팀원 인수인계서" };

// 목록 한 줄: 내 인수인계서와 받은 인수인계서를 같은 모양으로 보여 준다.
type Task = { id: string; title: string; owner: string; organization: string; mode: HandoverMode; stage: Stage; documentVersion: number; updatedAt: string };

const STATUS_TEXT: Record<Source["status"], string> = { pending: "대기 중", processing: "읽는 중", ready: "읽기 완료", failed: "읽기 실패" };

function fileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function sourceType(source: Source): string {
  if (source.kind === "link") return source.link_type ? source.link_type.toUpperCase() : "링크";
  const ext = source.extension.replace(/^\./, "").toLowerCase();
  return ext ? ext.toUpperCase() : "파일";
}

function receivedTask(handover: ReceivedHandover): Task {
  return { id: handover.id, title: handover.task_name || handover.title, owner: handover.owner_name, organization: handover.organization, mode: handover.mode, stage: handover.stage, documentVersion: handover.document_version, updatedAt: handover.updated_at };
}

export function MaterialsScreen({ list, onHome, onHandover, onDocuments, onReceived, onChat, onCalendar, onMaterials, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const [received, setReceived] = useState<ReceivedHandover[] | null>(null);
  const [receivedError, setReceivedError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false); // 삭제 확인 창
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [profile] = useProfile();
  const [team, setTeam] = useState<ReceivedHandover[] | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const loadTeam = () => {
    if (!profile.isAdmin) return;
    api
      .adminHandovers()
      .then(({ handovers }) => {
        setTeam(handovers.filter((row) => row.owner_login_id !== profile.loginId));
        setTeamError(null);
      })
      .catch((e: Error) => {
        setTeam(null);
        setTeamError(e.message);
      });
  };
  useEffect(loadTeam, [profile.isAdmin, profile.loginId]);

  const loadReceived = () => {
    api
      .receivedHandovers()
      .then(({ handovers }) => {
        setReceived(handovers);
        setReceivedError(null);
      })
      .catch((e) => {
        setReceived(null);
        setReceivedError(e instanceof ApiError && e.status === 401 ? "로그인이 만료됐어요. 다시 로그인해 주세요." : (e as Error).message);
      });
  };
  useEffect(loadReceived, []);

  const mine: Task[] | null = list.sessions
    ? [...list.sessions]
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .map((session) => ({ id: session.id, title: sessionTitle(session), owner: session.owner_name, organization: session.organization, mode: session.mode, stage: session.stage, documentVersion: session.document_version, updatedAt: session.updated_at }))
    : null;
  const others = tab === "team" ? team : received;
  const tasks = tab === "mine" ? mine : others ? others.map(receivedTask) : null;
  const tasksError = tab === "mine" ? list.error : tab === "team" ? teamError : receivedError;
  const selected = tasks?.find((task) => task.id === selectedId) ?? tasks?.[0];

  // 고른 인수인계서의 자료와 문서 근거 횟수. 고른 문서가 바뀔 때마다 새로 불러온다.
  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [cited, setCited] = useState<Record<string, number>>({});
  const selectedKey = selected?.id;
  const selectedHasDocument = selected ? selected.documentVersion > 0 : false;
  useEffect(() => {
    if (!selectedKey) return;
    let cancelled = false;
    setSources(null);
    setSourcesError(null);
    setCited({});
    api
      .session(selectedKey)
      .then((detail) => !cancelled && setSources(detail.sources))
      .catch((e: Error) => !cancelled && setSourcesError(e.message));
    if (selectedHasDocument) {
      api
        .citations(selectedKey)
        .then((result) => {
          if (cancelled) return;
          const counts: Record<string, number> = {};
          for (const citation of result.citations) counts[citation.source_id] = (counts[citation.source_id] ?? 0) + 1;
          setCited(counts);
        })
        .catch(() => undefined); // 근거 횟수는 보조 정보라 못 받으면 비워 둔다
    }
    return () => {
      cancelled = true;
    };
  }, [selectedKey, selectedHasDocument]);

  const files = sources?.filter((source) => source.kind === "file") ?? [];
  const links = sources?.filter((source) => source.kind === "link") ?? [];
  const downloadable = files.filter((source) => source.status !== "failed");
  const citedCount = Object.values(cited).reduce((sum, n) => sum + n, 0);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelectedId(null);
  };

  return (
    <div className="app-shell materials-page">
      <AppSidebar active="materials" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} onCalendar={onCalendar} onMaterials={onMaterials} />
      <main className="materials-main">
        <header className="dashboard-header">
          <div><strong>근거 자료</strong></div>
        </header>
        <div className="materials-content">
          <section className="documents-title">
            <div><h1>인수인계서별 근거 자료</h1><p>인수인계서를 고르면 그 문서를 만드는 데 쓴 파일·메일·링크를 볼 수 있어요.</p></div>
            <div><strong>{tasks ? tasks.length : "—"}</strong><small>{TAB_LABEL[tab]}</small></div>
          </section>
          <section className="materials-layout">
            <aside className="materials-list">
              <div className="materials-tabs" role="tablist" aria-label="인수인계서 구분">
                <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => switchTab("mine")}>내 인수인계서{mine ? ` ${mine.length}` : ""}</button>
                <button role="tab" aria-selected={tab === "received"} className={tab === "received" ? "active" : ""} onClick={() => switchTab("received")}>받은 인수인계서{received ? ` ${received.length}` : ""}</button>
                {profile.isAdmin && <button role="tab" aria-selected={tab === "team"} className={tab === "team" ? "active" : ""} onClick={() => switchTab("team")}>팀원 인수인계서{team ? ` ${team.length}` : ""}</button>}
              </div>
              {tasksError && <div className="list-notice error" role="alert">목록을 불러오지 못했어요: {tasksError}<button onClick={tab === "mine" ? list.reload : tab === "team" ? loadTeam : loadReceived}>다시 시도</button></div>}
              {tasks && tasks.length === 0 && !tasksError && <p className="materials-empty">{tab === "mine" ? "아직 만든 인수인계가 없어요." : tab === "team" ? "아직 팀원이 쓴 인수인계서가 없어요." : "아직 받은 인수인계가 없어요."}</p>}
              <div className="materials-task-scroll">
                {tasks?.map((task) => (
                  <button key={task.id} className={selected?.id === task.id ? "active" : ""} onClick={() => setSelectedId(task.id)}>
                    <span className={`document-list-icon ${sessionTone(task.id)}`}><Icon name="folder" size={17} /></span>
                    <div>
                      <strong>{task.title}</strong>
                      <small>{tab !== "mine" ? `${task.owner} · ` : ""}{hasDocument({ stage: task.stage, document_version: task.documentVersion }) ? `문서 v${task.documentVersion}` : STAGE_LABEL[task.stage]} · {formatDate(task.updatedAt)}</small>
                    </div>
                    <Icon name="chevron" size={13} />
                  </button>
                ))}
              </div>
            </aside>
            {selected ? (
              <article className="materials-detail">
                <header>
                  <div>
                    <h2>{selected.title}</h2>
                    <p>{MODE_LABEL[selected.mode]} · 인계자 {selected.owner}{selected.organization ? ` · ${selected.organization}` : ""}</p>
                  </div>
                  <div className="materials-summary">
                    <div><strong>{sources ? files.length : "—"}</strong><small>파일</small></div>
                    <div><strong>{sources ? links.length : "—"}</strong><small>링크</small></div>
                    <div title="인수인계서 본문에 근거 번호로 달린 횟수"><strong>{selectedHasDocument ? citedCount : "—"}</strong><small>문서 근거</small></div>
                  </div>
                </header>
                <div className="materials-body">
                  {sourcesError && <div className="list-notice error" role="alert">자료를 불러오지 못했어요: {sourcesError}</div>}
                  {!sources && !sourcesError && <p className="materials-empty">자료를 불러오는 중이에요…</p>}
                  {sources && sources.length === 0 && <p className="materials-empty">이 인수인계서에는 아직 등록한 자료가 없어요.</p>}
                  {sources && sources.length > 0 && (
                    <ul className="materials-sources">
                      {sources.map((source) => {
                        const meta = [sourceType(source), fileSize(source.size), source.added_stage !== "setup" ? "대화 중 추가" : "", formatDate(source.created_at)].filter(Boolean).join(" · ");
                        return (
                          <li key={source.id} className={source.status === "failed" ? "failed" : ""}>
                            <span className="materials-source-icon"><Icon name={source.kind === "link" ? "link" : "file"} size={16} /></span>
                            <div>
                              <strong title={source.name}>{source.name}</strong>
                              <small>{meta}</small>
                            </div>
                            <span className={`materials-status ${source.status}`} title={source.error || undefined}>{STATUS_TEXT[source.status]}</span>
                            {cited[source.id] ? <span className="materials-cited">근거 {cited[source.id]}회</span> : <span />}
                            {source.kind === "link" ? (
                              <a href={source.url} target="_blank" rel="noreferrer" title={`${source.url} 열기`} aria-label={`${source.name} 열기`}><Icon name="arrow" size={15} /></a>
                            ) : source.status !== "failed" ? (
                              <a href={api.sourceFileUrl(selected.id, source.id)} download={source.name} title={`${source.name} 내려받기`} aria-label={`${source.name} 내려받기`}><Icon name="download" size={15} /></a>
                            ) : (
                              <span />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <footer>
                  {tab === "mine" && <button className="materials-delete" onClick={() => { setDeleteError(null); setDeleting(true); }} title="이 인수인계서와 자료·대화를 모두 지워요"><Icon name="close" size={14} /> 삭제</button>}
                  {downloadable.length > 0 && <a className="materials-zip" href={api.sourcesArchiveUrl(selected.id)} download title="올린 자료 파일을 ZIP 한 개로 내려받아요"><Icon name="download" size={14} /> 파일 모두 내려받기 (ZIP)</a>}
                  <button onClick={() => onChat(selected.id)} disabled={tab !== "mine" && !selectedHasDocument && !(tab === "team" && sources?.some((source) => source.status === "ready"))}><Icon name="sparkle" size={14} /> 이 인수인계서에 질문하기</button>
                  <button onClick={() => (tab === "mine" ? list.open(selected.id) : list.openDocument(selected.id))} disabled={tab !== "mine" && !selectedHasDocument}><Icon name="file" size={14} /> {tab === "mine" && !selectedHasDocument ? "작업 열기" : "문서 열기"}</button>
                </footer>
              </article>
            ) : (
              <article className="materials-detail materials-detail-empty"><p>왼쪽에서 인수인계서를 고르면 근거 자료가 여기에 보여요.</p></article>
            )}
          </section>
        </div>
      </main>
      {deleting && selected && (
        <ConfirmModal
          icon="close"
          title="이 인수인계서를 삭제할까요?"
          description={`${selected.title}의 자료·대화·문서가 서버에서 모두 지워지며 되돌릴 수 없습니다.`}
          confirmLabel="삭제하기"
          busy={deleteBusy}
          onCancel={() => !deleteBusy && setDeleting(false)}
          onConfirm={async () => {
            setDeleteBusy(true);
            const error = await list.remove(selected.id);
            setDeleteBusy(false);
            setDeleting(false);
            setDeleteError(error);
            if (!error) setSelectedId(null);
          }}
        />
      )}
      {deleteError && <div className="list-notice error materials-delete-error" role="alert">삭제하지 못했어요. {deleteError}</div>}
    </div>
  );
}
