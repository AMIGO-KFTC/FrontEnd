import Icon from "@/components/Icon";

const stages = ["자료 분석", "분석 요약", "질의응답", "문서 생성"];

export default function StageProgress({ stage }: { stage: number }) {
  return (
    <section className="stage-bar">
      <div className="stage-title"><span className="live-dot" /><strong>인수인계 작성 중</strong><span>저장됨</span></div>
      <div className="stage-steps">
        {stages.map((name, index) => {
          const number = index + 1;
          return <div className={`stage-step ${number === stage ? "active" : ""} ${number < stage ? "done" : ""}`} key={name}>
            <span className="stage-circle">{number < stage ? <Icon name="check" size={14} /> : number}</span>
            <span><small>STAGE {number}</small><strong>{name}</strong></span>
            {index < stages.length - 1 && <i />}
          </div>;
        })}
      </div>
      <div className="total-progress"><span style={{ width: `${stage * 25}%` }} /></div>
    </section>
  );
}
