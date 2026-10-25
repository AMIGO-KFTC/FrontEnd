// 로그인 화면 왼쪽의 소개 비주얼. 모양은 index.css 의 .login-art 에 있다.
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";

export function AuthVisual() {
  return (
    <div className="login-art">
      <div className="art-grid" />
      <div className="art-content">
        <Brand />
        <div className="art-copy">
          <span className="eyebrow light"><Icon name="sparkle" size={15} /> <span className="art-acronym"><b>A</b>sk <b>M</b>e <b>I</b>nteractive, <b>G</b>rounded and <b>O</b>rchestrated</span></span>
          <h1 className="art-lines">
            <span className="art-line"><b>Interactive</b>한 상호작용,</span>
            <span className="art-line"><b>Grounding</b>으로 근거를 찾고,</span>
            <span className="art-line"><b>Orchestration</b>으로 모두 모은 흐름.</span>
            <span className="art-line art-line-final">빈틈없는 인수인계서를 완성합니다.</span>
          </h1>
        </div>
      </div>
      <div className="orb orb-one" />
      <div className="orb orb-two" />
    </div>
  );
}
