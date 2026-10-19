import Brand from "@/components/Brand";
import Icon from "@/components/Icon";

export default function AuthVisual() {
  return (
    <div className="login-art">
      <div className="art-grid" />
      <div className="art-content">
        <Brand />
        <div className="art-copy">
          <span className="eyebrow light"><Icon name="sparkle" size={15} /> ASK ME INTERACTIVELY</span>
          <h1>업무의 맥락까지,<br />온전히 이어지도록.</h1>
          <p>Grounding으로 근거를 찾고, Orchestration으로 흐름을 연결해<br />빈틈없는 인수인계서를 완성합니다.</p>
        </div>
        <div className="art-proof">
          <div className="proof-avatars"><span>김</span><span>이</span><span>박</span></div>
          <div><strong>누적 1,248건</strong><small>아미고와 함께 인수인계를 완료했어요</small></div>
        </div>
      </div>
      <div className="orb orb-one" />
      <div className="orb orb-two" />
    </div>
  );
}
