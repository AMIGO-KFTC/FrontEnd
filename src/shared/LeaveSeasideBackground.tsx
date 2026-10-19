// 장기휴가 유형(leave-theme)일 때 단계 화면 뒤에 깔리는 바닷가 장식. 모양은 index.css 의 .leave-seaside-scene 에 있다.
export function LeaveSeasideBackground() {
  return (
    <div className="leave-seaside-scene" aria-hidden="true">
      <span className="leave-sun" />
      <span className="leave-cloud cloud-a" />
      <span className="leave-cloud cloud-b" />
      <div className="leave-ocean"><i /><i /><i /></div>
      <div className="leave-sand" />
      <div className="leave-parasol"><span /><i /></div>
    </div>
  );
}
