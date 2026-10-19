import Icon from "@/components/Icon";

const slots = [
  { title: "업무 개요 및 목적", source: "운영가이드 p.2–4", status: "enough", label: "충분" },
  { title: "정기 업무 및 일정", source: "백로그 · 운영가이드", status: "enough", label: "충분" },
  { title: "주요 시스템 및 권한", source: "운영가이드 p.12", status: "partial", label: "부분" },
  { title: "이슈 및 리스크", source: "Q1 백로그", status: "partial", label: "부분" },
  { title: "비상 연락망", source: "확인 가능한 근거 없음", status: "lack", label: "부족" },
];

export default function SlotBoard() {
  return (
    <aside className="slot-board">
      <div className="panel-heading"><div><span className="panel-kicker">LIVE STATUS</span><h2>항목 현황</h2></div><button><Icon name="more" /></button></div>
      <div className="coverage-card">
        <div className="coverage-number"><strong>72</strong><span>%</span></div>
        <div><strong>문서 충족도</strong><p>확인 2개 남았어요</p></div>
        <svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="16" /><circle className="fill" cx="21" cy="21" r="16" /></svg>
      </div>
      <div className="legend"><span><i className="enough" />충분 2</span><span><i className="partial" />부분 2</span><span><i className="lack" />부족 1</span></div>
      <div className="slot-list">
        {slots.map((slot, index) => (
          <div className="slot-item" key={slot.title}>
            <div className="slot-row"><span className="slot-index">0{index + 1}</span><div><strong>{slot.title}</strong><small><Icon name={slot.status === "lack" ? "message" : "link"} size={12} /> {slot.source}</small></div><span className={`slot-pill ${slot.status}`}>{slot.label}</span></div>
            {slot.status === "lack" && <div className="need-check">확인 필요 · 담당자와 연락처를 알려주세요</div>}
          </div>
        ))}
      </div>
      <div className="source-summary"><span><Icon name="folder" size={16} /></span><div><strong>근거 출처 18개 연결됨</strong><p>모든 내용에 출처가 표시됩니다.</p></div><Icon name="chevron" size={15} /></div>
    </aside>
  );
}
