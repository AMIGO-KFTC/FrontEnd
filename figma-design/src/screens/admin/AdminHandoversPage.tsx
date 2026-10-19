import { useState } from "react";
import Icon from "@/components/Icon";

type AdminHandover = {
  id: number;
  title: string;
  owner: string;
  recipient: string;
  team: string;
  stage: "자료 분석" | "질의응답" | "문서 생성" | "완료";
  progress: number;
  due: string;
  sources: number;
  questions: string;
  updated: string;
};

const adminHandovers: AdminHandover[] = [
  { id: 1, title: "B2B 플랫폼 운영 인수인계", owner: "김민준", recipient: "박서연", team: "플랫폼팀", stage: "질의응답", progress: 72, due: "2025. 03. 25", sources: 8, questions: "2 / 4", updated: "10분 전" },
  { id: 2, title: "Q1 프로젝트 진행 현황", owner: "한예린", recipient: "이지윤", team: "서비스기획팀", stage: "자료 분석", progress: 38, due: "2025. 04. 02", sources: 5, questions: "0 / 5", updated: "어제" },
  { id: 3, title: "고객 대응 및 VOC 관리", owner: "이지윤", recipient: "정우진", team: "CX운영팀", stage: "문서 생성", progress: 88, due: "2025. 03. 21", sources: 12, questions: "4 / 4", updated: "2시간 전" },
  { id: 4, title: "인프라 운영 및 장애 대응", owner: "최도윤", recipient: "김민준", team: "인프라팀", stage: "완료", progress: 100, due: "2025. 03. 18", sources: 15, questions: "5 / 5", updated: "3일 전" },
  { id: 5, title: "프로덕트 디자인 시스템 운영", owner: "정우진", recipient: "한예린", team: "디자인팀", stage: "질의응답", progress: 64, due: "2025. 04. 08", sources: 7, questions: "3 / 6", updated: "5시간 전" },
  { id: 6, title: "B2B 사업 제안 및 계약 프로세스", owner: "박서연", recipient: "최도윤", team: "B2B사업팀", stage: "완료", progress: 100, due: "2025. 03. 14", sources: 11, questions: "4 / 4", updated: "1주 전" },
];

export default function AdminHandoversPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"전체" | AdminHandover["stage"]>("전체");
  const [selectedId, setSelectedId] = useState(1);
  const filteredHandovers = adminHandovers.filter((handover) => {
    const matchesQuery = `${handover.title} ${handover.owner} ${handover.recipient} ${handover.team}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (filter === "전체" || handover.stage === filter);
  });
  const selected = adminHandovers.find((handover) => handover.id === selectedId) ?? adminHandovers[0];
  const stages = ["자료 분석", "질의응답", "문서 생성", "완료"];
  const activeStage = stages.indexOf(selected.stage);

  return (
    <div className="admin-handovers-page">
      <section className="members-page-title">
        <div><span><Icon name="message" size={13} /> HANDOVER MANAGEMENT</span><h1>인수인계 관리</h1><p>팀에서 진행 중이거나 완료된 인수인계를 한곳에서 확인합니다.</p></div>
      </section>
      <div className="handover-management-layout">
        <section className="handover-management-list">
          <header>
            <div><h2>인수인계 목록</h2><span>총 24건</span></div>
            <label><Icon name="search" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 구성원, 팀 검색" /></label>
          </header>
          <div className="handover-filter-tabs">
            {(["전체", "자료 분석", "질의응답", "문서 생성", "완료"] as const).map((item) => (
              <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="handover-admin-table">
            <div className="handover-admin-head"><span>인수인계</span><span>인계자 → 인수자</span><span>진행 단계</span><span>진행률</span><span>완료 예정</span></div>
            {filteredHandovers.map((handover) => (
              <button className={selected.id === handover.id ? "selected" : ""} key={handover.id} onClick={() => setSelectedId(handover.id)}>
                <span className="handover-admin-title"><i><Icon name={handover.stage === "완료" ? "check" : "message"} size={15} /></i><span><strong>{handover.title}</strong><small>{handover.team} · {handover.updated}</small></span></span>
                <span className="handover-people"><strong>{handover.owner}</strong><Icon name="arrow" size={11} /><strong>{handover.recipient}</strong></span>
                <em className={`stage-${handover.progress}`}>{handover.stage}</em>
                <span className="handover-admin-progress"><span><i style={{ width: `${handover.progress}%` }} /></span><strong>{handover.progress}%</strong></span>
                <span className="handover-due">{handover.due}</span>
              </button>
            ))}
            {!filteredHandovers.length && <div className="members-empty"><Icon name="search" size={20} /><strong>검색 결과가 없습니다.</strong><span>다른 검색어나 진행 단계를 선택해 주세요.</span></div>}
          </div>
        </section>
        <aside className="handover-admin-detail">
          <header><span>HANDOVER DETAIL</span></header>
          <div className="handover-detail-title"><span><Icon name="message" size={20} /></span><em>{selected.stage}</em><h2>{selected.title}</h2><p>{selected.team}</p></div>
          <div className="handover-detail-people">
            <div><span>{selected.owner.slice(0, 1)}</span><small>인계자</small><strong>{selected.owner}</strong></div>
            <Icon name="arrow" size={16} />
            <div><span>{selected.recipient.slice(0, 1)}</span><small>인수자</small><strong>{selected.recipient}</strong></div>
          </div>
          <div className="handover-detail-progress"><div><span>전체 진행률</span><strong>{selected.progress}%</strong></div><span><i style={{ width: `${selected.progress}%` }} /></span></div>
          <dl className="handover-detail-meta">
            <div><dt>완료 예정일</dt><dd>{selected.due}</dd></div>
            <div><dt>등록 자료</dt><dd>{selected.sources}개</dd></div>
            <div><dt>확인 질문</dt><dd>{selected.questions}</dd></div>
            <div><dt>마지막 활동</dt><dd>{selected.updated}</dd></div>
          </dl>
          <div className="handover-stage-flow">
            <strong>진행 단계</strong>
            {stages.map((stage, index) => <div className={index < activeStage ? "done" : index === activeStage ? "active" : ""} key={stage}><span>{index <= activeStage ? <Icon name="check" size={11} /> : index + 1}</span><p>{stage}</p><i /></div>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
