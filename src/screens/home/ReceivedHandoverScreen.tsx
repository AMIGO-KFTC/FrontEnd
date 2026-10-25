// 받은 인수인계: 내가 인수자로 지정된 인수인계(GET /api/handovers/received). 인수자는 문서를 읽고 PDF 로 받을 수 있다(수정은 인계자만).
// 목록은 검색어(제목·업무·인계자)와 업무 칩으로 거른다. 한 인수인계서에 업무가 여러 개 담길 수 있어, 고른 업무 중 하나라도 들어 있으면 보여 준다(OR 조건).
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon } from "@/shared/Icon";
import { formatDate, hasDocument, MODE_LABEL, sessionProgress, STAGE_LABEL } from "@/shared/sessions";
import type { ReceivedHandover } from "@/shared/types";
import type { HomeNav, SessionList } from "./types";

type Props = HomeNav & { list: SessionList };

// 인수자가 보는 상태: 문서가 나왔으면 '확인 필요', 아직이면 인계자가 작성 중
export function receivedStatus(handover: ReceivedHandover): { label: string; done: boolean } {
  return hasDocument(handover) ? { label: "확인 필요", done: false } : { label: "작성 중", done: true };
}

// 인수인계서에 담긴 업무 이름. 예전 서버 응답처럼 duties 가 없으면 단위 업무명 하나로 본다.
export function receivedDuties(handover: ReceivedHandover): string[] {
  if (handover.duties && handover.duties.length > 0) return handover.duties;
  return [handover.task_name || handover.title].filter(Boolean);
}

