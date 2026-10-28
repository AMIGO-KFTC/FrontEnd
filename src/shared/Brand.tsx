// 왼쪽 위 AMIGO 로고(KFTC 마크 + 글자). onClick 을 주면 버튼이 되어 홈으로 돌아가는 데 쓴다(로그인 전 화면은 없음).
export function Brand({ onClick }: { onClick?: () => void }) {
  const inner = (
    <>
      <span className="brand-emblem" aria-hidden="true" />
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

// 인쇄용 AMIGO 마크. 화면의 .brand-emblem 은 그라데이션 배경을 CSS mask 로 자르는데 브라우저 인쇄는 mask 를 그리지 않아,
// 인쇄할 때는 같은 마크(kftc-mark.png)를 SVG mask 로 잘라 그린다. 장기휴가는 화면의 원형(conic) 무지개를 같은 색 순서의 직선 그라데이션으로 대신한다.
const PRINT_STOPS = {
  reassignment: ["#e3836b", "#d9637c", "#c45e95", "#8b66c7"],
  leave: ["#f39a2b", "#f4d93a", "#8cc63f", "#2fae75", "#2f9fd8", "#2c3f9f", "#7a2a96", "#c4227a", "#e22f4a"],
};

export function PrintEmblem({ leave = false, size = 23 }: { leave?: boolean; size?: number }) {
  const stops = PRINT_STOPS[leave ? "leave" : "reassignment"];
  const id = leave ? "amigo-print-leave" : "amigo-print";
  return (
    <svg className="brand-emblem-print" width={size} height={size} viewBox="0 0 78 78" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          {stops.map((color, i) => <stop key={color} offset={i / (stops.length - 1)} stopColor={color} />)}
        </linearGradient>
        <mask id={`${id}-mask`} style={{ maskType: "alpha" }}>
          <image href="/kftc-mark.png" width="78" height="78" />
        </mask>
      </defs>
      <rect width="78" height="78" fill={`url(#${id}-fill)`} mask={`url(#${id}-mask)`} />
    </svg>
  );
}
