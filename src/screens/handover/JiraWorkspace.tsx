import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api";
import type { Picked, PickItem } from "@/shared/pickBridge";
import type { JiraIssue, JiraIssueDetail, JiraProject, JiraSearchResult } from "@/shared/types";
import "./jiraWorkspace.css";

// 새 탭 선택 창의 지라 화면. 실제 지라처럼 왼쪽에 프로젝트, 가운데에 프로젝트 진행 현황(스프린트·에픽 진행률)과 보드/목록이 보인다.
// 인수인계에 쓸 것을 체크해 'AMIGO 로 보내기'로 원래 창에 넘긴다.
// 보드의 카드는 끌어서 다른 열로 옮기면 상태가 바뀌고, 스프린트·에픽 진행률이 바로 다시 계산된다(가상 서버 메모리에만 반영).
//   - 프로젝트 진행 현황(project:<키>): 후임자가 '지금 어디까지 왔는지'를 한 번에 보는 요약
//   - 에픽: 하위 이슈와 진행률을 함께
//   - 이슈: 설명·댓글·하위 작업
// (데이터는 BackEnd 의 가상 예시 데이터다.)

type Props = {
  picked: Picked;
  onSend: (items: PickItem[]) => Promise<string | undefined>;
  warning: string | null;
  onClose: () => void;
};

type View = "board" | "list";
const TYPE_ICON: Record<string, string> = { 에픽: "jw-type-epic", 스토리: "jw-type-story", 작업: "jw-type-task", 버그: "jw-type-bug", "하위 작업": "jw-type-sub" };
const PRIORITY_MARK: Record<string, string> = { "가장 높음": "⇈", 높음: "↑", 보통: "=", 낮음: "↓" };

const projectItem = (p: JiraProject): PickItem => ({ id: `project:${p.key}`, title: `${p.name} 진행 현황`, url: p.url });
const issueItem = (i: JiraIssue): PickItem => ({ id: i.key, title: `[${i.key}] ${i.summary}`, url: i.url });

