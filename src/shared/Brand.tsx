import { Icon } from "./Icon";

// 왼쪽 위 AMIGO 로고. onClick 을 주면 버튼이 되어 홈으로 돌아가는 데 쓴다(로그인 전 화면은 없음).
export function Brand({ onClick }: { onClick?: () => void }) {
  const inner = (
    <>
      <span className="brand-mark"><Icon name="sparkle" size={19} /></span>
      <span>AMIGO</span>
    </>
  );
  if (!onClick) return <div className="brand">{inner}</div>;
  return (
    <button type="button" className="brand brand-link" onClick={onClick} title="홈으로" aria-label="AMIGO 홈으로">
      {inner}
    </button>
  );
}
