// 인수인계 관리(팀장). 우리 팀 구성원이 인계자인 인수인계(GET /api/admin/handovers)를 단계별로 본다.
// 정기인사 발령과 장기휴가는 탭으로 따로 볼 수 있고, 목록·상세에서 색(보라 = 정기인사, 분홍 = 장기휴가)으로 구분한다.
import { useState } from "react";
import { Icon } from "@/shared/Icon";
import { BROAD_STAGES, broadStage, formatDate, formatRelativeTime, hasDocument, sessionProgress, type BroadStage } from "@/shared/sessions";
import type { AdminHandover, HandoverMode } from "@/shared/types";

const STAGE_CLASS: Record<BroadStage, string> = { "자료 분석": "stage-38", 질의응답: "stage-72", "문서 생성": "stage-88", 완료: "stage-100" };
export const MODE_TAG: Record<HandoverMode, string> = { reassignment: "정기인사", leave: "장기휴가" };
const modeOf = (handover: AdminHandover): HandoverMode => (handover.mode === "leave" ? "leave" : "reassignment");
const shortDay = (value?: string) => (value ? `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}` : "");
export const leavePeriod = (handover: AdminHandover) => (handover.leave_start || handover.leave_end ? `${shortDay(handover.leave_start)} ~ ${shortDay(handover.leave_end)}` : "");

