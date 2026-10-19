// 아직 BackEnd 와 연결되지 않아 예시 값을 보여 주는 영역임을 알리는 작은 표시.
export function ExampleBadge({ label = "예시" }: { label?: string }) {
  return <em className="example-badge" title="아직 서버와 연결되지 않은 예시 데이터입니다">{label}</em>;
}
