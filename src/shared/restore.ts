// 서버 세션을 화면 입력값(StartData)으로 되돌리는 도우미. 주소·단계 규칙은 router.ts 에 있다.
import type { StartData } from "./handover";
import type { SessionDetail } from "./types";

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
  };
}