export function ReceivedHandoverScreen({ list, onHome, onHandover, onDocuments, onReceived, onChat, onCalendar, onMaterials, onLogout }: Props) {
  const [handovers, setHandovers] = useState<ReceivedHandover[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pickedDuties, setPickedDuties] = useState<string[]>([]);

  const load = () => {
    api
      .receivedHandovers()
      .then(({ handovers: rows }) => {
        setHandovers(rows);
        setError(null);
      })
      .catch((e) => {
        setHandovers(null);
        setError(e instanceof ApiError && e.status === 401 ? "로그인이 만료됐어요. 다시 로그인해 주세요." : (e as Error).message);
      });
  };
  useEffect(load, []);

  // 받은 인수인계서 전체에 나오는 업무(많이 나온 순 → 이름순)
  const allDuties = useMemo(() => {
    const counts = new Map<string, number>();
    for (const handover of handovers ?? []) for (const duty of receivedDuties(handover)) counts.set(duty, (counts.get(duty) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).map(([name, count]) => ({ name, count }));
  }, [handovers]);
  const toggleDuty = (name: string) => setPickedDuties((current) => (current.includes(name) ? current.filter((duty) => duty !== name) : [...current, name]));
  const keyword = query.trim().toLowerCase();
  const filtered = (handovers ?? []).filter((handover) => {
    const duties = receivedDuties(handover);
    if (pickedDuties.length > 0 && !duties.some((duty) => pickedDuties.includes(duty))) return false;
    if (!keyword) return true;
    return [handover.title, handover.task_name, handover.owner_name, handover.organization, ...duties].some((text) => text?.toLowerCase().includes(keyword));
  });
  const filtering = pickedDuties.length > 0 || keyword !== "";
  const selected = filtered.find((handover) => handover.id === selectedId) ?? filtered[0];
  const ready = handovers ? handovers.filter(hasDocument).length : 0;

  return (
    <div className="app-shell received-page">
      <AppSidebar active="received" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} onCalendar={onCalendar} onMaterials={onMaterials} />
      <main className="received-main">
        <header className="dashboard-header received-header">
          <div><strong>받은 인수인계</strong></div>
          <button className="received-help" onClick={load}><Icon name="clock" size={14} /> 새로고침</button>
        </header>
        <div className="received-content">
          <section className="received-title">
            <div><h1>전달받은 업무를 확인하세요</h1><p>인계자가 정리한 업무 맥락과 근거 자료를 한곳에서 확인할 수 있어요.</p></div>
            <div className="received-counts">
              <div><strong>{handovers ? handovers.length : "—"}</strong><small>전체</small></div>
              <i />
              <div><strong>{handovers ? ready : "—"}</strong><small>확인 필요</small></div>
              <i />
              <div><strong>{handovers ? handovers.length - ready : "—"}</strong><small>작성 중</small></div>
            </div>
          </section>
          {error && <div className="list-notice error" role="alert">받은 인수인계를 불러오지 못했어요: {error}<button onClick={load}>다시 시도</button></div>}
          {handovers && handovers.length === 0 && !error && <div className="list-notice">아직 받은 인수인계가 없어요.{"\n"}인계자가 기본 정보에서 인수자로 지정하면 여기에 나타납니다.</div>}
          {handovers && handovers.length > 0 && (
            <section className="received-layout">
              <aside className="received-list">
                <div className="received-filter">
                  <div className="received-list-head"><strong>인수인계 목록</strong><span>{filtering ? `${filtered.length} / ${handovers.length}건` : `${handovers.length}건`}</span></div>
                  <label className="received-search">
                    <Icon name="search" size={14} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무명·인계자로 검색" aria-label="받은 인수인계 검색" />
                    {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><Icon name="close" size={12} /></button>}
                  </label>
                  {allDuties.length > 1 && (
                    <div className="received-duty-filter" role="group" aria-label="업무별로 보기(하나라도 포함)">
                      {allDuties.map((duty) => {
                        const picked = pickedDuties.includes(duty.name);
                        return (
                          <button key={duty.name} type="button" className={picked ? "picked" : ""} aria-pressed={picked} onClick={() => toggleDuty(duty.name)} title={`${duty.name} · ${duty.count}건`}>
                            {duty.name}<small>{duty.count}</small>
                          </button>
                        );
                      })}
                      {pickedDuties.length > 0 && <button type="button" className="received-duty-reset" onClick={() => setPickedDuties([])}>선택 해제</button>}
                    </div>
                  )}
                </div>
                {filtered.length === 0 && <p className="received-filter-empty">조건에 맞는 인수인계가 없어요.{"\n"}검색어나 업무 선택을 바꿔 보세요.</p>}
                {filtered.map((handover) => {
                  const status = receivedStatus(handover);
                  const duties = receivedDuties(handover);
                  return (
                    <button className={selected?.id === handover.id ? "active" : ""} key={handover.id} onClick={() => setSelectedId(handover.id)}>
                      <span className="received-avatar">{handover.owner_name.slice(0, 1)}</span>
                      <div>
                        <span className={`received-status ${status.done ? "done" : ""}`}>{status.label}</span>
                        <strong>{handover.task_name || handover.title}{duties.length > 1 && <em className="received-duty-more"> 외 {duties.length - 1}개 업무</em>}</strong>
                        <small>{handover.owner_name} · {handover.organization || "소속 미입력"}</small>
                      </div>
                      <Icon name="chevron" size={13} />
                    </button>
                  );
                })}
              </aside>
              {selected ? (
              <article className="received-detail">
                <header>
                  <div>
                    <span className={`received-status ${receivedStatus(selected).done ? "done" : ""}`}>{receivedStatus(selected).label}</span>
                    <h2>{selected.task_name || selected.title}</h2>
                    <p>{MODE_LABEL[selected.mode]} · 현재 {STAGE_LABEL[selected.stage]} 단계 · 진행률 {sessionProgress(selected)}%</p>
                    {receivedDuties(selected).length > 1 && (
                      <div className="received-duty-tags">{receivedDuties(selected).map((duty) => <span key={duty} className={pickedDuties.includes(duty) ? "picked" : ""}>{duty}</span>)}</div>
                    )}
                  </div>
                </header>
                <div className="received-meta">
                  <div><small>인계자</small><strong>{selected.owner_name}</strong><span>{[selected.organization, selected.position].filter(Boolean).join(" · ") || "소속 미입력"}</span></div>
                  <div><small>시작일</small><strong>{formatDate(selected.created_at)}</strong><span>인계 예정일 {selected.handover_date ? formatDate(selected.handover_date) : "미정"}</span></div>
                </div>
                <section className="received-files">
                  <div><strong>전달받은 자료</strong><span>자료 {selected.file_count}개 · 문서 {hasDocument(selected) ? `v${selected.document_version}` : "작성 전"}</span></div>
                  <article className="received-document-preview">
                    <span>AMIGO 인수인계서</span>
                    <h3>{selected.title}</h3>
                    <p>안정적인 업무 연속성을 위한 핵심 정보와 실행 가이드</p>
                    <i />
                    <div><strong>01. 인계자</strong><p>{[selected.owner_name, selected.organization, selected.position].filter(Boolean).join(" · ")}</p></div>
                    <div><strong>02. 담당 업무</strong><p>{receivedDuties(selected).join(" · ") || "미입력"}</p></div>
                    <div><strong>03. 문서</strong><p>{hasDocument(selected) ? "표와 근거 번호가 달린 전체 문서는 ‘문서 열기’에서 확인할 수 있어요." : "인계자가 자료를 올리고 AI 질문에 답하면 문서가 만들어져요.\n문서가 나오면 여기서 바로 열 수 있어요."}</p></div>
                  </article>
                </section>
                <footer>
                  <div className="received-footer-actions">
                    <button disabled={!hasDocument(selected)} onClick={() => list.openDocument(selected.id)}><Icon name="file" size={14} /> 문서 열기</button>
                    <button disabled={!hasDocument(selected)} onClick={() => { window.location.href = api.downloadUrl(selected.id, "pdf"); }}><Icon name="download" size={14} /> PDF 내려받기</button>
                  </div>
                </footer>
              </article>
              ) : (
                <article className="received-detail received-detail-empty"><p>왼쪽 목록에서 인수인계를 골라 주세요.</p></article>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