export function AdminHandoversPage({ handovers, onOpenDocument }: { handovers: AdminHandover[]; onOpenDocument: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"전체" | BroadStage>("전체");
  const [modeFilter, setModeFilter] = useState<"all" | HandoverMode>("all");
  const modeCount = (mode: HandoverMode) => handovers.filter((h) => modeOf(h) === mode).length;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filteredHandovers = handovers.filter((handover) => {
    const matchesQuery = `${handover.title} ${handover.owner_name} ${handover.successor} ${handover.organization}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (filter === "전체" || broadStage(handover) === filter) && (modeFilter === "all" || modeOf(handover) === modeFilter);
  });
  const selected = filteredHandovers.find((handover) => handover.id === selectedId) ?? filteredHandovers[0] ?? handovers.find((handover) => handover.id === selectedId) ?? handovers[0];
  if (!selected) {
    return <div className="admin-handovers-page"><div className="members-page-empty"><Icon name="message" size={28} /><h2>아직 인수인계가 없습니다.</h2><p>팀 구성원이 인수인계를 시작하면 이곳에 나타납니다.</p></div></div>;
  }
  const activeStage = BROAD_STAGES.indexOf(broadStage(selected));

  return (
    <div className="admin-handovers-page">
      <section className="members-page-title">
        <div><h1>인수인계 관리</h1><p>팀에서 진행 중이거나 완료된 인수인계를 한곳에서 확인합니다. 정기인사 발령과 장기휴가를 따로 볼 수 있어요.</p></div>
        <div className="handover-mode-tabs" role="tablist" aria-label="인수인계 유형">
          <button role="tab" aria-selected={modeFilter === "all"} className={modeFilter === "all" ? "active" : ""} onClick={() => setModeFilter("all")}>전체<small>{handovers.length}</small></button>
          <button role="tab" aria-selected={modeFilter === "reassignment"} className={`reassignment${modeFilter === "reassignment" ? " active" : ""}`} onClick={() => setModeFilter("reassignment")}><i />정기인사 발령<small>{modeCount("reassignment")}</small></button>
          <button role="tab" aria-selected={modeFilter === "leave"} className={`leave${modeFilter === "leave" ? " active" : ""}`} onClick={() => setModeFilter("leave")}><i />장기휴가<small>{modeCount("leave")}</small></button>
        </div>
      </section>
      <div className="handover-management-layout">
        <section className="handover-management-list">
          <header>
            <div><h2>{modeFilter === "all" ? "인수인계 목록" : `${MODE_TAG[modeFilter]} 인수인계`}</h2><span>{filteredHandovers.length === handovers.length ? `총 ${handovers.length}건` : `${filteredHandovers.length} / ${handovers.length}건`}</span></div>
            <label><Icon name="search" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 구성원, 팀 검색" /></label>
          </header>
          <div className="handover-filter-tabs">
            {(["전체", ...BROAD_STAGES] as const).map((item) => (
              <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="handover-admin-table">
            <div className="handover-admin-head"><span>인수인계</span><span>인계자 → 인수자</span><span>진행 단계</span><span>진행률</span><span>인계 예정</span></div>
            {filteredHandovers.map((handover) => {
              const stage = broadStage(handover);
              const progress = sessionProgress(handover);
              return (
                <button className={`mode-${modeOf(handover)}${selected.id === handover.id ? " selected" : ""}`} key={handover.id} onClick={() => setSelectedId(handover.id)}>
                  <span className="handover-admin-title"><i><Icon name={stage === "완료" ? "check" : modeOf(handover) === "leave" ? "calendar" : "message"} size={15} /></i><span><strong><b className={`mode-tag ${modeOf(handover)}`}>{MODE_TAG[modeOf(handover)]}</b>{handover.title}</strong><small>{modeOf(handover) === "leave" && leavePeriod(handover) ? `휴가 ${leavePeriod(handover)} · ` : ""}{handover.organization} · {formatRelativeTime(handover.updated_at)}</small></span></span>
                  <span className="handover-people"><strong>{handover.owner_name}</strong><Icon name="arrow" size={11} /><strong>{handover.successor || "미지정"}</strong></span>
                  <em className={STAGE_CLASS[stage]}>{stage}</em>
                  <span className="handover-admin-progress"><span><i style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></span>
                  <span className="handover-due">{handover.handover_date ? formatDate(handover.handover_date) : "미정"}</span>
                </button>
              );
            })}
            {!filteredHandovers.length && <div className="members-empty"><Icon name="search" size={20} /><strong>{modeFilter === "all" ? "검색 결과가 없습니다." : `${MODE_TAG[modeFilter]} 인수인계가 없습니다.`}</strong><span>다른 검색어나 진행 단계·유형을 선택해 주세요.</span></div>}
          </div>
        </section>
        <aside className={`handover-admin-detail mode-${modeOf(selected)}`}>
          <header><span>인수인계 상세</span><b className={`mode-tag ${modeOf(selected)}`}>{modeOf(selected) === "leave" ? "장기휴가" : "정기인사 발령"}</b></header>
          <div className="handover-detail-title"><span><Icon name={modeOf(selected) === "leave" ? "calendar" : "message"} size={20} /></span><em>{broadStage(selected)}</em><h2>{selected.title}</h2><p>{selected.organization}</p></div>
          <div className="handover-detail-people">
            <div><span>{selected.owner_name.slice(0, 1)}</span><small>인계자</small><strong>{selected.owner_name}</strong></div>
            <Icon name="arrow" size={16} />
            <div><span>{(selected.successor || "?").slice(0, 1)}</span><small>인수자</small><strong>{selected.successor || "미지정"}</strong></div>
          </div>
          <div className="handover-detail-progress"><div><span>전체 진행률</span><strong>{sessionProgress(selected)}%</strong></div><span><i style={{ width: `${sessionProgress(selected)}%` }} /></span></div>
          <dl className="handover-detail-meta">
            {modeOf(selected) === "leave" && <div><dt>휴가 기간</dt><dd>{selected.leave_start ? `${formatDate(selected.leave_start)} ~ ${selected.leave_end ? formatDate(selected.leave_end) : "미정"}` : "미정"}</dd></div>}
            <div><dt>인계 예정일</dt><dd>{selected.handover_date ? formatDate(selected.handover_date) : "미정"}</dd></div>
            <div><dt>등록 자료</dt><dd>{selected.file_count}개</dd></div>
            <div><dt>확인 질문</dt><dd>{selected.question_count}개 (남은 항목 {selected.open_gap_count})</dd></div>
            <div><dt>마지막 활동</dt><dd>{formatRelativeTime(selected.updated_at)}</dd></div>
          </dl>
          <div className="handover-stage-flow">
            <strong>진행 단계</strong>
            {BROAD_STAGES.map((stage, index) => <div className={index < activeStage ? "done" : index === activeStage ? "active" : ""} key={stage}><span>{index <= activeStage ? <Icon name="check" size={11} /> : index + 1}</span><p>{stage}</p><i /></div>)}
          </div>
          {hasDocument(selected) && <div className="received-footer-actions"><button onClick={() => onOpenDocument(selected.id)}><Icon name="file" size={14} /> 문서 열기</button></div>}
        </aside>
      </div>
    </div>
  );
}