function Bar({ percent, tone = "" }: { percent: number; tone?: string }) {
  return <span className={`jw-bar ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></span>;
}

function Lozenge({ status, category }: { status: string; category?: string }) {
  const cat = category ?? (status === "완료" ? "done" : status === "할 일" ? "todo" : "progress");
  return <span className={`jw-lozenge ${cat}`}>{status}</span>;
}

function Avatar({ name }: { name: string }) {
  if (!name) return <span className="jw-avatar empty" title="담당자 없음" />;
  const hue = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 37 % 360;
  return <span className="jw-avatar" style={{ background: `hsl(${hue} 55% 45%)` }} title={name}>{name.slice(-2)}</span>;
}

function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`jw-check${on ? " on" : ""}`} onClick={(event) => { event.stopPropagation(); onClick(); }} aria-pressed={on} aria-label={label} title={on ? "고른 항목에서 빼기" : "인수인계 자료로 고르기"}>
      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
    </button>
  );
}

export function JiraWorkspace({ picked, onSend, warning, onClose }: Props) {
  const [projects, setProjects] = useState<JiraProject[] | null>(null);
  const [projectKey, setProjectKey] = useState("AMG");
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState<JiraSearchResult | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [type, setType] = useState("");
  const [detail, setDetail] = useState<JiraIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null); // 끌고 있는 카드
  const [dropCol, setDropCol] = useState<string | null>(null); // 카드를 놓으려는 열
  const [reloadTick, setReloadTick] = useState(0); // 카드를 옮기면 진행률을 다시 불러온다

  useEffect(() => {
    api.jiraProjects().then((r) => setProjects(r.projects)).catch((e: Error) => setError(e.message));
  }, [reloadTick]);
  // 프로젝트를 바꾸거나 목록 조건을 바꾸면 이슈를 다시 찾는다(보드도 같은 결과에서 현재 스프린트만 쓴다)
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .jiraSearch({ q: query, project: projectKey, status, assignee, type })
        .then((r) => !cancelled && setSearch(r))
        .catch((e: Error) => !cancelled && setError(e.message));
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectKey, query, status, assignee, type, reloadTick]);

  // 카드를 다른 열에 놓으면: 화면을 먼저 바꾸고 서버에 알린 뒤 진행률·목록을 다시 불러온다
  const moveCard = (key: string, next: string) => {
    const card = search?.issues.find((i) => i.key === key);
    if (!card || card.status === next) return;
    const category = next === "완료" ? "done" : next === "할 일" ? "todo" : "progress";
    setSearch((current) => (current ? { ...current, issues: current.issues.map((i) => (i.key === key ? { ...i, status: next, category } : i)) } : current));
    api
      .jiraMoveIssue(key, next)
      .then(() => {
        setNotice(`${key} 을(를) '${next}'(으)로 옮겼어요.`);
        setReloadTick((t) => t + 1);
        if (detail?.key === key) void api.jiraIssue(key).then(setDetail);
      })
      .catch((e: Error) => {
        setError(e.message);
        setReloadTick((t) => t + 1);
      });
  };

  const project = projects?.find((p) => p.key === projectKey) ?? null;
  const issues = search?.issues ?? [];
  const sprintIssues = useMemo(() => (project?.sprint ? issues.filter((i) => i.sprint === project.sprint!.name && i.type !== "에픽") : []), [issues, project]);
  const toggle = (item: PickItem) => picked.toggle(item);
  const openIssue = (key: string) => api.jiraIssue(key).then(setDetail).catch((e: Error) => setError(e.message));
  const switchProject = (key: string) => {
    setProjectKey(key);
    setAssignee("");
    setDetail(null);
  };

  const send = async () => {
    if (!picked.items.length) return;
    setSending(true);
    setNotice(null);
    const message = await onSend(picked.items);
    setSending(false);
    if (message) {
      picked.clear();
      setNotice(message);
    }
  };

  return (
    <div className="jw">
      <header className="jw-top">
        <span className="jw-logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#0C66E4" /><path d="M12 5.5 18.5 12 12 18.5 5.5 12Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" /><circle cx="12" cy="12" r="2" fill="#fff" /></svg>
        </span>
        <strong>Jira</strong>
        <span className="jw-top-nav">프로젝트 · 보드 · 필터</span>
        <span className="jw-mock">가상 지라 · 예시 데이터</span>
        <div className="jw-top-actions">
          <span>{picked.items.length ? `${picked.items.length}개 고름` : "인수인계에 쓸 항목을 체크하세요"}</span>
          <button className="jw-send" disabled={!picked.items.length || sending} onClick={() => void send()}>{sending ? "보내는 중…" : "AMIGO로 보내기"}</button>
          <button className="jw-close" onClick={onClose}>닫기</button>
        </div>
      </header>
      {(warning || notice || error) && <div className={`jw-banner${warning || error ? " warn" : ""}`} role="status">{warning ?? error ?? notice}</div>}
      <div className="jw-body">
        <aside className="jw-side">
          <p className="jw-side-title">프로젝트</p>
          {projects?.map((p) => (
            <button key={p.key} className={`jw-project${p.key === projectKey ? " active" : ""}`} onClick={() => switchProject(p.key)}>
              <span className="jw-project-icon" style={{ background: `hsl(${Array.from(p.key).reduce((s, c) => s + c.charCodeAt(0), 0) * 47 % 360} 55% 48%)` }}>{p.key.slice(0, 1)}</span>
              <span className="jw-project-text"><strong>{p.name}</strong><small>{p.team}</small><Bar percent={p.progress.percent} /></span>
            </button>
          ))}
          {!projects && !error && <p className="jw-muted">불러오는 중…</p>}
        </aside>

        <main className="jw-main">
          {project && (
            <>
              <div className="jw-crumb">프로젝트 / {project.name}</div>
              <div className="jw-head">
                <div>
                  <h1>{project.name} <small>({project.key})</small></h1>
                  <p>{project.description}</p>
                  <p className="jw-muted">리더 {project.lead} · {project.team} · 이슈 {project.issue_count}개</p>
                </div>
                <label className={`jw-pick-project${picked.has(`project:${project.key}`) ? " on" : ""}`}>
                  <Check on={picked.has(`project:${project.key}`)} onClick={() => toggle(projectItem(project))} label="프로젝트 진행 현황 고르기" />
                  <span><strong>프로젝트 진행 현황</strong><small>스프린트 진척 · 에픽 진행률 · 담당자별 남은 일 · 막힌 이슈를 한 문서로</small></span>
                </label>
              </div>

              <section className="jw-overview">
                {project.sprint && (
                  <div className="jw-card jw-sprint">
                    <div className="jw-card-head"><strong>{project.sprint.name}</strong><span className={project.sprint.days_left <= 3 ? "jw-due soon" : "jw-due"}>남은 날 {project.sprint.days_left}일</span></div>
                    <p className="jw-muted">{project.sprint.start} ~ {project.sprint.end} · 목표: {project.sprint.goal}</p>
                    <div className="jw-big"><strong>{project.sprint.percent}%</strong><span>스토리 포인트 {project.sprint.done_points}/{project.sprint.points}</span></div>
                    <Bar percent={project.sprint.percent} tone="green" />
                    <div className="jw-counts">{Object.entries(project.sprint.counts).map(([s, n]) => <span key={s}><Lozenge status={s} /> {n}</span>)}</div>
                  </div>
                )}
                <div className="jw-card">
                  <div className="jw-card-head"><strong>에픽 진행률</strong><span className="jw-muted">전체 {project.progress.percent}%</span></div>
                  {project.epics.map((epic) => (
                    <div key={epic.key} className="jw-epic-row">
                      <Check on={picked.has(epic.key)} onClick={() => toggle({ id: epic.key, title: `[${epic.key}] ${epic.summary}`, url: `${project.url.replace(/\/projects\/.*/, "")}/browse/${epic.key}` })} label={`${epic.summary} 고르기`} />
                      <button className="jw-link" onClick={() => void openIssue(epic.key)}>{epic.summary}</button>
                      <span className="jw-epic-meta">{epic.done}/{epic.total}</span>
                      <Bar percent={epic.percent} tone="purple" />
                      <span className="jw-epic-pct">{epic.percent}%</span>
                    </div>
                  ))}
                </div>
                <div className="jw-card">
                  <div className="jw-card-head"><strong>담당자별 남은 일</strong></div>
                  {Object.entries(project.open_by_assignee).map(([name, count]) => (
                    <div key={name} className="jw-assignee"><Avatar name={name} /><span>{name}</span><b>{count}</b></div>
                  ))}
                  {project.blocked.length > 0 && (
                    <>
                      <div className="jw-card-head jw-blocked-head"><strong>막힌 이슈 {project.blocked.length}</strong></div>
                      {project.blocked.map((b) => <button key={b.key} className="jw-blocked" onClick={() => void openIssue(b.key)}><b>{b.key}</b> {b.summary}<small>{b.reason}</small></button>)}
                    </>
                  )}
                </div>
              </section>

              <div className="jw-toolbar">
                <div className="jw-tabs" role="tablist">
                  <button role="tab" aria-selected={view === "board"} className={view === "board" ? "active" : ""} onClick={() => setView("board")}>보드{project.sprint ? ` · ${project.sprint.name}` : ""}</button>
                  <button role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>모든 이슈</button>
                </div>
                <input className="jw-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이슈 검색(키·요약·설명·사람·댓글)" />
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="담당자"><option value="">담당자 전체</option>{search?.assignees.map((a) => <option key={a}>{a}</option>)}</select>
                {view === "list" && (
                  <>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="상태"><option value="">상태 전체</option>{search?.statuses.map((s) => <option key={s}>{s}</option>)}</select>
                    <select value={type} onChange={(e) => setType(e.target.value)} aria-label="유형"><option value="">유형 전체</option>{search?.types.map((t) => <option key={t}>{t}</option>)}</select>
                  </>
                )}
              </div>

              {view === "board" ? (
                <div className="jw-board">
                  {(search?.statuses ?? ["할 일", "진행 중", "검토 중", "완료"]).map((col) => {
                    const cards = sprintIssues.filter((i) => i.status === col);
                    return (
                      <div
                        key={col}
                        className={`jw-col${dropCol === col && dragKey ? " drop-target" : ""}`}
                        onDragOver={(event) => {
                          if (!dragKey) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          if (dropCol !== col) setDropCol(col);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropCol((current) => (current === col ? null : current));
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const key = event.dataTransfer.getData("text/plain") || dragKey;
                          setDragKey(null);
                          setDropCol(null);
                          if (key) moveCard(key, col);
                        }}
                      >
                        <h3>{col} <span>{cards.length}</span></h3>
                        {cards.map((issue) => (
                          <div
                            key={issue.key}
                            className={`jw-issue${picked.has(issue.key) ? " picked" : ""}${dragKey === issue.key ? " dragging" : ""}`}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", issue.key);
                              event.dataTransfer.effectAllowed = "move";
                              setDragKey(issue.key);
                            }}
                            onDragEnd={() => {
                              setDragKey(null);
                              setDropCol(null);
                            }}
                            onClick={() => void openIssue(issue.key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && void openIssue(issue.key)}
                            title="끌어서 다른 열로 옮기면 상태가 바뀌어요"
                          >
                            <p>{issue.summary}</p>
                            {issue.epic_summary && <span className="jw-epic-tag">{issue.epic_summary}</span>}
                            {issue.blocked && issue.category !== "done" && <span className="jw-flag">막힘</span>}
                            <div className="jw-issue-foot">
                              <Check on={picked.has(issue.key)} onClick={() => toggle(issueItem(issue))} label={`${issue.key} 고르기`} />
                              <span className={`jw-type ${TYPE_ICON[issue.type] ?? ""}`} title={issue.type} />
                              <span className="jw-key">{issue.key}</span>
                              <span className="jw-prio" title={`우선순위 ${issue.priority}`}>{PRIORITY_MARK[issue.priority]}</span>
                              {issue.points > 0 && <span className="jw-points">{issue.points}</span>}
                              <Avatar name={issue.assignee} />
                            </div>
                          </div>
                        ))}
                        {dragKey && dropCol === col && !cards.some((c) => c.key === dragKey) && <div className="jw-drop-hint">여기에 놓으면 '{col}'</div>}
                      </div>
                    );
                  })}
                  {!project.sprint && <p className="jw-muted">진행 중인 스프린트가 없어요. '모든 이슈'에서 찾아 보세요.</p>}
                </div>
              ) : (
                <table className="jw-table">
                  <thead><tr><th /><th>유형</th><th>키</th><th>요약</th><th>상태</th><th>담당자</th><th>기한</th><th>수정</th></tr></thead>
                  <tbody>
                    {issues.map((issue) => (
                      <tr key={issue.key} className={picked.has(issue.key) ? "picked" : ""} onClick={() => void openIssue(issue.key)}>
                        <td><Check on={picked.has(issue.key)} onClick={() => toggle(issueItem(issue))} label={`${issue.key} 고르기`} /></td>
                        <td><span className={`jw-type ${TYPE_ICON[issue.type] ?? ""}`} title={issue.type} /> {issue.type}</td>
                        <td className="jw-key">{issue.key}</td>
                        <td>{issue.summary}{issue.progress ? <small className="jw-muted"> · {issue.progress.percent}%</small> : null}{issue.blocked && issue.category !== "done" ? <span className="jw-flag">막힘</span> : null}</td>
                        <td><Lozenge status={issue.status} category={issue.category} /></td>
                        <td>{issue.assignee || "-"}</td>
                        <td>{issue.due || "-"}</td>
                        <td className="jw-muted">{issue.updated}</td>
                      </tr>
                    ))}
                    {search && !issues.length && <tr><td colSpan={8} className="jw-muted">조건에 맞는 이슈가 없어요.</td></tr>}
                  </tbody>
                </table>
              )}
            </>
          )}
        </main>

        {detail && (
          <aside className="jw-detail" aria-label={`${detail.key} 상세`}>
            <div className="jw-detail-head">
              <span className="jw-key">{detail.key}</span>
              <button className="jw-close" onClick={() => setDetail(null)}>닫기</button>
            </div>
            <h2>{detail.summary}</h2>
            <label className={`jw-pick-project small${picked.has(detail.key) ? " on" : ""}`}>
              <Check on={picked.has(detail.key)} onClick={() => toggle(issueItem(detail))} label={`${detail.key} 고르기`} />
              <span><strong>이 {detail.type === "에픽" ? "에픽(하위 이슈 포함)" : "이슈"}을 인수인계 자료로</strong></span>
            </label>
            <dl className="jw-fields">
              <div><dt>상태</dt><dd><Lozenge status={detail.status} category={detail.category} /></dd></div>
              <div><dt>담당자</dt><dd>{detail.assignee || "없음"}</dd></div>
              <div><dt>보고자</dt><dd>{detail.reporter || "-"}</dd></div>
              <div><dt>우선순위</dt><dd>{PRIORITY_MARK[detail.priority]} {detail.priority}</dd></div>
              {detail.sprint && <div><dt>스프린트</dt><dd>{detail.sprint}</dd></div>}
              {detail.epic_summary && <div><dt>에픽</dt><dd>{detail.epic_summary}</dd></div>}
              {detail.due && <div><dt>기한</dt><dd>{detail.due}</dd></div>}
              {detail.points > 0 && <div><dt>포인트</dt><dd>{detail.points}</dd></div>}
            </dl>
            {detail.blocked && detail.category !== "done" && <p className="jw-blocked-note">막힘: {detail.blocked}</p>}
            {detail.description && <><h3>설명</h3><p className="jw-desc">{detail.description}</p></>}
            {detail.progress && (
              <>
                <h3>하위 이슈 · {detail.progress.percent}%</h3>
                <Bar percent={detail.progress.percent} tone="purple" />
                {detail.children.map((c) => <button key={c.key} className="jw-child" onClick={() => void openIssue(c.key)}><span className="jw-key">{c.key}</span><span>{c.summary}</span><Lozenge status={c.status} category={c.category} /></button>)}
              </>
            )}
            {detail.subtasks.length > 0 && (
              <>
                <h3>하위 작업</h3>
                {detail.subtasks.map((c) => <button key={c.key} className="jw-child" onClick={() => void openIssue(c.key)}><span className="jw-key">{c.key}</span><span>{c.summary}</span><Lozenge status={c.status} category={c.category} /></button>)}
              </>
            )}
            {detail.comments.length > 0 && (
              <>
                <h3>댓글 {detail.comments.length}</h3>
                {detail.comments.map((c, i) => <div key={i} className="jw-comment"><Avatar name={c.author} /><div><strong>{c.author}</strong> <small className="jw-muted">{c.date}</small><p>{c.body}</p></div></div>)}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
