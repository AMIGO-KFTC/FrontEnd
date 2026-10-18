// 새로고침해도 작업을 이어서 하기 위한 도우미: 주소 해시(#/s/<세션ID>)와 서버의 진행 단계로 화면을 되살린다.
import type { StartData } from "./handover";
import type { SessionDetail, Stage } from "./types";

export type RestoredScreen = "upload" | "processing" | "question" | "document";

export function sessionFromHash(): string | null {
  const match = window.location.hash.match(/^#\/s\/([0-9a-f]{8,64})$/);
  return match ? match[1] : null;
}

// 주소만 바꾸고 기록은 쌓지 않는다(뒤로 가기가 이전 해시로 되돌지 않게).
export function writeHash(sessionId: string | null): void {
  const hash = sessionId ? `#/s/${sessionId}` : "";
  if (window.location.hash === hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
}

export function screenForStage(stage: Stage): RestoredScreen {
  switch (stage) {
    case "setup":
      return "upload";
    case "analyzing":
      return "processing";
    case "summary":
    case "qna":
      return "question";
    default:
      return "document"; // composing, review
  }
}

// 서버에는 본부·팀이 한 줄로 저장돼 있다: 작업을 만들 때는 "본부 · 팀", 프로필을 저장하면 서버가 "본부 팀"(공백)으로 바꾼다.
function splitOrganization(organization: string): [string, string] {
  if (organization.includes(" · ")) {
    const [division, ...rest] = organization.split(" · ");
    return [division, rest.join(" · ")];
  }
  const [division = "", ...rest] = organization.trim().split(/\s+/);
  return [division, rest.join(" ")];
}

export function dataFromSession(session: SessionDetail): StartData {
  const [division, team] = splitOrganization(session.organization);
  return {
    mode: session.mode,
    name: session.owner_name,
    division,
    team,
    role: session.position,
    task: session.duties,
    date: session.handover_date,
  };
}
