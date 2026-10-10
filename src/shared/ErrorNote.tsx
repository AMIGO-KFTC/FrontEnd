// 연동 중 안내를 화면 흐름 안에서 한 줄로 알린다(디자인에 오류·안내 표시가 없어 최소한으로만 사용).
export function ErrorNote({ message, tone = "error" }: { message: string | null; tone?: "error" | "info" }) {
  if (!message) return null;
  return <p role={tone === "error" ? "alert" : "status"} style={{ margin: "12px 0 0", color: tone === "error" ? "#c0392b" : "#7055c5", fontSize: 11 }}>{message}</p>;
}
