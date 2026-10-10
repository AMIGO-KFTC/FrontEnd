// 연동 중 오류를 화면 흐름 안에서 한 줄로 알린다(디자인에 오류 표시가 없어 최소한으로만 사용).
export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" style={{ margin: "12px 0 0", color: "#c0392b", fontSize: 11 }}>{message}</p>;
}
