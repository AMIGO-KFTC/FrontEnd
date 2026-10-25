// 서버 세션을 화면 입력값(StartData)으로 되돌리는 도우미. 주소·단계 규칙은 router.ts 에 있다.
import type { StartData } from "./handover";
import type { HandoverUnit, SessionDetail } from "./types";

// 단위업무·세부업무(units)가 없는 예전 세션은 담당 업무 글(duties)에서 만든다.
// 인사발령은 줄마다 단위업무 1건(세부업무 없음), 장기휴가는 줄마다 정기 세부업무 1건.
function unitsFromSession(session: SessionDetail): HandoverUnit[] {
  if (session.units?.length) return session.units.map((unit) => ({ name: unit.name, regular: [...unit.regular], irregular: [...unit.irregular] }));
  const lines = session.duties.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (session.mode === "leave") return lines.length ? [{ name: "", regular: lines, irregular: [] }] : [];
  // 단위업무 API 로 만든 세션은 duties 가 "업무명: 설명" 이라 업무명만 쓴다
  const names = lines.length ? lines.map((line) => (session.task_name && line.startsWith(`${session.task_name}: `) ? session.task_name : line)) : session.task_name ? [session.task_name] : [];
  return names.map((name) => ({ name, regular: [], irregular: [] }));
}

// 서버에는 본부·팀을 "본부 · 팀" 한 줄로 저장해 두었으므로 다시 나눈다.
export function dataFromSession(session: SessionDetail): StartData {
  const [division = "", team = ""] = session.organization.split(" · ");
  return {
    mode: session.mode,
    name: session.owner_name,
    division,
    team,
    role: session.position,
    task: session.duties,
    date: session.handover_date,
    successor: session.successor,
    successorLoginId: session.successor_login_id,
    leaveStart: session.leave_start ?? "",
    leaveEnd: session.leave_end ?? "",
    units: unitsFromSession(session),
  };
}
